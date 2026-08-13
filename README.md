# Valida

**Cadastrou, validou é PIX.**

Plataforma de indicação de leads para seguros e proteção veicular. O indicador
aborda motoristas na rua, capta o contato, um analista valida por telefone — e
a comissão cai no PIX.

## Como funciona o dinheiro

| Evento | Indicador | Promotor | Pool |
| --- | --- | --- | --- |
| Lead **validado** | R$ 3,00 | R$ 1,00 | R$ 4,00 |
| Lead **convertido** (bônus) | R$ 50,00 | R$ 10,00 | R$ 60,00 |

O convertido é **acumulativo**: um lead que valida e depois fecha paga R$ 53 ao
indicador (3 + 50). O promotor pode redistribuir a própria fatia do pool entre
supervisores e indicadores, sempre dentro do teto.

## Papéis

| Papel | O que faz |
| --- | --- |
| `indicador` | Capta leads na rua |
| `indicador_nivel_1` | Indicador com permissões estendidas |
| `promotor` | Recruta indicadores e ganha sobre a equipe |
| `supervisor` | Camada intermediária na equipe do promotor |
| `analista` | SDR que valida o lead (níveis 1–3, com permissões) |
| `vendedor` | Closer que trabalha a proposta |
| `gerente` / `admin` | Gestão e financeiro |

## Rodando localmente

Precisa de Docker e Node 20+.

```bash
cp .env.example .env
```

```bash
npm install && docker compose up -d db
```

Em banco novo, aplique a migration manual **antes** do primeiro push de schema:

```bash
docker compose exec -T db psql -U postgres -d kongpix -f /dev/stdin < db/migrations/manual/002-rate-limits.sql
```

```bash
npm run db:push
```

E a de índice único **depois** de cada `db:push`:

```bash
docker compose exec -T db psql -U postgres -d kongpix -f /dev/stdin < db/migrations/manual/001-placa-unica.sql
```

```bash
npm run db:seed && npm run dev
```

Detalhes e alternativas em [`docs/RODAR-LOCAL.md`](docs/RODAR-LOCAL.md).

### Credenciais do seed

| Usuário | Senha | Papel |
| --- | --- | --- |
| `admin@gruposantana.com` | `admin123` | admin |
| `joao@example.com` | `senha123` | indicador |

Apenas para desenvolvimento.

## Testes

```bash
npm test
```

274 testes cobrindo os caminhos de dinheiro — rateio de comissão, transição de
status, saque, antifraude e rate limiting. Os de integração rodam contra um
Postgres real em base separada, porque o que se verifica ali é comportamento
transacional que um mock não reproduziria.

Ver [`tests/README.md`](tests/README.md), inclusive o que **não** está coberto.

## Antes de subir para produção

Variáveis obrigatórias — o boot **falha** sem elas, de propósito:

| Variável | Por quê |
| --- | --- |
| `SESSION_SECRET` | Sem valor fixo, cada instância assina diferente e o usuário cai deslogado |
| `MASTER_PASSWORD` | Operações críticas |
| `APP_TENANT` | A empresa das indicações não pode vir do header `Host` do cliente |
| `TRUST_PROXY=1` | Se ficar atrás de proxy/CDN; sem isso `req.ip` fica errado |

> **Atenção em evento presencial.** Centenas de pessoas no mesmo WiFi saem pelo
> mesmo IP público. Ajuste `LOGIN_MAX_PER_IP=0` e `REGISTER_MAX_PER_IP=0` no dia
> — o limite por conta continua protegendo contra força bruta.

Lista completa em [`.env.example`](.env.example).

## Stack

Node + Express + React + Drizzle + PostgreSQL. Tema por variáveis HSL em
`client/src/index.css` — mudar a paleta ali recolore o app inteiro.

> A aplicação é um servidor Express de processo longo, com WebSocket. **Não roda
> como função serverless** (Vercel) sem adaptação. Railway, Fly ou VPS encaixam
> sem alteração.

## Segurança

O sistema passou por auditoria com 52 achados confirmados — 10 críticos, 19
altos, 18 médios, 5 baixos — todos corrigidos e validados contra a aplicação
rodando. O relatório com cada achado, o cenário de falha e a correção está em
[`docs/AUDITORIA-ESCALA.md`](docs/AUDITORIA-ESCALA.md).
