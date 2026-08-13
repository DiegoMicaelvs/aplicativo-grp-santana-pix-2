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

## Supabase (produção)

O projeto **Valida** já existe e **o schema já foi aplicado**: 17 tabelas, 40
índices, 31 chaves estrangeiras e o índice único parcial de placa.

| | |
| --- | --- |
| Projeto | `Valida` |
| Ref | `cnacpuipffrspllbzwwz` |
| Região | `sa-east-1` |
| API | `https://cnacpuipffrspllbzwwz.supabase.co` |

Para apontar a aplicação, só falta a `DATABASE_URL` (a senha está em
**Project Settings → Database → Connection string**):

```
DATABASE_URL=postgresql://postgres.cnacpuipffrspllbzwwz:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

Use o **Session Pooler** (porta 5432), não o Transaction Pooler (6543): a
aplicação usa prepared statements e mantém sessão de banco por requisição, e o
transaction pooler recicla a conexão a cada comando, quebrando os dois.

O SSL liga sozinho para hosts não-locais; para forçar, `DATABASE_SSL=true`.

> **Não rode `npm run db:push` contra o Supabase.** O script usa `--force`, que
> compara o schema declarado com o banco e **remove o que não reconhece**. O
> schema de lá já está aplicado via migrations versionadas. Use `db:push`
> apenas no banco de desenvolvimento.

### Sobre o RLS

Todas as 17 tabelas estão com **Row Level Security habilitado e nenhuma
policy** — de propósito.

O Valida não usa a API do Supabase: fala com o Postgres direto por connection
string, e a autorização vive no Express. Mas o Supabase expõe o PostgREST
publicamente, e a chave `anon` é pública por design. Sem RLS, quem tivesse essa
chave leria e escreveria direto nas tabelas — CPF, chave PIX, saldo — passando
por fora de toda a autorização da aplicação.

RLS ligado sem policy faz o PostgREST negar tudo. A aplicação não é afetada
porque conecta como owner do schema, e o owner ignora RLS.

O linter do Supabase vai reportar `rls_enabled_no_policy` como **INFO** nas 17
tabelas. É o estado esperado, não um problema a corrigir.

> Se um dia o front for falar direto com o Supabase, aí será preciso escrever
> policies por tabela — e revisar cada uma contra as regras de papel que hoje
> estão no Express.

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

## Rate limiting

Os contadores ficam na tabela `rate_limits` do Postgres, **não em memória**:
sobrevivem a restart/deploy e são compartilhados entre instâncias. Antes viviam
num `Map`, o que significava N vezes mais tentativas permitidas com N instâncias,
e um deploy zerando até os bloqueios ativos.

Chaves usadas:

| Prefixo | O que conta |
| --- | --- |
| `login:ip:<ip>` | tentativas de login por origem |
| `login:user:<email>` | tentativas contra uma conta específica |
| `register:ip:<ip>` | cadastros por origem |
| `public:ip:<ip>` | acesso às rotas públicas por origem |

Destravar alguém no meio do evento:

```sql
DELETE FROM rate_limits WHERE chave = 'login:user:fulano@exemplo.com';
```

Ver quem está bloqueado:

```sql
SELECT chave, contador, janela_expira_em FROM rate_limits
WHERE janela_expira_em > now() ORDER BY contador DESC;
```

> Em banco novo (máquina nova, Supabase, staging), rode
> `db/migrations/manual/002-rate-limits.sql` **antes** do primeiro `db:push`:
> sem a tabela criada, o Drizzle não sabe se `rate_limits` é nova ou um rename
> de `session` e trava numa pergunta interativa.
>
> E reaplique `db/migrations/manual/001-placa-unica.sql` **depois** de cada
> `db:push` — é índice único sobre expressão com WHERE parcial, que o Drizzle
> não expressa e o push remove por não conhecer.

## Pontos de atenção antes do deploy na Vercel

1. **A app é um servidor Express de longa duração** (`server.listen`), não funções
   serverless. Vai precisar de um entrypoint compatível com Vercel Functions ou de um
   host que rode processo contínuo (Fly.io, Railway, VPS). Isso ainda não está feito.
2. **`cookies*.txt` continuam no histórico do git** (cookies de `localhost`,
   expirados em ago/2025 — risco baixo, mas o ideal é limpar o histórico).
