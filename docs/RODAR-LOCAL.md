# Rodando o projeto localmente com Docker

Stack local: **Postgres 16** (container) + **app Express/Vite** (container, com hot reload).

## Pré-requisitos

- Docker Desktop rodando
- (opcional) Node 20+ se quiser rodar o app fora do container

## 1. Configurar variáveis

```bash
cp .env.example .env
```

Gere um `SESSION_SECRET` real:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 2. Subir a stack

```bash
docker compose up -d --build
```

Serviços:

| Serviço | URL | Observação |
| --- | --- | --- |
| App | http://localhost:5000 | API + client no mesmo servidor |
| Postgres | localhost:5433 | porta 5433 no host para não conflitar com Postgres local |
| Adminer | http://localhost:8080 | opcional: `docker compose --profile tools up -d adminer` |

## 3. Criar o schema e popular o banco

```bash
docker compose exec app npm run db:push
```

```bash
docker compose exec app npm run db:seed
```

Usuários criados pelo seed:

| Usuário | Senha | Papel |
| --- | --- | --- |
| `admin@gruposantana.com` | `admin123` | admin |
| `joao@example.com` | `senha123` | indicador |

> Credenciais de desenvolvimento apenas. Nunca use em produção.

## Comandos do dia a dia

```bash
npm run docker:up
```

```bash
npm run docker:logs
```

```bash
npm run docker:down
```

Apagar o banco e recomeçar do zero (remove o volume):

```bash
npm run docker:reset
```

Abrir um shell no container:

```bash
docker compose exec app sh
```

## Hot reload

O diretório do projeto é montado em `/app` dentro do container e o servidor roda com
`tsx watch`. Edições em `server/`, `db/` e `shared/` reiniciam o servidor; edições em
`client/` são recarregadas pelo Vite (middleware mode).

`node_modules` fica em um volume Docker separado — os binários nativos são Linux e não
podem ser sobrescritos pelos do Windows. Depois de alterar `package.json`, rode:

```bash
docker compose up -d --build
```

## Rodar o app fora do Docker (só o banco no container)

```bash
docker compose up -d db
```

```bash
npm install
```

```bash
npm run dev
```

O `.env` já aponta `DATABASE_URL` para `localhost:5433`.

## Build de produção

```bash
docker compose exec app npm run build
```

Gera `dist/index.js` (servidor) e `dist/public` (client). O estágio `prod` do
`Dockerfile` empacota exatamente isso:

```bash
docker build --target prod -t kongpix:prod .
```

---

## Migrando para Supabase depois

O driver de banco agora é `pg` (node-postgres), que funciona igual em Postgres local e
no Supabase. Para apontar para o Supabase basta trocar a `DATABASE_URL`:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres
```

Use o **Session Pooler** (porta 5432) — ele mantém o suporte a sessões e prepared
statements que a aplicação usa. O SSL é ligado automaticamente para hosts que não são
locais; para forçar, use `DATABASE_SSL=true`.

Depois de configurar, aplique o schema:

```bash
npm run db:push
```

---

## Variáveis de segurança que você PRECISA definir antes de produção

| Variável | Efeito se ausente |
| --- | --- |
| `SESSION_SECRET` | Boot falha em produção (antes: segredo aleatório por instância, usuário caía deslogado) |
| `MASTER_PASSWORD` | Boot falha em produção (antes: senha real embutida no código) |
| `DEVELOPER_MASTER_PASSWORD` | Exclusão definitiva de usuários fica bloqueada |
| `TRUST_PROXY` | Padrão não confia em proxy. **Defina como `1` na Vercel**, senão `req.ip` fica errado |
| `COOKIE_SECURE` | Padrão segue `NODE_ENV`; em produção o cookie vira HTTPS-only |
| `CORS_ORIGINS` | Padrão não libera origem externa nenhuma |

> `TRUST_PROXY` é o mais delicado: ligá-lo **sem** proxy real na frente deixa
> `req.ip` sob controle do cliente e derruba o rate limiting. Deixá-lo desligado
> **atrás** de um proxy faz todos os usuários compartilharem o IP do proxy.

## Correções de segurança aplicadas nesta rodada

Todas validadas com exploit reproduzido antes e depois da correção:

1. **Mass assignment em indicações** — `createReferralSchema` usava `.omit`, então
   qualquer campo novo da tabela virava gravável pelo cliente. Um indicador comum
   marcava o próprio pagamento como `paid`, definia `commission_supervisor` e
   forjava `validated_by`. Trocado por allowlist (`.pick`).
2. **Mass assignment em cadastro** — `insertUserSchema` deixava passar
   `permissions`, `analystLevel` e `commissionValidated`. Como
   `commissionValidated` alimenta o cálculo de pagamento, dava para se cadastrar
   ganhando R$ 9.999 por lead em vez de R$ 3.
3. **Hash duplo de senha** — `/api/register` hasheava e `storage.createUser`
   hasheava de novo. Quem se cadastrava **nunca conseguia logar**. O hash agora
   acontece em um único lugar.
4. **Rate limiting burlável** — o contador subia em toda requisição (login
   legítimo se autobloqueava) e bastava rotacionar `X-Forwarded-For` para zerá-lo.
   Agora conta só falhas, limita por IP **e** por conta-alvo, e `trust proxy` é
   explícito.
5. **CORS aberto** — a API refletia qualquer origem com `Allow-Credentials: true`.
   Agora é allowlist via `CORS_ORIGINS`.
6. **IDOR em `/api/users/:id`** — qualquer usuário logado lia CPF, chave PIX,
   telefone e saldo de qualquer outro. Agora exige ser o dono, ter papel
   privilegiado ou estar na mesma hierarquia; quem não é privilegiado recebe só
   dados de identificação. Mesmo tratamento em `/api/users/by-ids`, que também
   ganhou limite de 200 IDs por requisição.
7. **Vazamento em logs** — o logger serializava o corpo de toda resposta `/api`
   (CPF, chave PIX, saldo); o login registrava o `SessionID` (credencial de
   sessão); a rota de exclusão logava `req.body` com a senha mestre em texto puro.
8. **Handler de erro** — fazia `throw` depois de responder e devolvia
   `err.message` cru ao cliente (mensagens do Postgres, caminhos internos).
9. **Senha mestre** — comparação com `!==` trocada por tempo constante.
10. **Titularidade no saque** — ver seção abaixo.

## Regra de titularidade do saque

A regra de negócio ("só saca para conta de sua titularidade; conta de terceiro
fica retida para intermediação") **não existia no código**. A função
`validateCpfForWithdrawal` estava escrita, mas nunca era chamada na gravação —
só num endpoint separado que o front chamava por conta própria. Comprovado:
pedido de saque com CPF e chave PIX de terceiro era aceito normalmente.

Agora, em `POST /api/withdrawals` (ver [server/pixValidation.ts](../server/pixValidation.ts)):

| Situação | Resultado |
| --- | --- |
| CPF informado ≠ CPF do cadastro | **400** — bloqueio duro, sem exceção |
| Chave PIX = CPF do titular | `pending` |
| Chave PIX = e-mail do cadastro | `pending` |
| Chave PIX = celular do cadastro (aceita DDI `+55`) | `pending` |
| Chave PIX de terceiro | `retido` + nota do motivo |
| Chave aleatória (UUID) | `retido` — não há como provar titularidade |

Em todos os casos aceitos o valor sai do saldo disponível na hora. `retido` é um
status novo em `WithdrawalStatus`; o painel do financeiro tem filtro próprio e
os botões de aprovar/rejeitar funcionam nele.

> Ainda **não implementado**: bloqueio automático de CPF por excesso de
> cancelamentos ou notificação de fraude. Hoje só existe o `isActive` manual.

### Dois bugs funcionais encontrados no caminho

- `POST /api/referral-links` falhava **sempre** com violação de `NOT NULL`: o
  insert não preenchia a coluna `name`.
- `GET /api/supervisor/referrals` sempre dava 500: chamava
  `storage.getReferrals()`, método que não existe (é `getAllReferrals`).

### Typecheck

`npm run check` passou de 12+ erros para **0**. Entre eles estavam dois bugs de
verdade (os dois acima) e a declaração de `req.user` no Express, que era um
subconjunto escrito à mão e já divergia do schema — agora deriva do tipo real.

## Pontos de atenção antes do deploy na Vercel

1. **A app é um servidor Express de longa duração** (`server.listen`), não funções
   serverless. Vai precisar de um entrypoint compatível com Vercel Functions ou de um
   host que rode processo contínuo (Fly.io, Railway, VPS). Isso ainda não está feito.
2. **Sessões em memória de rate limit** (`server/security.ts`) não sobrevivem a
   múltiplas instâncias — em serverless cada invocação teria seu próprio contador.
3. **Payload de 50 MB** em `express.json` (`server/index.ts`) vale para todas as rotas.
   O limite alto existe por causa dos comprovantes em base64 — considere aplicá-lo
   só nas rotas de upload.
4. **Rate limiting em memória** não sobrevive a múltiplas instâncias. Em serverless
   cada invocação teria seu próprio contador, o que anula o limite. Migre para
   Postgres/Redis antes de escalar horizontalmente.
5. **`cookies*.txt` continuam no histórico do git** (cookies de `localhost`,
   expirados em ago/2025 — risco baixo, mas o ideal é limpar o histórico).
