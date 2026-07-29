# Auditoria de escala e segurança — evento SEBRAE

Gerada por 13 agentes em paralelo (6 dimensões de auditoria + 6 verificadores adversariais + síntese).
**79 achados brutos, 52 confirmados** após refutação.

| Severidade | Qtd |
| --- | --- |
| Crítico | 10 |
| Alto | 19 |
| Médio | 18 |
| Baixo | 5 |

---

## Plano de correção priorizado

# PLANO DE CORREÇÃO — EVENTO SEBRAE
**52 achados agrupados em 21 tarefas.** Ordem de execução é de cima para baixo. Cada bloco é entregável: dá para parar em qualquer fronteira de bloco e o sistema já está melhor do que estava.

Legenda: **[MIG]** = exige migração/DDL no banco · **[UX]** = muda comportamento visível para o usuário · **[E]** = estimativa

---

## BLOCO 0 — PRIMEIRA HORA (correções de 1 a 15 linhas, impacto catastrófico)

> Justificativa da ordem: estes itens não são "só brecha". `/api/register-with-referral` entrega **admin** para qualquer anônimo — quem tem admin derruba o evento, esvazia o caixa e vaza a base, os três de uma vez. Custam minutos. Faça antes de qualquer refatoração.

### 0.1 — Fechar o cadastro público com role de admin
**Achados: 26, 38** · **[E] 20 min**
**Arquivos:** `server/routes.ts:3903` (rota `/api/register-with-referral`), `server/security.ts:189`, `server/storage.ts:236-243` (`createUser`)

Mudança concreta:
1. Em `routes.ts:3905`, trocar `const { referralToken, userData } = req.body` por parse com allowlist e forçar o papel no servidor:
```ts
const parsed = insertUserSchema.parse(req.body?.userData ?? {});
const newUser = await storage.createUserWithReferralAttribution(
  { ...parsed, role: "indicador", createdBy: null, permissions: null, analystLevel: null,
    commissionValidated: null, commissionConverted: null },
  req.body?.referralToken
);
```
2. Em `security.ts:189`, trocar `app.use("/api/register", ...)` por `app.use(["/api/register", "/api/register-with-referral"], ...)`. Hoje o prefixo **não casa** (o caractere seguinte é `-`, não `/`), então essa rota está sem limite nenhum.
3. Defesa em profundidade em `storage.ts`: `role`, `permissions`, `analystLevel`, `commissionValidated`, `commissionConverted`, `promoterId`, `supervisorId`, `teamSupervisorId` só devem ser lidos de um **segundo parâmetro explícito** (`opts`), nunca do objeto vindo do cliente. Isso protege as outras 4 rotas de criação de uma vez (ver 2.5).

**Como verificar (antes/depois):**
```bash
curl -s -X POST http://localhost:5000/api/register-with-referral -H 'Content-Type: application/json' \
 -d '{"userData":{"username":"poc@x.com","email":"poc@x.com","password":"123456","fullName":"POC","cpf":"52998224725","phone":"11999999999","pixKey":"poc@x.com","city":"SP","state":"SP","zipCode":"01000-000","role":"admin","permissions":["manage_withdrawals"]}}'
```
```sql
SELECT role, permissions FROM users WHERE username='poc@x.com';
```
Antes: `admin | {manage_withdrawals}`. Depois: `indicador | NULL` (ou 400 do Zod). **Rode este curl na produção agora** — se já existir usuário `role='admin'` que ninguém criou, você tem um incidente, não um bug:
```sql
SELECT id, username, full_name, role, created_by, created_at FROM users WHERE role <> 'indicador' ORDER BY created_at DESC;
```

### 0.2 — Cross-app validation aberto porque o segredo não existe
**Achado: 31** · **[E] 10 min** · **[UX]** (a rota passa a responder 503 até configurar)
**Arquivo:** `server/crossAppValidation.ts:40`

`process.env.CROSS_APP_SECRET` é `undefined` e o body sem `appSecret` também é `undefined` → `undefined !== undefined` é falso → **a checagem passa**. Falhe fechado:
```ts
const secret = process.env.CROSS_APP_SECRET;
if (!secret) return res.status(503).json({ error: "Validação cruzada não configurada" });
if (typeof appSecret !== "string" || !safeCompare(appSecret, secret)) return res.status(401).json({ error: "Não autorizado" });
```
Exporte `safeCompare` de `routes.ts:14` (comparação em tempo constante). Documente `CROSS_APP_SECRET` no `.env.example`.

**Verificar:** `curl -X POST .../api/validate/cross-app -d '{"cpf":"52998224725"}'` → antes devolve `{"hasDuplicates":true,...,"userName":"Fulano"}`; depois `401`/`503`.

### 0.3 — Nunca serializar `users.password` / CPF / PIX
**Achados: 27, 28, 45** · **[E] 30 min**
**Arquivos:** `server/routes.ts:1328` e `:1705`, `server/storage.ts:304` (`getAllUsers`), `:2281` (`getSupportTicketById`), `server/auth.ts:121`

1. `routes.ts:1328`: `storage.getSupportTicketById(req.user!.id)` passa **id de usuário onde a função espera id de ticket**. Trocar por `storage.getSupportTicketsByUserId(req.user!.id)` (já existe em `storage.ts:2295`). Corrige vazamento **e** funcionalidade quebrada.
2. `storage.ts:2281`: trocar `with: { user: true }` (nas duas profundidades, ticket e responses) por projeção `columns: { id: true, fullName: true, username: true, role: true }`.
3. `storage.ts:304` (`getAllUsers`): adicionar `columns: { password: false }` ao `findMany`. Isso conserta `routes.ts:1705` (`/api/analyst/analytics/users`, que hoje devolve `allUsers` cru) e blinda qualquer rota futura. O LocalStrategy (`auth.ts:121`) usa `getUserByUsername` — confirme que esse caminho continua trazendo a senha, senão o login quebra.

**Verificar:** logado como indicador comum:
```bash
curl -s -b cookies_indicador.txt localhost:5000/api/tickets | grep -c '"password"'      # 0
curl -s -b cookies_analista.txt localhost:5000/api/analyst/analytics/users | grep -c '"password"'  # 0
```
Antes ambos retornam ≥1. **Consequência operacional:** se isso já rodou em produção com analistas temporários, os hashes vazaram — troque a senha dos admins depois de aplicar.

### 0.4 — `.env` do dia do evento
**Achado: 25** · **[E] 5 min** · sem código
**Arquivo:** `.env` de produção

Estado atual confirmado: `REGISTER_MAX_PER_IP=500`, `LOGIN_MAX_PER_IP=300`, `NODE_ENV=development`, `TRUST_PROXY=` e `CORS_ORIGINS=` vazios. Com 2000 pessoas no mesmo WiFi, o 501º cadastro leva 429 ao vivo — e cadastros bem-sucedidos contam igual (`security.ts:205`).
```
REGISTER_MAX_PER_IP=0
LOGIN_MAX_PER_IP=0
LOGIN_MAX_PER_ACCOUNT=10      # NÃO desligar: é o que segura força bruta
NODE_ENV=production
COOKIE_SECURE=true
CORS_ORIGINS=https://<dominio-real>
TRUST_PROXY=1                 # SOMENTE se houver proxy/CDN real na frente
DATABASE_POOL_MAX=25          # já está 25; suba para 40 se o Postgres permitir (checar max_connections)
DATABASE_STATEMENT_TIMEOUT_MS=15000
APP_TENANT=<slug-da-empresa>  # ver 3.4
CROSS_APP_SECRET=<aleatório>  # ver 0.2
```
**Verificar:** `SHOW max_connections;` no Postgres e `SELECT count(*) FROM pg_stat_activity;` sob carga. Rode 600 POSTs de cadastro do mesmo IP e confirme que nenhum devolve 429.

---

## BLOCO 1 — O QUE DERRUBA O EVENTO (indisponibilidade)

### 1.1 — Limite de 50 MB no body parser, antes de qualquer auth
**Achados: 18, 33 (parte)** · **[E] 30 min** · **[UX]** (comprovante acima do limite passa a ser recusado com mensagem)
**Arquivos:** `server/index.ts:76-77`, `shared/schema.ts:557`, `server/routes.ts:2134`

`express.json({ limit: '50mb' })` é global e roda **antes** de `setupSecurity(app)` (index.ts:81) — ou seja, o corpo de 50 MB é bufferizado antes do rate limiter sequer existir. Dez POSTs anônimos em `/api/login` = 500 MB de heap + `JSON.parse` síncrono travando o event loop.

```ts
// index.ts — global apertado
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
// e nas duas rotas que aceitam comprovante, ANTES do handler e DEPOIS do requireAuth:
app.patch("/api/referrals/:id/status", requireAuth, express.json({ limit: '3mb' }), requireStatusEditPermission, handler)
```
E no schema (`shared/schema.ts:557`), o comprovante deixa de ser `z.string()` livre:
```ts
paymentProof: z.string()
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Comprovante deve ser uma imagem")
  .max(2_000_000, "Comprovante acima de 1,5 MB")
  .optional()
```
Remover também a cópia crua de `paymentProof` em `routes.ts:2134` (essa rota some no item 3.1).

**Verificar:**
```bash
head -c 52428800 /dev/zero | tr '\0' 'a' > /tmp/big.txt
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:5000/api/login -H 'Content-Type: application/json' \
  --data-binary @<(printf '{"username":"a","password":"%s"}' "$(cat /tmp/big.txt)")
```
Antes: 401/500 depois de segundos e RSS do processo saltando. Depois: **413** imediato, RSS estável (`process.memoryUsage().rss` antes/depois). E `{"status":"converted","paymentProof":"x"}` deve virar 400 (isso também mata metade do achado 34).

### 1.2 — SMS bloqueando a resposta HTTP, sem timeout
**Achado: 17** · **[E] 30 min**
**Arquivos:** `server/sms-service.ts:58`, `server/routes.ts:582, 1299-1309, 2668, 2714, 2828, 2881, 3051`

1. No `fetch` da Comtele: `signal: AbortSignal.timeout(5000)`.
2. Em **todos** os call sites, tirar o `await` do caminho da resposta: `void sendSMS(...).catch(e => console.error("[SMS]", e.message))`.
3. O laço de `routes.ts:1299-1309` (um SMS sequencial por admin, antes de responder o saque) vira `void Promise.allSettled(admins.map(a => sendSMS(...)))`.

**Verificar:** aponte `COMTELE_API_URL` para um endpoint que dorme 30 s (`nc -l` ou um `setTimeout` num mock) e cronometre:
```bash
time curl -s -b cookies_promotor.txt -X POST localhost:5000/api/promoter/indicators -d '{...}'
```
Antes: ~30 s (e ~150 s no saque com 5 admins). Depois: < 500 ms, com a falha de SMS aparecendo só no log.

### 1.3 — Transação segurando conexão e pedindo uma segunda: deadlock de pool no cadastro
**Achados: 4, 47** · **[E] 45 min**
**Arquivos:** `server/storage.ts:2889` (`createUserWithReferralAttribution`), `:200` (`createUser`), `:2309` (`logUserAction`)

Dentro de `db.transaction(tx)` o método chama `this.createUser()` e `this.logUserAction()`, que usam o `db` **global** — pedem uma segunda conexão do mesmo pool enquanto seguram a primeira. Com pool 25, 25 cadastros simultâneos travam todos até estourar `connectionTimeoutMillis=10s`. Pior: o `scrypt` de `auth.ts:25` roda **dentro** da transação, segurando a conexão durante o custo de CPU.

```ts
// assinatura com executor opcional
async createUser(userData, opts?: { role?: string; ... }, exec: DbExec = db) { ... exec.insert(users) ... }
async logUserAction(..., exec: DbExec = db) { ... }

// e dentro da transação:
const hashedPassword = await hashPassword(userData.password);   // ANTES do BEGIN
return db.transaction(async (tx) => {
  ...
  const user = await this.createUserPrehashed({...}, tx);       // passa tx
  await this.logUserAction(..., tx);
});
```
Corrige de quebra a inconsistência (hoje o usuário é commitado fora da tx: rollback do link deixa o usuário órfão, a pessoa recebe 500 e no retry leva "CPF já cadastrado").

**Verificar (o teste que importa):**
```bash
seq 1 60 | xargs -P 60 -I{} curl -s -o /dev/null -w '%{http_code} %{time_total}\n' \
  -X POST localhost:5000/api/register-with-referral -H 'Content-Type: application/json' \
  -d '{"referralToken":"<token-real>","userData":{"username":"c{}@x.com","email":"c{}@x.com","password":"123456","fullName":"C{}","cpf":"...","phone":"...","pixKey":"c{}@x.com","city":"SP","state":"SP","zipCode":"01000-000"}}'
```
Antes: dezenas de `500` com `time_total ≈ 10.0` (timeout de conexão). Depois: 60× `201` em menos de 2 s cada. Confirme com `SELECT count(*) FROM pg_stat_activity WHERE state='idle in transaction';` durante o teste — deve ficar próximo de zero.

### 1.4 — Varreduras de tabela inteira nas telas mais usadas + índices
**Achados: 22, 52, 19, 21, 23, 24** · **[E] 3-4 h** · **[MIG]** (índices) · **[UX]** (export passa a exigir filtro)
**Arquivos:** `server/routes.ts:328-361, 1528, 1567-1575, 1726, 1933-1997, 1011-1090, 3073`, `server/storage.ts:1029-1093, 1183, 1967-2017, 486-527`

Ordem de ataque (do mais quente para o mais frio):

**a) `GET /api/referrals` do analista (`routes.ts:328`)** — hoje chama `getAllReferrals()` e fatia com `slice()` em JS. Reaproveitar `getAllReferralsPaginated` (`storage.ts:1098`) e traduzir filtro de status e busca para `WHERE` em SQL, como já é feito em `getReferralsByUserIdPaginated` (`storage.ts:886`). Idem `getReferralsBySupervisor`.
**b) `paymentProof` fora da projeção de `getAllReferrals` (`storage.ts:1064`)** — servir por rota dedicada `GET /api/referrals/:id/payment-proof`. Sozinho isso corta ordens de grandeza de heap nas listagens.
**c) `getAllWithdrawalRequests` (`storage.ts:1979`)** — o `Promise.all` dispara uma query por saque. Trocar por um `GROUP BY` único com `inArray(referrals.userId, userIdsDaPagina)` + `LIMIT/OFFSET` na rota `routes.ts:2481`.
**d) `/api/public/company-metrics` (`routes.ts:1011`)** — pública, sem rate limit, chama `getReferralsByCompanyId` **duas vezes** quando há `?month=` (linha 1090). Trocar a agregação em JS por `COUNT/SUM ... GROUP BY status` com filtro de data no `WHERE`, aceitar **só** `publicToken` (hoje ID numérico funciona, `routes.ts:1023`), aplicar rate limit e cache de 60 s.
**e) `/api/admin/export/referrals` (`routes.ts:1933`)** — `XLSX.write` síncrono trava o event loop. Exigir período obrigatório + `LIMIT 5000`, e devolver 409 se já houver export em andamento.
**f) `updateUserBalance` (`storage.ts:486`)** — dois `getUserById` extras só para `console.log`. Trocar por `.returning({ balance: users.balance })`. São ~6 round-trips a menos por validação de lead.

**[MIG] Índices** (arquivo `db/migrations/0001_evento_sebrae.sql`, aplicar com `psql`):
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS referrals_status_idx           ON referrals (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS referrals_user_created_idx     ON referrals (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS referrals_createdby_created_idx ON referrals (created_by, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS referrals_company_created_idx  ON referrals (company_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS wr_user_status_idx             ON withdrawal_requests (user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS cash_flow_withdrawal_idx       ON cash_flow (related_withdrawal_id);
```
⚠️ O projeto usa `drizzle-kit push --force` (`package.json`). **Declare esses índices em `shared/schema.ts` também**, senão o próximo `npm run db:push` os apaga.

**Verificar:** popule com 30k referrals (`INSERT ... SELECT generate_series`), então:
```bash
time curl -s -b cookies_analista.txt 'localhost:5000/api/referrals?page=1&limit=10' -o /dev/null
time curl -s -b cookies_analista.txt 'localhost:5000/api/referrals?page=500&limit=10' -o /dev/null
```
Antes: ambos ~vários segundos, tempo cresce com o volume. Depois: < 100 ms, **e o tempo da página 500 igual ao da página 1**. Confirme com `EXPLAIN ANALYZE` que há `Index Scan` e `Limit`, não `Seq Scan`. Meça `rss` do Node antes/depois de 10 chamadas.

### 1.5 — WebSocket `/ws`: sem auth, sem heartbeat, com o referral inteiro no payload
**Achados: 20, 30** · **[E] 1 h** · **[UX]** (o front precisa passar a invalidar a query em vez de consumir o objeto do evento)
**Arquivos:** `server/routes.ts:3936` (`WebSocketServer`), `:3957` (`broadcastUpdate`), call sites `1868, 2197, 2285, 2383`; cliente em `client/src/**` que escuta `referral_updated`

1. Autenticar o upgrade: `verifyClient` (ou `server.on('upgrade')`) lendo o cookie `metis.sid` via `storage.sessionStore.get()`; rejeitar não autenticado; guardar `role` junto ao socket.
2. `ping`/`pong` a cada 30 s com `terminate()` nos mortos; teto de conexões por IP.
3. `broadcastUpdate` passa a enviar **só** `{ type, id, status, updatedAt }`. O cliente faz `queryClient.invalidateQueries()` e refaz o fetch autenticado.

Hoje um comprovante de 6,8 MB × 60 abas abertas = ~400 MB bufferizados **em um único evento de conversão** — e qualquer pessoa no WiFi recebe nome, telefone, placa e comprovante sem login.

**Verificar:** no console de uma aba anônima (deslogada):
```js
const ws = new WebSocket('ws://localhost:5000/ws');
ws.onmessage = e => console.log(e.data.length, e.data.slice(0,200));
```
Antes: conecta e recebe o JSON completo com `paymentProof`. Depois: `onerror`/close 401. Logado: conecta e recebe payload de ~80 bytes sem `fullName`/`phone`/`paymentProof`.

---

## BLOCO 2 — O QUE PERDE DINHEIRO

### 2.1 — `updateReferralStatus`: transação + lock + guarda de estado + cálculo absoluto ★ NÚCLEO
**Achados: 1, 8, 37, 10, 16, 11, 6, 15** · **[E] 4-6 h — é a tarefa mais longa do plano, comece cedo** · **[MIG]** (coluna `promoter_id` já existe; passa a ser populada)
**Arquivo:** `server/storage.ts:1308-1560`

Oito achados, uma reescrita. Faça nesta ordem dentro do método:

```ts
async updateReferralStatus(id, status, ...) {
  return await db.transaction(async (tx) => {
    // 1) LOCK + releitura (achados 1, 8, 37)
    const [ref] = await tx.select().from(referrals).where(eq(referrals.id, id)).for('update');
    if (!ref) throw new NotFound();

    // 2) EARLY RETURN idempotente (achados 10, 37)
    if (ref.status === status) return ref;

    const previousStatus = ref.status;

    // 3) CÁLCULO ABSOLUTO — nunca incremental sobre previousCommission* (achados 10, 16)
    //    converted = parcelaValidacao + parcelaConversao, independente de previousStatus
    const parts = computeCommissions(status, { indicador, supervisor, promotor });

    // 4) INVARIANTE — aborta em vez de pagar errado (achados 11, 16)
    if (parts.ind < 0 || parts.sup < 0 || parts.prom < 0) throw new Error(`Rateio inválido em #${id}`);
    const pool = status === 'converted' ? POOL_VALIDATED + POOL_CONVERTED : POOL_VALIDATED;
    if (status === 'validated' || status === 'converted') {
      if (Math.abs(parts.ind + parts.sup + parts.prom - pool) > 0.001) throw new Error(`Soma ≠ pool em #${id}`);
    }

    // 5) UPDATE CONDICIONAL — a transição é o gate (achados 1, 2, 37)
    const [upd] = await tx.update(referrals)
      .set({ status, commissionIndicator: ..., commissionPromoter: ..., commissionSupervisor: ...,
             supervisorId: supUsedId, promoterId: promUsedId,           // achado 15
             statusHistory: sql`COALESCE(status_history,'[]'::jsonb) || ${JSON.stringify([entry])}::jsonb` }) // achado 6
      .where(and(eq(referrals.id, id), eq(referrals.status, previousStatus)))
      .returning();
    if (!upd) return ref;   // outra requisição já transicionou: NÃO toca em saldo

    // 6) SALDOS — mesma tx, DEPOIS da transição confirmada
    await this.updateUserBalance(ref.userId, deltaInd, false, tx);
    await this.updateUserBalance(ref.promoterId ?? user.promoterId, deltaProm, false, tx);   // achado 15
    await this.updateUserBalance(ref.supervisorId ?? user.teamSupervisorId, deltaSup, false, tx);
  });
}
```

Pontos que **não podem** ser esquecidos:
- **Achado 10:** o `else` da linha 1407 zera a base de validação. Com cálculo absoluto (`3 + 50 = 53`), reprocessar `converted` dá delta `0`, não `-3`.
- **Achado 16:** no `else` da linha 1402, `newCommissionSupervisor = 0` rouba do supervisor o que ele já recebeu. Com cálculo absoluto + a asserção do passo 4, esse caminho não existe mais.
- **Achado 11:** `supervisorAlloc - indTake` fica negativo quando o indicador tem comissão default (NULL) e o supervisor tem alocação menor. O passo 4 aborta em vez de debitar o supervisor.
- **Achado 15:** o *valor* do estorno vem da linha do referral, mas o *destinatário* vinha de `user.promoterId` **atual**. Gravar `referrals.promoterId`/`supervisorId` no crédito e usar esses IDs no estorno.
- **Achado 6:** `statusHistory` com `||` em SQL (append atômico), aqui e em `validateReferral` (`storage.ts:1660-1671`) e em `routes.ts:2343-2352`.
- `updateUserBalance` precisa aceitar `exec` (mesma refatoração do item 1.3).

**Verificar (duplo crédito):**
```bash
ID=500; psql -c "UPDATE referrals SET status='pending', commission_indicator=0, commission_promoter=0 WHERE id=$ID"
psql -tAc "SELECT balance FROM users WHERE id=(SELECT user_id FROM referrals WHERE id=$ID)"   # B0
seq 1 8 | xargs -P 8 -I{} curl -s -o /dev/null -X PATCH localhost:5000/api/referrals/$ID/status \
  -b cookies_admin.txt -H 'Content-Type: application/json' -d '{"status":"validated"}'
psql -tAc "SELECT balance FROM users WHERE id=(SELECT user_id FROM referrals WHERE id=$ID)"   # B1
```
Antes: `B1 - B0` = R$ 6, 9, 12… Depois: exatamente **3,00**, com 7 respostas idempotentes.

**Verificar (re-`converted` não subtrai):** valide → converta → converta de novo. Saldo após a 3ª chamada deve ser **idêntico** ao da 2ª (antes: −3,00).

**Invariante de fechamento (rode depois do evento):**
```sql
SELECT u.id, u.balance,
       COALESCE(SUM(r.commission_indicator),0) AS ledger
FROM users u LEFT JOIN referrals r ON r.user_id = u.id
GROUP BY u.id, u.balance
HAVING u.balance <> COALESCE(SUM(r.commission_indicator),0)
     - COALESCE((SELECT SUM(amount) FROM withdrawal_requests w WHERE w.user_id=u.id AND w.status IN ('paid','pending','approved','retido')),0);
```
Zero linhas = caixa fecha.

### 2.2 — `updateWithdrawalStatus`: máquina de estados + estorno idempotente
**Achados: 2, 42, 9, 14 (parte)** · **[E] 2-3 h** · **[MIG]** · **[UX]** (transições inválidas passam a devolver 400)
**Arquivos:** `server/storage.ts:2029-2115`, `server/routes.ts:2490-2509`

A existência de `scripts/fix-duplicate-cashflow.ts` prova que o duplo efeito **já aconteceu em produção**.

1. **[MIG]**
```sql
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS refunded_at timestamp;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS cash_flow_withdrawal_outflow_uniq
  ON cash_flow (related_withdrawal_id) WHERE type='outflow' AND related_withdrawal_id IS NOT NULL;
```
(rode `scripts/fix-duplicate-cashflow.ts` antes de criar o índice, senão ele falha)
2. Máquina de estados explícita, rejeitando o resto com 400: `pending → approved|rejected|retido` · `approved → paid|rejected` · `retido → pending|rejected` · **`paid` é terminal**.
3. Trocar a checagem em memória (linhas 2040-2049) por UPDATE condicional dentro de `db.transaction`:
```ts
const [upd] = await tx.update(withdrawalRequests).set(updateData)
  .where(and(eq(withdrawalRequests.id, id), eq(withdrawalRequests.status, expectedFrom))).returning();
if (!upd) return current;                        // ninguém toca em saldo/caixa
if (status === 'rejected' && !upd.refundedAt) {  // estorno só uma vez, na mesma tx
  await tx.update(withdrawalRequests).set({ refundedAt: new Date() }).where(eq(withdrawalRequests.id, id));
  await this.updateUserBalance(upd.userId, +amount, false, tx);
}
if (status === 'paid') { await this.updateUserTotalEarnings(..., tx); await this.createCashFlowEntry(..., tx); }
```
4. **Achado 14:** bloquear a transição para `paid` quando `user.isActive === false`, com mensagem explícita ("usuário bloqueado por suspeita de fraude — liberar no financeiro").

**Verificar (estorno duplo):**
```bash
W=77; psql -c "UPDATE withdrawal_requests SET status='pending', refunded_at=NULL WHERE id=$W"
seq 1 6 | xargs -P 6 -I{} curl -s -o /dev/null -X PATCH localhost:5000/api/admin/withdrawals/$W \
  -b cookies_admin.txt -H 'Content-Type: application/json' -d '{"status":"rejected"}'
```
Saldo deve subir **uma vez** o valor do saque (antes: 2-6×).
**Verificar (ida e volta):** `pending → rejected → approved → rejected` — o segundo `rejected` deve dar 400 e o saldo não muda (antes: +R$300 do nada).
**Verificar (paid é terminal):** marcar `paid` e depois `rejected` → 400. Antes: usuário fica com o PIX **e** o saldo.

### 2.3 — Uma placa = um lead, garantido pelo banco
**Achados: 3, 39, 49** · **[E] 2 h** · **[MIG]** · **[UX]** (mensagem "Placa duplicada" passa a aparecer em cenários que antes passavam)
**Arquivos:** `server/routes.ts:483, 559-572, 2125-2126`, `shared/schema.ts:541`, `server/storage.ts:866, 1249, 2616`

Três buracos na mesma regra: (a) sem `UNIQUE` no banco, o check-then-act perde a corrida; (b) `licensePlates: ["ABC1D23","ABC1D23","ABC1D23"]` no mesmo payload cria 3 leads porque o laço compara só contra o banco; (c) o PATCH grava a placa sem normalizar e as três funções de busca normalizam de formas **diferentes** (`LOWER` vs `REPLACE('-')` vs igualdade exata).

1. `shared/schema.ts:541`: `.refine(p => new Set(p).size === p.length, "Placas duplicadas na mesma indicação")`.
2. Função única `normalizePlate(s)` = `s.toUpperCase().replace(/[^A-Z0-9]/g,'')`, aplicada em **todo** ponto de escrita (POST, PATCH `routes.ts:2126`, bulk) e de comparação (`storage.ts:866, 1249, 2616`).
3. **[MIG]** — dedupe primeiro, depois o índice:
```sql
-- 1. ver o estrago existente
SELECT upper(regexp_replace(license_plate,'[^A-Za-z0-9]','','g')) p, count(*), array_agg(id)
FROM referrals WHERE status NOT IN ('false','rejected') GROUP BY 1 HAVING count(*)>1;
-- 2. normalizar o histórico
UPDATE referrals SET license_plate = upper(regexp_replace(license_plate,'[^A-Za-z0-9]','','g'));
-- 3. resolver as duplicatas listadas em (1) MANUALMENTE (é dinheiro já pago) e então:
CREATE UNIQUE INDEX CONCURRENTLY referrals_plate_uniq
  ON referrals (upper(regexp_replace(license_plate,'[^A-Za-z0-9]','','g')))
  WHERE status NOT IN ('false','rejected');
```
4. Na rota, capturar `error.code === '23505'` e devolver o mesmo 400 "Placa já cadastrada" produzido hoje em memória.
5. Envolver o laço de criação múltipla (`routes.ts:559-572`) em `db.transaction` — hoje uma falha no meio deixa placas parciais e o retry recria as anteriores.

**Verificar:**
```bash
seq 1 10 | xargs -P 10 -I{} curl -s -o /dev/null -X POST localhost:5000/api/referrals -b cookies_indicador.txt \
  -H 'Content-Type: application/json' -d '{"fullName":"T","phone":"11999999999","licensePlates":["ZZZ9Z99"],...}'
psql -tAc "SELECT count(*) FROM referrals WHERE license_plate='ZZZ9Z99'"
```
Antes: 2-10. Depois: **1** (as outras 9 com 400).
E `{"licensePlates":["ABC1D23","ABC1D23"]}` → 400 antes de tocar no banco.
E: PATCH gravando `abc-1d23` seguido de POST `ABC1D23` → deve bloquear (antes: aceita e paga 2×).

### 2.4 — Comissão gravada à mão e reatribuição de dono
**Achados: 12, 29, 7, 13, 41** · **[E] 2 h** · **[UX]** (analista perde a capacidade de editar status/dono/comissão por essa rota)
**Arquivos:** `server/routes.ts:2055-2140`, `server/storage.ts:1742-1790`

A rota `PATCH /api/referrals/:id` é o furo mais barato de explorar do sistema: gate inline de papel (`isAdminOrAnalyst`, linha 2057) sem consultar `permissions`, sem Zod, e copia `status`, `userId`, `commissionIndicator`, `commissionPromoter` do body. Um analista com `permissions: []` — que leva 403 na rota dedicada — grava `commissionIndicator: "-5000"` (nenhum saldo muda) e depois rejeita a indicação: delta `0 - (-5000) = +5000` **sacáveis**.

1. Trocar o gate inline por `requireStatusEditPermission` / `requireAnalystPermission("edit_referral_status")` + checagem de escopo do analista nível 3 (o referral pertence a um supervisionado?).
2. Validar o body com Zod allowlist e **remover** `status`, `userId`, `commissionIndicator`, `commissionPromoter` do que a rota aceita. Remover também `commissionIndicator/Promoter` de `storage.updateReferral` (linhas 1749-1750).
3. Reatribuição de dono vira rota própria, **admin-only**, com `Number.isInteger(userId)` validado (achado 41: hoje `parseInt("") = NaN`, `NaN !== currentUserId` é true, o débito é commitado e o crédito falha — R$53 evaporam), tudo em `db.transaction` junto com o UPDATE do referral (achado 7).
4. `storage.ts:1777`: trocar `updateUserBalance(novoDono, valor, **true**)` por `false` (achado 13). `totalEarnings` só cresce em saque pago; hoje uma reatribuição infla o "total já pago" no novo dono **e não decrementa o antigo**.

**Verificar:** logado como analista com `permissions: []`:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH localhost:5000/api/referrals/10 -b cookies_analista.txt \
  -H 'Content-Type: application/json' -d '{"status":"converted","paymentProof":"x"}'          # 403 (antes: 200 + R$60)
curl -s -X PATCH localhost:5000/api/referrals/10 -b cookies_admin.txt -d '{"commissionIndicator":"-5000"}'
psql -tAc "SELECT commission_indicator FROM referrals WHERE id=10"                             # inalterado
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH localhost:5000/api/referrals/300 -b cookies_admin.txt -d '{"userId":""}'  # 400
```

### 2.5 — Comissão `NaN` e comissão fora do pool
**Achados: 40, 44** · **[E] 1,5 h** · **[MIG]**
**Arquivos:** `server/routes.ts:2656, 2697, 2742, 2785-2790, 2817-2818, 2855-2869, 2927-2975`, `server/storage.ts:231-232`

`parseFloat("abc") = NaN`; `NaN < 0` e `NaN > 4` são **ambos false** → a validação passa → grava `'NaN'` na coluna `numeric` (o Postgres aceita) → primeira validação de lead faz `balance + NaN` → **saldo NaN irreversível**, e o usuário passa a sacar qualquer valor (`parseFloat('NaN') < amount` é false).

1. Trocar todo `parseFloat` solto por `z.coerce.number().finite().min(0).max(POOL)`. Centralizar a validação de pool em `storage.createUser` para cobrir de uma vez as rotas de admin/analista (`routes.ts:2656, 2697, 2742`), que hoje só as de promotor/supervisor validam.
2. **[MIG] — atenção, a sugestão original do achado está errada:**
```sql
-- NÃO use CHECK (balance = balance): no Postgres NaN = NaN é TRUE.
-- NÃO use CHECK (balance >= 0): NaN é considerado MAIOR que todo número, então passa.
ALTER TABLE users ADD CONSTRAINT users_balance_not_nan CHECK (balance <> 'NaN'::numeric);
ALTER TABLE users ADD CONSTRAINT users_commission_validated_range CHECK (commission_validated IS NULL OR commission_validated BETWEEN 0 AND 4);
ALTER TABLE users ADD CONSTRAINT users_commission_converted_range CHECK (commission_converted IS NULL OR commission_converted BETWEEN 0 AND 60);
```
(`BETWEEN` pega NaN corretamente, porque `NaN <= 4` é false). Rode antes um `SELECT id FROM users WHERE balance <> balance OR commission_validated NOT BETWEEN 0 AND 4;` para achar registros já corrompidos.

**Verificar:**
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH localhost:5000/api/promoter/users/42/commissions \
  -b cookies_promotor.txt -H 'Content-Type: application/json' -d '{"commissionValidated":"abc"}'   # 400
curl ... -d '{"commissionValidated":"3,50"}'   # 400 (hoje parseFloat vira 3 silenciosamente)
curl ... -d '{"commissionValidated":"500.00"}' # 400 (hoje o promotor fica com -R$496)
psql -c "UPDATE users SET balance='NaN' WHERE id=42"   # deve falhar com check violation
```

### 2.6 — `indicador_nivel_1` convertendo o próprio lead
**Achado: 34** · **[E] 45 min** · **[UX]** (papel perde a auto-conversão)
**Arquivos:** `server/routes.ts:202-231` (`requireStatusEditPermission`), `:462`

O papel muda o próprio lead de `validated` para `converted` sem analista/closer, o comprovante exigido aceita a string `"x"`, e ele é isento do teto de 100 indicações/dia. A comissão vai inteira para o promotor (`storage.ts:1424-1438`), que **não** é bloqueado de sacar (o `forbidRole` de `routes.ts:1205` só bloqueia `indicador_nivel_1`). Dupla `indicador_nivel_1` + promotor = R$1.800 sacáveis em 30 cliques.

Remover `indicador_nivel_1` da lista de `requireStatusEditPermission` para a transição `→converted`, **ou** fazer essa transição gravar `aguardando_confirmacao` (que não credita nada) até um analista/vendedor confirmar. O item 1.1 já bloqueia o `paymentProof: "x"`.

**Verificar:** logado como `indicador_nivel_1`, `PATCH /api/referrals/<id-validado>/status {"status":"converted","paymentProof":"x"}` → 403 (ou 400 pelo formato do comprovante). Saldo do promotor inalterado.

### 2.7 — Bloqueio por fraude que não segura o dinheiro
**Achado: 14** · **[E] 1 h** · **[UX]** (saques do bloqueado passam a ser cancelados)
**Arquivo:** `server/storage.ts:1613-1651` (`enforceFraudBlock`)

Hoje só faz `isActive=false`. O fraudador que já sacou R$90 fica com `balance = -90` (não há CHECK ≥ 0) e o saque continua na fila — o admin marca `paid` sem nenhum aviso e a empresa paga por leads reconhecidamente falsos.

Dentro da mesma transação do bloqueio: cancelar os `withdrawal_requests` em `pending`/`approved`/`retido` do usuário (status `cancelado_fraude`, **sem estorno** — o valor não deve voltar ao saldo), e registrar o saldo negativo resultante em auditoria. O gate de `paid` para usuário inativo está no item 2.2.

**Verificar:** simule 11 leads marcados `false` → confira `SELECT is_active FROM users` (false) e `SELECT status FROM withdrawal_requests WHERE user_id=X` (nenhum em `pending`/`approved`). Tentar `paid` num saque desse usuário → 400.

---

## BLOCO 3 — BRECHA DE AUTORIZAÇÃO E VAZAMENTO

### 3.1 — `contact-status`: qualquer logado sabota qualquer lead
**Achado: 32** · **[E] 45 min**
**Arquivo:** `server/routes.ts:2198-2258`

O único controle é a lista de papéis da linha 2201 (praticamente todo mundo). Um indicador itera IDs seriais e marca leads de terceiros como `sem_sucesso` — o closer para de trabalhar o lead e a comissão de conversão do indicador legítimo nunca acontece. Aplicar a mesma checagem de acesso de `/api/referrals/:id/conversations` (`routes.ts:694-698`): admin, analista, dono (`userId`/`createdBy`), promotor da indicação ou vendedor/gerente responsável; 403 no resto. Trocar o `statusHistory` da linha 2245 pelo append em SQL do item 2.1.

**Verificar:** indicador A cria o lead; indicador B faz `PATCH /api/referrals/<id-do-A>/contact-status` → **403** (antes: 200).

### 3.2 — `check-duplicate` como oráculo de placa→nome e telefone→nome
**Achado: 36** · **[E] 45 min** · **[UX]** (a tela de duplicidade passa a mostrar menos dados)
**Arquivos:** `server/routes.ts:609-640`, `server/storage.ts:1288-1296`

Devolve `id`, `fullName`, `phone`, `licensePlate`, `createdAt` do lead **mais** nome e estado de quem cadastrou, para qualquer logado, sem limite. O laço `for` com `await` (linha 625) sobre `licensePlates` sem teto também vira DoS: 100.000 placas = 100.000 queries sequenciais.
```ts
const schema = z.object({ phone: z.string().optional(), licensePlates: z.array(z.string()).max(3).optional() });
// resposta: { isDuplicate, ownerFirstName, ownerState, originalDate } — nada mais
```
Rate limit por conta nessa rota.

**Verificar:** `curl -X POST .../check-duplicate -d '{"licensePlates":["ABC1D23"]}'` → resposta sem `fullName`/`phone`/`id` do lead. Com 50 placas → 400.

### 3.3 — `deleteUser` sempre falha em usuário com histórico
**Achado: 43** · **[E] 1 h** · **[UX]** (o admin volta a conseguir apagar cadastros de teste)
**Arquivo:** `server/storage.ts:683-720`

A transação apaga `referral_conversations`/`cash_flow` filtrando por `user_id`, mas apaga os **referrals** e **saques** do usuário — sobram linhas de terceiros apontando para eles (`referral_conversations.referral_id`, `cash_flow.related_referral_id`/`related_withdrawal_id`, `sales_leads.referral_id`, nenhuma com CASCADE) → erro 23503 → rollback → 500 genérico (o error handler mascara a causa). Coletar os ids dos referrals/saques do usuário e apagar as dependências **por esses ids** antes.

**Verificar:** limpe um usuário de teste que tenha conversa escrita por outro analista e um saque pago → `DELETE /api/admin/users/:id/delete` deve retornar 200 (antes: 500 sempre).

### 3.4 — `companyId` decidido pelo header `Host`
**Achado: 35** · **[E] 30 min** · **[MIG]** não · **[UX]** o boot falha sem `APP_TENANT`
**Arquivos:** `server/tenancy.ts:49-57`, `server/routes.ts:546-549`

Nenhuma das variáveis (`APP_TENANT`, `APP_ID`, `REPL_SLUG`) está definida, então o fallback `req.headers.host` — **dado controlado pelo cliente** — é o que decide o `companyId`, e ele sobrescreve o valor validado pelo Zod "por segurança". `curl -H 'Host: kongpix.x'` grava o lead na empresa errada. Exigir `APP_TENANT` explícito e falhar no boot em produção (mesmo padrão de `SESSION_SECRET` em `auth.ts:64-70`); remover o fallback por `Host`.

**Verificar:** `curl -H 'Host: kongpix.qualquercoisa' -X POST .../api/referrals ...` → `SELECT company_id` deve ser o do tenant configurado, não 11.

---

## BLOCO 4 — RESTO (se sobrar tempo; nenhum destes perde dinheiro sozinho)

| # | Achados | Mudança | Verificação | [E] |
|---|---|---|---|---|
| 4.1 | **5, 48** | `generateTicketNumber` (`storage.ts:2261`): trocar `COUNT(*)+1` por SEQUENCE diária ou sufixo `crypto.randomUUID().slice(0,4)`; ou retry no 23505 como já existe em `createReferralLink` (`storage.ts:2657-2667`). Corrigir também o bug do `Date`: linhas 2266-2267 fazem `setHours` **duas vezes sobre o mesmo objeto**, então a janela do dia está errada. | 6 POSTs concorrentes em `/api/tickets` → 6× 201, zero 500. | 45 min |
| 4.2 | **51** | `app.param('id', ...)` validando `Number.isInteger(n) && n > 0` → 400. Cobre as ~15 rotas listadas de uma vez. | `GET /api/referrals/abc/conversations` → **400** (antes: 500 + stack no log, mascarando os erros reais do dia). | 30 min |
| 4.3 | **50** | `updateReferralLink` (`storage.ts:2725`) regenera o slug **sem sufixo**: quebra QR codes já impressos (cadastros perdem atribuição de promotor) e colide em 500. Tornar `linkToken` **imutável** — atualizar só `name` e `isActive`. | Editar o nome de um link → `SELECT slug` inalterado; `/ref/<slug-antigo>` continua funcionando. | 20 min |
| 4.4 | **46** | CPF sem dígito verificador e sem normalização: `529.982.247-25` e `52998224725` criam **duas contas** que sacam para o mesmo PIX. Adicionar `.transform(v=>v.replace(/\D/g,'')).refine(isValidCpf)` em `insertUserSchema` + normalizar em `createUser`. **[MIG]** migrar a base para só-dígitos antes de recriar a UNIQUE. | Cadastrar os dois formatos → segundo dá 400. `SELECT regexp_replace(cpf,'\D','','g') c, count(*) FROM users GROUP BY 1 HAVING count(*)>1` → zero. | 1 h |

⚠️ **4.4 é o único item com risco de migração destrutiva.** Se a base já tem CPFs em formatos mistos, a normalização pode colidir com a UNIQUE. **Rode o `SELECT ... HAVING count(*)>1` primeiro** e, se houver colisões, adie para depois do evento — validar o dígito verificador só nos cadastros **novos** já resolve 90% do problema hoje.

---

## RESUMO DE MIGRAÇÕES (`db/migrations/0001_evento_sebrae.sql`)

| Item | DDL | Precisa de limpeza antes? |
|---|---|---|
| 1.4 | 6 índices (`CONCURRENTLY`) | não |
| 2.2 | `withdrawal_requests.refunded_at` + unique parcial em `cash_flow` | **sim** — rodar `scripts/fix-duplicate-cashflow.ts` |
| 2.3 | unique funcional em `referrals` (placa normalizada) | **sim** — normalizar + resolver duplicatas manualmente |
| 2.5 | 3 CHECKs em `users` | **sim** — procurar saldos NaN e comissões fora do pool |
| 4.4 | normalizar `users.cpf` | **sim** — checar colisões (adiar se houver) |

**Armadilha do drizzle:** `npm run db:push` usa `--force` (`package.json:12`). Índices e constraints criados só em SQL serão **apagados** no próximo push. Declare tudo em `shared/schema.ts` também, ou congele o `db:push` até depois do evento.

---

## MUDANÇAS VISÍVEIS PARA O USUÁRIO (avise o time antes do evento)

1. Comprovante acima de ~1,5 MB e formato que não seja imagem → rejeitado (1.1). **O front hoje comprime para 5 MB (`admin-referrals-detailed.tsx:2412`) — precisa baixar para ~1,5 MB no mesmo deploy, senão os analistas travam.**
2. Analista sem `edit_referral_status` perde a edição de status/dono/comissão pela tela de detalhe (2.4).
3. Transições de saque fora da máquina de estados → 400 com mensagem; `paid` vira irreversível (2.2).
4. `indicador_nivel_1` não converte mais o próprio lead (2.6).
5. Tela de duplicidade mostra só primeiro nome + estado do dono (3.2).
6. Export de Excel exige filtro de período (1.4e).
7. Front precisa refazer fetch ao receber evento do WebSocket, em vez de usar o objeto do evento (1.5).
8. `/api/tickets` passa a devolver **os tickets do usuário** — quem via a lista vazia vai ver os próprios chamados (0.3).

---

## SEQUENCIAMENTO SUGERIDO PARA HOJE

- **Manhã (0-2 h):** Bloco 0 inteiro + 1.1 + 1.2. Deploy. São ~5 arquivos, risco baixo, e tiram o sistema do estado "qualquer anônimo vira admin / qualquer um derruba o processo".
- **Manhã (2-4 h):** 1.3 + 1.5 + migrações do 2.3. Deploy.
- **Tarde (4-9 h):** 2.1 (o núcleo) e 2.2 em paralelo por pessoas diferentes — tocam arquivos próximos mas métodos distintos. Ambos exigem o `updateUserBalance(exec)` do item 1.3, então **1.3 é pré-requisito dos dois**.
- **Tarde (9-11 h):** 2.4 + 2.5 + 1.4 (paginação do analista, no mínimo os itens a/b).
- **Se sobrar:** 2.6, 2.7, Bloco 3, Bloco 4.

**Se você só puder fazer três coisas:** 0.1 (takeover admin), 2.1 (duplo crédito de comissão) e 1.1+1.3 (o que faz o cadastro do evento parar). Nessa ordem.

---

## Achados confirmados (detalhe)

### CRITICO

#### Crédito de comissão sem transação nem guarda de status: duplo clique paga a comissão duas vezes

**Arquivo:** `server/storage.ts:1308`  |  **Categoria:** race-condition-dinheiro

updateReferralStatus faz read-modify-write clássico: lê a indicação (linha 1312), calcula previousStatus/previousCommission* (1317-1319, 1367), credita os saldos com updateUserBalance (1467-1482) e só depois grava o novo status/comissão na indicação (linha 1541). Não há db.transaction() e o UPDATE final não tem guarda de estado (é `where eq(referrals.id, id)`, sem `AND status = previousStatus`). Duas execuções concorrentes do mesmo PATCH leem o mesmo previousStatus e ambas calculam a mesma diferença positiva de comissão. Como updateUserBalance usa `balance + X` (atômico), os dois incrementos se somam — o dinheiro é criado em dobro enquanto a indicação continua registrando uma única comissão. A rota (server/routes.ts:1813) não tem nenhuma proteção adicional. Além do duplo crédito, há inconsistência em falha parcial: se o processo cair entre a linha 1482 (saldos já creditados) e a 1541 (status ainda 'pending'), o indicador fica com saldo sem indicação validada correspondente, e uma nova validação credita de novo.

**Cenário de falha:** Indicação #500 com status 'pending', indicador com commissionValidated padrão. O analista clica duas vezes em "Validar" (ou o cliente faz retry por timeout na rede do evento). Requisição A e B chegam com ~50ms de diferença. Ambas leem previousStatus='pending', previousCommissionIndicator=0, calculam commissionDifferenceIndicator=+3 e commissionDifferencePromoter=+1. Resultado: indicador com saldo R$6 e promotor R$2 para UMA indicação; referrals.commission_indicator gravado como 3.00. O caixa paga R$8 por um lead de R$4. O mesmo vale para 'converted' (linhas 1384-1409): dois cliques somam +50 duas vezes ao previousCommissionIndicator lido, gerando R$100 para o indicador.

**Correção sugerida:** Envolver todo o método em db.transaction(tx) e tornar a mudança de status condicional: `const rows = await tx.update(referrals).set(updateData).where(and(eq(referrals.id, id), eq(referrals.status, previousStatus))).returning()`. Se rows.length === 0, abortar (outra requisição já mudou o status) sem tocar em saldo. Fazer os updateUserBalance dentro da MESMA tx (passando tx em vez do db global), depois do UPDATE condicional ter confirmado a transição.

#### updateWithdrawalStatus: idempotência por leitura prévia não protege contra concorrência — pagamento duplicado no caixa e devolução dupla de saldo

**Arquivo:** `server/storage.ts:2029`  |  **Categoria:** idempotencia

O método lê o saque (2031), compara `currentWithdrawal.status === status` para "prevenir processamento duplicado" (2040-2049) e depois faz o UPDATE sem guarda (2067-2070, `where eq(id)` apenas). Entre a leitura e a escrita não há transação nem bloqueio, então a checagem de idempotência é ineficaz sob concorrência. Os efeitos colaterais monetários vêm depois: em 'rejected' devolve o valor ao saldo (2076) e em 'paid' incrementa totalEarnings (2097) e cria a saída no fluxo de caixa (2101-2107). A existência de scripts/fix-duplicate-cashflow.ts (que agrupa cash_flow por relatedWithdrawalId e remove duplicatas de 'Pagamento de saque') confirma que esse duplo efeito já ocorreu em produção.

**Cenário de falha:** Admin marca o saque #77 (R$300) como 'paid' e a tela não responde; ele clica de novo. A e B leem status='approved', as duas passam pelo teste de idempotência, as duas fazem UPDATE e as duas executam updateUserTotalEarnings(+300) e createCashFlowEntry(outflow 300). Resultado: totalEarnings do usuário inflado em R$600 e duas saídas de R$300 no fluxo de caixa para um único pagamento — o caixa da empresa passa a mostrar R$300 a menos do que realmente saiu. No caso 'rejected' o efeito é pior: updateUserBalance(+300) roda duas vezes e o usuário ganha R$300 do nada, imediatamente sacáveis.

**Correção sugerida:** Trocar a checagem por um UPDATE condicional dentro de transação: `const [upd] = await tx.update(withdrawalRequests).set(updateData).where(and(eq(withdrawalRequests.id, id), ne(withdrawalRequests.status, status))).returning(); if (!upd) return currentWithdrawal;` — só executa devolução de saldo / totalEarnings / cash flow se o UPDATE realmente transicionou a linha, tudo na mesma tx. Adicionalmente, criar índice único parcial em cash_flow(related_withdrawal_id) where type='outflow' para tornar a saída duplicada impossível no banco.

#### updateReferralStatus credita saldo fora de transação e sem lock: duplo crédito da mesma indicação

**Arquivo:** `server/storage.ts:1473`  |  **Categoria:** concorrencia-dinheiro

updateReferralStatus lê o estado anterior da indicação (linhas 1324-1334: previousStatus, previousCommissionIndicator/Promoter/Supervisor), calcula o delta (1467-1469) e JÁ APLICA os UPDATEs de saldo (1473-1498) ANTES de gravar o novo status da indicação (db.update(referrals) só na linha 1556). Não há db.transaction(), não há SELECT ... FOR UPDATE na indicação, e não há guarda de idempotência de status (ao contrário de updateWithdrawalStatus, que ao menos tem o early-return da linha 2047). Cada updateUserBalance é atômico isoladamente (sql`balance + ${amount}`), mas o par leitura-do-estado + escrita-do-estado não é. Duas requisições concorrentes sobre a MESMA indicação leem o mesmo previousStatus e ambas creditam o delta inteiro. E se a escrita da linha 1556 falhar (timeout de rede/pool esgotado — cenário garantido com 2000 pessoas no mesmo WiFi), os saldos já foram alterados e a indicação continua com o status antigo, de modo que o retry credita tudo de novo.

**Cenário de falha:** Indicação #500 está 'pending'. O analista clica duas vezes em 'Validar' (ou o front reenvia por timeout). Req A e Req B entram em paralelo: ambas leem previousStatus='pending', previousCommissionIndicator=0, previousCommissionPromoter=0. Ambas calculam commissionDifferenceIndicator=+3 e commissionDifferencePromoter=+1 e executam 'balance = balance + 3' / 'balance = balance + 1'. Resultado: o indicador recebe R$6,00 e o promotor R$2,00 por UM único lead (pool R$4 virou R$8), enquanto a linha da indicação grava commissionIndicator='3.00'. O ledger (referrals.commission*) e o saldo (users.balance) divergem permanentemente e o dinheiro extra é sacável. Com ~50 analistas validando em rajada no dia do SEBRAE, isso acontece dezenas de vezes.

**Correção sugerida:** Envolver todo o updateReferralStatus em db.transaction() e, dentro dela, reler a indicação com SELECT ... FOR UPDATE (tx.select().from(referrals).where(eq(referrals.id,id)).for('update')) antes de calcular previousStatus/previousCommission*. Fazer o UPDATE da indicação (status + commission*) e os UPDATEs de saldo na MESMA transação, e gravar a indicação ANTES dos saldos. Adicionar early-return quando referral.status === status (como já existe em updateWithdrawalStatus:2047), e idealmente um UPDATE condicional 'WHERE id = ? AND status = previousStatus' com rowCount 0 => abortar.

#### updateWithdrawalStatus não tem máquina de estados: estorno duplicado e saque pago que volta para o saldo

**Arquivo:** `server/storage.ts:2080`  |  **Categoria:** duplicacao-dinheiro

updateWithdrawalStatus só bloqueia a transição para o MESMO status (linha 2047). Qualquer outra transição é livre: PATCH /api/admin/withdrawals/:id (server/routes.ts:2490-2509) aceita qualquer um de pending/approved/paid/rejected/retido em qualquer ordem. O bloco 'rejected' (2080-2094) devolve o valor ao saldo com updateUserBalance(+amount) TODA vez que o status entra em 'rejected', e o bloco 'paid' (2100-2115) cria a saída de caixa e soma totalEarnings TODA vez que entra em 'paid'. Como o saldo só é debitado uma única vez, na criação (server/routes.ts:1281), qualquer ida-e-volta de status vira dinheiro criado. Não há campo tipo 'refundedAt' nem verificação do status anterior.

**Cenário de falha:** Saque #77 de R$300,00 (saldo do usuário já foi para 0 na criação). (a) Admin marca 'rejected' -> saldo volta a R$300. Percebe que errou de linha e marca 'approved' -> nada acontece com o saldo. Depois marca 'rejected' de novo -> saldo vira R$600,00. O usuário ganhou R$300 do nada e pode sacar. (b) Pior: admin marca 'paid' (PIX de R$300 realmente enviado, cashFlow -300, totalEarnings +300) e em seguida marca 'rejected' (ex.: PIX voltou, ou clique errado) -> saldo volta a R$300 sem nenhuma entrada de caixa compensatória. O usuário recebeu R$300 no PIX E ficou com R$300 sacáveis; a empresa pagou duas vezes.

**Correção sugerida:** Implementar máquina de estados explícita (pending->approved|rejected|retido; approved->paid|rejected; retido->pending|rejected; paid->terminal) e rejeitar transições fora dela com 400. Tornar o estorno idempotente: adicionar coluna refunded_at/refunded_amount em withdrawal_requests e só creditar o saldo se ainda for NULL, tudo dentro de uma db.transaction() junto com o UPDATE do status. Proibir sair de 'paid' para qualquer outro status.

#### Analista pode gravar commissionIndicator/commissionPromoter arbitrários na indicação e envenenar o delta da próxima transição

**Arquivo:** `server/routes.ts:2132`  |  **Categoria:** brecha-autorizacao-dinheiro

PATCH /api/referrals/:id aceita commissionIndicator e commissionPromoter direto do body (routes.ts:2066, 2132-2133) para admin OU analista (isAdminOrAnalyst, routes.ts:2061), sem nenhuma validação de faixa contra os pools R$4/R$60. storage.updateReferral grava esses campos crus na linha 1749 (e 1750) SEM tocar em users.balance. Como updateReferralStatus calcula o delta a partir de referral.commissionIndicator/Promoter/Supervisor (storage.ts:1325-1326, 1374, 1467-1469), esse valor gravado à mão vira a base da próxima reversão/ajuste. A guarda da linha 1796 (status diferente => delega para updateReferralStatus) é contornada trivialmente usando DUAS requisições separadas.

**Cenário de falha:** Indicação #900 está 'validated' com commissionIndicator='3.00' (o indicador tem R$3 de saldo). Requisição 1: PATCH /api/referrals/900 com body {"commissionIndicator": "-5000.00"} — nenhum saldo muda, mas a linha da indicação passa a valer -5000. Requisição 2: PATCH /api/referrals/900/status com {"status":"rejected"} — previousCommissionIndicator = -5000, finalCommissionIndicator = 0, commissionDifferenceIndicator = 0 - (-5000) = +5000,00. O saldo do indicador vira R$5.000,00 sacáveis, criados do nada, por um analista sem permissão de mexer em dinheiro. O ataque inverso (gravar '5000.00' e depois rejeitar) leva o saldo da vítima a -R$4.997,00.

**Correção sugerida:** Remover commissionIndicator/commissionPromoter da lista de campos aceitos em PATCH /api/referrals/:id (routes.ts:2066/2132-2133) e de storage.updateReferral (1749-1750). Comissão deve ser sempre derivada por updateReferralStatus. Se um ajuste manual for realmente necessário, criar rota exclusiva de admin que aplique o delta correspondente em users.balance na mesma transação e valide contra os pools.

#### Cadastro público /api/register-with-referral cria conta com role escolhido pelo atacante (admin)

**Arquivo:** `server/routes.ts:3895`  |  **Categoria:** escalacao_de_privilegio

A rota POST /api/register-with-referral não tem autenticação nem schema Zod. Ela pega `const { referralToken, userData } = req.body` e entrega `userData` cru para storage.createUserWithReferralAttribution (server/storage.ts:2816), que faz `...userData` e chama this.createUser (storage.ts:2881). Em storage.ts:223 o createUser monta o insert com `role: (userData.role || "indicador")` e em storage.ts:224-225 com `permissions: userData.permissions` e `analystLevel: userData.analystLevel`. A coluna `role` é `text("role")` (shared/schema.ts:56), sem constraint no banco, então qualquer string é aceita. Diferente de /api/register (server/auth.ts:166), que aplica insertUserSchema com allowlist e força `role: "indicador"`, aqui não há filtro nenhum. Também não há checagem de CPF/telefone duplicado nem validação cross-app, e o rate limiting de registro em server/security.ts:189 usa `app.use("/api/register", ...)` que casa apenas com /api/register e /api/register/*, NÃO com /api/register-with-referral — ou seja, a criação em massa também passa sem limite. Observação: a rota app.post("/api/register") em routes.ts:3867 é código morto (setupAuth registra a dela antes, em routes.ts:55), mas a de -with-referral não tem par em auth.ts e é a que realmente atende.

**Cenário de falha:** Um visitante anônimo, sem cookie de sessão, envia: POST /api/register-with-referral com body {"userData":{"username":"x@x.com","email":"x@x.com","password":"123456","fullName":"X","cpf":"00000000000","phone":"11999999999","pixKey":"x@x.com","city":"SP","state":"SP","zipCode":"01000-000","role":"admin","permissions":["manage_withdrawals","edit_referral_status"],"analystLevel":1}}. O servidor responde 201 e grava um usuário com role=admin. O atacante faz POST /api/login com essa credencial e passa a ter requireAdmin em todo o sistema: lê /api/admin/users (CPF, chave PIX, saldo de todos), aprova saques em PATCH /api/admin/withdrawals/:id, altera o caixa da empresa em /api/admin/companies/:id/cash-balance e apaga indicações. No dia do SEBRAE, com a URL pública divulgada, isso é tomada total do sistema por qualquer pessoa na rede.

**Correção sugerida:** Aplicar o mesmo allowlist do cadastro normal: `const parsed = insertUserSchema.parse(req.body.userData)` e chamar createUserWithReferralAttribution com `{...parsed, role: 'indicador', createdBy: undefined}`. Além disso, replicar as checagens de CPF/username duplicado e validateUserDuplicates que existem em auth.ts:172-202, e trocar o rate limiter para `app.use(["/api/register", "/api/register-with-referral"], ...)` em server/security.ts:189. Por defesa em profundidade, remover `role`, `permissions` e `analystLevel` da leitura do cliente dentro de storage.createUser (aceitar esses campos só via um parâmetro separado e explícito do servidor).

#### Crédito de comissão sem transação nem lock: dois PATCH simultâneos pagam a mesma indicação duas vezes

**Arquivo:** `server/storage.ts:1459`  |  **Categoria:** concorrencia-dinheiro

updateReferralStatus() lê o estado anterior (getReferralById na linha 1312), calcula a diferença de comissão e credita saldo com updateUserBalance() nas linhas 1467-1482, e só DEPOIS grava o novo status (db.update na linha 1541). Não há transação, não há SELECT ... FOR UPDATE e não há guarda de idempotência sobre o status atual (diferente de updateWithdrawalStatus, que ao menos tenta checar). Além disso, se o UPDATE da linha 1541 falhar, os saldos já foram creditados e não há rollback.

**Cenário de falha:** Indicação #500 está 'pending'. Dois analistas (ou o mesmo analista com duplo clique / retry do front) chamam PATCH /api/referrals/500/status com status='validated' ao mesmo tempo. Ambos leem previousStatus='pending' e previousCommissionIndicator=0, ambos calculam commissionDifferenceIndicator=+3 e commissionDifferencePromoter=+1, e ambos executam 'balance + 3' / 'balance + 1'. Resultado: indicador com R$6 e promotor com R$2 por UM lead, enquanto referrals.commission_indicator grava 3.00. O caixa nunca fecha. No dia do SEBRAE, com fila de validação e rede instável (retry automático do cliente), isso ocorre em escala.

**Correção sugerida:** Envolver todo o bloco (leitura do referral, cálculo, updates de saldo e update do referral) em db.transaction, começando com um SELECT ... FOR UPDATE na linha do referral (ex.: tx.execute(sql`SELECT id FROM referrals WHERE id = ${id} FOR UPDATE`)). Adicionar guarda de idempotência: se previousStatus === status, retornar sem creditar nada. Fazer o UPDATE de status com condição de estado esperado (WHERE id = ? AND status = ?) e só creditar se rowCount === 1.

#### /api/register-with-referral aceita req.body cru: qualquer um se cadastra como admin e define a própria comissão

**Arquivo:** `server/routes.ts:3895`  |  **Categoria:** autorizacao

A rota pública POST /api/register-with-referral pega 'userData' direto do corpo (linha 3897) e o repassa a storage.createUserWithReferralAttribution → storage.createUser, que grava role, permissions, analystLevel, commissionValidated, commissionConverted, promoterId, analystId, supervisorId e teamSupervisorId a partir do objeto recebido (storage.ts:223-232). Nenhum schema Zod é aplicado. O allowlist adicionado em insertUserSchema não protege esta rota, porque ela nunca chama o schema. A coluna users.role é text sem CHECK, então qualquer string é aceita. Observação adicional: o rate limit de registro é registrado com app.use('/api/register', ...) (security.ts:189) e NÃO casa com '/api/register-with-referral' (o próximo caractere é '-', não '/'), então esta rota também está sem limite de criação de contas.

**Cenário de falha:** curl -X POST /api/register-with-referral -d '{"userData":{"username":"x@x.com","email":"x@x.com","password":"123456","fullName":"X","cpf":"11111111111","phone":"11999999999","pixKey":"x@x.com","role":"admin","permissions":["manage_withdrawals"]}}' → conta admin criada sem autenticação. Variante financeira: role='indicador' com commissionValidated='4.00' e commissionConverted='60.00' → o usuário passa a receber o pool inteiro em cada lead e o promotor fica com 0 (ou negativo). Com o app exposto no evento, um único POST derruba a integridade de todo o sistema.

**Correção sugerida:** Aplicar insertUserSchema.parse(req.body.userData) na rota e forçar role='indicador' e createdBy=undefined no servidor, exatamente como já é feito em server/auth.ts:169-210. Adicionar o rate limit também para este path (usar app.use(['/api/register','/api/register-with-referral'], ...)).

#### Placas repetidas na mesma requisição geram N indicações idênticas e N x comissão

**Arquivo:** `server/routes.ts:559`  |  **Categoria:** duplicacao-dinheiro

createReferralSchema.licensePlates é um z.array(...).min(1).max(3) sem qualquer verificação de unicidade (shared/schema.ts:541). Na rota, o loop das linhas 481-491 checa cada placa apenas contra o BANCO (checkDuplicateReferralWithOwner), nunca contra as outras placas do mesmo payload. Em seguida, o loop da linha 559 cria uma indicação SEPARADA para cada item do array. Não existe UNIQUE em referrals.license_plate no schema (shared/schema.ts:106).

**Cenário de falha:** O indicador envia POST /api/referrals com {"licensePlates":["ABC1D23","ABC1D23","ABC1D23"]}. Nenhuma delas existe no banco, então as três passam na checagem de duplicidade. São criadas 3 indicações com a mesma placa, mesmo nome e mesmo telefone. Quando o analista valida as três, o indicador recebe 3 x R$3 e, se convertidas, 3 x R$50 por um único carro. O mesmo vale para a corrida entre requisições concorrentes: dois indicadores cadastrando a mesma placa ao mesmo tempo passam ambos no check-then-act, porque não há constraint no banco.

**Correção sugerida:** Em shared/schema.ts:541 adicionar .refine(p => new Set(p).size === p.length, 'Placas duplicadas na mesma indicação') após o transform. E criar índice único no banco: CREATE UNIQUE INDEX referrals_license_plate_uniq ON referrals (upper(regexp_replace(license_plate,'[^A-Za-z0-9]','','g'))), tratando o erro 23505 na rota como 400 'Placa duplicada'.

#### parseFloat sem verificação de NaN grava 'NaN' em coluna numeric e corrompe o saldo permanentemente

**Arquivo:** `server/routes.ts:2927`  |  **Categoria:** validacao-numerica

Em PATCH /api/promoter/users/:id/commissions o valor é lido com parseFloat (linha 2928) e validado com 'if (val < 0 || val > POOL_VALIDATED)'. Com NaN, as DUAS comparações são false, então a validação passa. Na linha 2975 grava-se parseFloat(x).toFixed(2) = a string 'NaN'. O tipo numeric do Postgres ACEITA 'NaN' como valor válido. O mesmo padrão existe em POST /api/promoter/indicators (linhas 2785-2790 e 2817-2818) e POST /api/promoter/supervisors (linhas 2855-2869).

**Cenário de falha:** Promotor envia PATCH /api/promoter/users/42/commissions com {"commissionValidated":"3,50"} (vírgula, formato brasileiro — parseFloat('3,50') retorna 3, ok) ou {"commissionValidated":"abc"} / campo vazio → parseFloat = NaN → passa → users.commission_validated = NaN. Na primeira validação de lead desse indicador, storage.ts:1349 faz parseFloat('NaN') = NaN, indTake = NaN, commissionDifferenceIndicator = NaN, 'NaN !== 0' é true, e updateUserBalance executa 'balance + NaN' → users.balance vira NaN de forma irreversível. O usuário nunca mais consegue sacar (parseFloat('NaN') < amount é false, então ele passa na checagem de saldo e saca qualquer valor).

**Correção sugerida:** Validar com Zod (z.coerce.number().finite().min(0).max(POOL)) em vez de parseFloat solto, ou no mínimo rejeitar com 400 quando !Number.isFinite(val). Adicionar CHECK (balance = balance) — que falha para NaN — ou CHECK (balance >= 0) em users.balance e commission_validated/commission_converted.

### ALTO

#### Placa duplicada bloqueada só na aplicação, sem índice único: envio concorrente cria duas indicações da mesma placa e paga a comissão em dobro

**Arquivo:** `server/routes.ts:483`  |  **Categoria:** race-condition-dinheiro

POST /api/referrals consulta duplicatas de placa (linha 483, checkDuplicateReferralWithOwner) e, se nada for encontrado, insere as indicações num laço mais adiante (linhas 559-572). Entre a consulta e o INSERT não há transação nem restrição de unicidade: db/migrations/0000_quick_emma_frost.sql só declara UNIQUE em companies.name, support_tickets.ticket_number, users.username/cpf/email — não há índice único em referrals.license_plate (nem em referral_plates.plate). A regra de negócio mais importante contra fraude/pagamento duplicado ("uma placa = um lead") existe apenas como check-then-act. O laço de criação também não é transacional nem idempotente: falha no meio deixa parte das placas criadas e o retry do cliente recria as anteriores.

**Cenário de falha:** No evento, o indicador cadastra a placa ABC1D23, a resposta demora no WiFi lotado e ele toca em "Enviar" de novo (ou o app faz retry). As duas requisições rodam checkDuplicateReferralWithOwner('ABC1D23') antes de qualquer INSERT, ambas recebem lista vazia e ambas inserem. Ficam duas indicações da mesma placa, do mesmo indicador. Quando o analista valida as duas (ou valida e converte), o sistema paga R$4 + R$4 (ou R$60 + R$60) por um único lead real. O mesmo vale para dois indicadores diferentes submetendo a mesma placa no mesmo instante — o dono da placa fica indefinido e ambos são pagos.

**Correção sugerida:** Criar índice único no banco (ex.: `CREATE UNIQUE INDEX referrals_plate_uniq ON referrals (UPPER(REPLACE(license_plate,'-','')))`, com filtro se status cancelado deve ser ignorado) e tratar o erro 23505 na rota devolvendo a mesma mensagem de "Placa duplicada" hoje produzida em memória. Envolver o laço de múltiplas placas em uma db.transaction para que ou todas as placas do envio entrem ou nenhuma.

#### createUserWithReferralAttribution usa o db global dentro de db.transaction: exaustão do pool e usuário criado fora da transação

**Arquivo:** `server/storage.ts:2816`  |  **Categoria:** transacao-incorreta

O método abre `db.transaction(async (tx) => ...)` (2818) e usa `tx` para ler o link e incrementar registrations (2826, 2857-2861), mas chama `this.createUser(...)` (2881) e `this.logUserAction(...)` (2885) que operam no `db` GLOBAL (storage.ts:241 e 2309). Duas consequências. (1) Deadlock/esgotamento do pool: cada transação segura uma conexão do pool (db/index.ts:42, max = DATABASE_POOL_MAX = 10 no .env) e, de dentro dela, pede uma SEGUNDA conexão do mesmo pool para o INSERT do usuário; com 10 cadastros simultâneos todas as conexões ficam presas esperando uma conexão que nunca será liberada, até estourar connectionTimeoutMillis=10s (db/index.ts:44). Pior: createUser executa scrypt (server/auth.ts:25-33) segurando a conexão da transação. (2) O usuário é gravado FORA da transação: se qualquer passo posterior falhar, o ROLLBACK desfaz o incremento de registrations mas o usuário permanece.

**Cenário de falha:** No SEBRAE, os promotores divulgam links /ref/<token> e centenas de pessoas se cadastram ao mesmo tempo via POST /api/register-with-referral. Com mais de 10 cadastros simultâneos, todas as conexões do pool ficam ocupadas por transações abertas esperando conexão para o INSERT do usuário; após 10s todas falham com timeout e a rota devolve 500 "Erro ao cadastrar usuário" — o cadastro do evento inteiro trava em ondas. No caso em que createUser conclui e o logUserAction seguinte falha, a transação faz rollback: o usuário existe no banco, mas a pessoa recebe erro 500, tenta de novo e recebe "Este CPF já está cadastrado" (routes.ts:3911) sem conseguir entrar.

**Correção sugerida:** Refatorar createUser e logUserAction para aceitarem um executor opcional (`tx ?? db`) e passar `tx` nas chamadas de dentro da transação, garantindo uma única conexão por requisição. Mover o hash da senha (scrypt) para ANTES do BEGIN, para não segurar a conexão durante o custo de CPU. Aumentar DATABASE_POOL_MAX para o dia do evento (ex.: 30-50, respeitando o max_connections do Postgres).

#### Marcar 'converted' novamente apaga o pool validado (R$4) do lead

**Arquivo:** `server/storage.ts:1407`  |  **Categoria:** rateio-comissao

No ramo status==='converted', o bônus só é somado sobre o que já existia quando previousStatus === 'validated' (linha 1395-1406). Em qualquer outro previousStatus cai no else da linha 1407, que ZERA a base e define newCommissionIndicator = indBonusTake (apenas o pool de R$60), descartando os R$4 do pool de validação que já haviam sido creditados. Como a rota PATCH /api/referrals/:id/status (server/routes.ts:1813) não bloqueia re-envio do mesmo status e updateReferralStatus não tem early-return para status idêntico, reprocessar 'converted' produz delta negativo.

**Cenário de falha:** Lead sem supervisor, comissões padrão. (1) 'validated': commissionIndicator=3.00, commissionPromoter=1.00; saldos +3 / +1. (2) 'converted': previousStatus='validated' -> indicador 3+50=53.00, promotor 1+10=11.00; saldos +50 / +10. Total do lead = R$64 = pool 4 + pool 60. Correto. (3) O analista reabre a indicação para anexar outro comprovante ou o front reenvia por timeout e o status 'converted' é gravado de novo. Agora previousStatus='converted' -> cai na linha 1407: newCommissionIndicator=50.00, newCommissionPromoter=10.00. commissionDifferenceIndicator = 50-53 = -3,00 e Promoter = 10-11 = -1,00. O indicador PERDE R$3,00 e o promotor R$1,00 sem que nada tenha mudado de estado. O mesmo ocorre em 'paid'->'converted' e em 'converted'->'rejected'->'converted' (volta com 50 em vez de 53).

**Correção sugerida:** Fazer o cálculo do 'converted' ser absoluto e não incremental: converted = (parcela de validação) + (parcela de conversão), sem depender de previousStatus nem de previousCommission*. Ex.: newCommissionIndicator = indTakeValidated + indBonusConverted (3 + 50 por padrão). Adicionar também early-return quando referral.status === status.

#### Comissão do supervisor pode ficar negativa (alocação - take do indicador), debitando o saldo do supervisor

**Arquivo:** `server/storage.ts:1383`  |  **Categoria:** rateio-comissao

A parcela do supervisor é calculada como 'supervisorAlloc - indTake' (linha 1383 no validated, 1398 no bônus de conversão, 1410 no converted direto). Não há clamp em zero nem validação de que indTake <= supervisorAlloc no momento do pagamento. A invariante é garantida apenas por validações de rota, e elas têm buraco: em POST /api/promoter/indicators (server/routes.ts:2800-2805) a comparação 'commissionValidated > supAllocValidated' só roda quando commissionValidated !== undefined. Se o promotor cadastrar o indicador sob um supervisor SEM informar a comissão customizada, o campo fica NULL, o cálculo cai no default 3 (linha 1378) / 50 (linha 1393) e nada nunca comparou esses defaults com a alocação do supervisor. O mesmo vale para indicadores pré-existentes que recebem teamSupervisorId depois (PATCH /api/users/:id/assign, routes.ts:3518).

**Cenário de falha:** Promotor cria o supervisor S com commissionValidated='2.00' e commissionConverted='30.00'. Em seguida cria o indicador I via POST /api/promoter/indicators com teamSupervisorId=S e SEM enviar commissionValidated/commissionConverted (campos opcionais na rota). Lead de I é validado: indTake = 3 (default, pois indicadorCustomValidated é null), newCommissionSupervisor = 2 - 3 = -1,00, newCommissionPromoter = 4 - 2 = 2,00. O saldo do supervisor é debitado em R$1,00 por lead validado da equipe dele. Com 200 leads o supervisor fica com -R$200,00. Na conversão fica muito pior: supBonus = 30 - 50 = -20,00 por lead convertido. Caso extremo: supervisor criado com commissionValidated='0.00' (aceito por routes.ts:2855, pois 0 >= 0) -> supervisor = 0 - 3 = -3,00 e promotor = 4 - 0 = 4,00, ou seja, o promotor embolsa o pool inteiro e o supervisor paga os R$3 do indicador do próprio bolso.

**Correção sugerida:** No cálculo, derivar todas as parcelas de forma não-negativa e conservativa: validar antes de creditar que indTake <= supervisorAlloc <= POOL e abortar (ou logar e cair no fluxo sem supervisor) se a hierarquia estiver inconsistente. Nunca permitir parcela negativa — usar Math.max(0, ...) apenas depois de recalcular o restante para que a soma continue igual ao pool. Nas rotas, aplicar a validação contra a alocação do supervisor também quando a comissão do indicador é omitida (comparando com o default 3/50) e revalidar em PATCH /api/users/:id/assign quando um teamSupervisorId é atribuído.

#### Envio de SMS bloqueia a resposta HTTP e não tem timeout algum

**Arquivo:** `server/routes.ts:582`  |  **Categoria:** io-externo-bloqueante

`sendSMS` (server/sms-service.ts:58) faz `await fetch(...)` para a API da Comtele sem AbortController/timeout — o default do undici deixa a requisição pendurada por até 300s. E ele é aguardado dentro do caminho da requisição em todos os pontos quentes: criação de lead (routes.ts:582), criação de indicador pelo promotor (routes.ts:2714), pelo analista (routes.ts:2668), supervisor (routes.ts:2828, 2881, 3051) e, pior, na solicitação de saque, onde há um laço sequencial que manda um SMS por admin (routes.ts:1299-1309) antes de responder.

**Cenário de falha:** 2.000 cadastros no mesmo dia disparam 2.000 SMS de boas-vindas. A Comtele começa a throttlar ou fica lenta e passa a levar 30s por chamada. Como o `await` está no caminho da resposta, cada POST /api/promoter/indicators fica pendurado 30s segurando um socket e o handler. O front assume timeout e o operador reenvia o cadastro, dobrando a carga. Com 5 admins cadastrados, cada POST /api/withdrawals leva 5×30s = 150s. O event loop não trava, mas as requisições pendentes se acumulam até esgotar sockets/memória e nenhuma resposta sai mais.

**Correção sugerida:** Nunca aguardar SMS na resposta: disparar em background (`void sendSMS(...).catch(log)`) ou enfileirar. Adicionar `signal: AbortSignal.timeout(5000)` no fetch de sms-service.ts:58. No laço de admins, usar Promise.allSettled em vez de sequencial, também fora do caminho da resposta.

#### express.json com limite de 50mb aplicado globalmente, antes de qualquer autenticação

**Arquivo:** `server/index.ts:76`  |  **Categoria:** dos-memoria

server/index.ts:76-77 registra `express.json({ limit: '50mb' })` e `express.urlencoded({ limit: '50mb' })` para TODAS as rotas, incluindo /api/login e /api/register, que são públicas. O body-parser bufferiza os 50MB inteiros em memória antes de qualquer validação, e o JSON.parse subsequente é síncrono. O limite existe só por causa dos comprovantes em base64 (PATCH /api/referrals/:id/status), e nem esse ponto valida tamanho no servidor — o teto de 5MB só existe no cliente (admin-referrals-detailed.tsx:2412).

**Cenário de falha:** No WiFi do evento, qualquer pessoa (ou um cliente com bug de retry) envia 10 POSTs de 50MB para /api/login: 500MB de buffers alocados de uma vez em um processo Node único, mais ~1s de event loop travado por JSON.parse de cada corpo. O processo cai por OOM ou fica irresponsivo, derrubando cadastro, validação e saques ao mesmo tempo. Não é preciso estar autenticado.

**Correção sugerida:** Baixar o limite global para algo como 256kb e aplicar `express.json({ limit: '8mb' })` apenas nas rotas que aceitam comprovante (PATCH /api/referrals/:id/status e PATCH /api/referrals/:id), depois do requireAuth. Validar o tamanho de `paymentProof` no servidor.

#### Broadcast WebSocket envia o referral inteiro (com comprovante base64) para todos os clientes, sem autenticação

**Arquivo:** `server/routes.ts:1868`  |  **Categoria:** amplificacao-rede

O WebSocketServer em routes.ts:3936 aceita qualquer conexão em /ws sem autenticação, sem heartbeat e sem limite de clientes, guardando todas num Set. `broadcastUpdate` (routes.ts:3957-3965) serializa o objeto recebido e envia para todos. Em routes.ts:1868 o que é transmitido é `result`, ou seja, a linha completa retornada por updateReferralStatus — incluindo `paymentProof` em base64. Mesmo padrão em routes.ts:2197, 2285 e 2383.

**Cenário de falha:** Um analista converte um lead anexando um comprovante de 5MB (~6,8MB em base64). O broadcast serializa esses 6,8MB e chama ws.send para cada cliente conectado. Com 60 abas de admin/analista abertas, o processo bufferiza ~400MB de saída de uma vez, num único evento de conversão. Como o /ws é público, qualquer pessoa no WiFi do evento pode abrir centenas de conexões e multiplicar isso — e ainda receber os comprovantes de pagamento sem estar logada.

**Correção sugerida:** Autenticar o upgrade do WebSocket (validar o cookie de sessão), limitar conexões por IP, adicionar ping/pong com terminate. No broadcast, enviar apenas um payload mínimo `{ id, status, updatedAt }` e deixar o cliente invalidar a query, em vez de trafegar a linha inteira.

#### Endpoint público /api/public/company-metrics carrega todos os leads da empresa (duas vezes) sem rate limit

**Arquivo:** `server/routes.ts:1038`  |  **Categoria:** dos-sem-autenticacao

GET /api/public/company-metrics/:tokenOrId (routes.ts:1011) não tem autenticação nem rate limiting. Ele chama `getReferralsByCompanyId` (storage.ts:1183), que faz findMany sem LIMIT com `with: { user, promoter, company }`, e quando há filtro `?month=` chama a MESMA função de novo na linha 1090 — dobrando o custo. Toda a agregação é feita em JavaScript sobre o array completo. O `tokenOrId` numérico funciona por ID (routes.ts:1023), então nem o token secreto é necessário.

**Cenário de falha:** Durante a apresentação, alguém (ou um bot varrendo a URL pública do dashboard) faz 20 requisições a /api/public/company-metrics/1?month=2026-07. Cada uma carrega duas vezes os ~30.000 referrals da empresa com os objetos de usuário aninhados. São 40 varreduras completas simultâneas, o pool de 10 conexões satura e o event loop fica preso montando arrays de centenas de MB. O cadastro dos indicadores para de responder por causa de uma rota pública de vitrine.

**Correção sugerida:** Trocar a agregação em JS por COUNT/SUM em SQL com GROUP BY status e filtro de data no WHERE (uma única consulta, sem trazer linhas). Eliminar a segunda chamada da linha 1090. Aceitar apenas o publicToken (não o ID) e aplicar rate limit + cache de curta duração nessa rota.

#### Paginação do analista é feita em JavaScript depois de carregar a tabela inteira

**Arquivo:** `server/routes.ts:353`  |  **Categoria:** paginacao-falsa

Em GET /api/referrals, o ramo `role === 'analista'` (routes.ts:318-361) chama `getAllReferrals()` ou `getReferralsBySupervisor()` e só depois aplica filtro de status (linha 335), busca textual (linha 341) e `slice(offset, offset+limit)` (linha 353). Ou seja: o parâmetro `?page=1&limit=10` não reduz nem o trabalho do banco nem a memória do processo — a tabela inteira (com paymentProof) é materializada para devolver 10 linhas. Mesmo padrão em /api/analyst/stats (routes.ts:1567-1575), que carrega todos os usuários e todos os referrals só para contar.

**Cenário de falha:** Analista pagina a lista de leads durante o evento. Cada clique em 'próxima página' recarrega os 30.000 referrals no servidor para devolver 10. Com 4 analistas navegando, são 4 varreduras completas + 4 arrays gigantes vivos na heap por navegação, e o tempo por página cresce linearmente com o volume do dia até o processo cair.

**Correção sugerida:** Reutilizar o caminho já existente e correto: `getAllReferralsPaginated` (storage.ts:1098) com filtros de status e busca traduzidos para WHERE em SQL, exatamente como já é feito em getReferralsByUserIdPaginated (storage.ts:886). Em /api/analyst/stats, usar COUNT agregado como já faz getAdminStats (storage.ts:437).

#### GET /api/tickets usa o ID do usuário como ID do ticket e devolve o registro completo do dono, com hash de senha

**Arquivo:** `server/routes.ts:1328`  |  **Categoria:** idor_exposicao_de_dados

O handler chama `storage.getSupportTicketById(req.user!.id)` — passa o ID do USUÁRIO onde a função espera o ID do TICKET (server/storage.ts:2240 faz `where: eq(supportTickets.id, id)`). Não há nenhuma verificação de dono nesse caminho (diferente de /api/tickets/:id em routes.ts:1346, que checa ticket.userId). Pior: a query usa `with: { user: true, responses: { with: { user: true } } }` e a relation `user: one(users, ...)` (shared/schema.ts:427) seleciona TODAS as colunas de users — incluindo `password` (hash scrypt), `cpf`, `pixKey`, `balance`, `role`. O resultado é devolvido cru com res.json(tickets), sem o `const { password, ...rest }` que o resto do arquivo aplica.

**Cenário de falha:** O indicador de ID 42 (papel mais baixo do sistema) faz GET /api/tickets. O servidor devolve o ticket de ID 42 — que pertence a outra pessoa qualquer, possivelmente um admin — com o objeto `user` completo: hash da senha, CPF, chave PIX e saldo desse terceiro, mais todos os `responses` com o objeto `user` completo de cada respondente. Como os IDs são seriais e a resposta muda conforme o ID do usuário logado, basta criar contas (o cadastro é aberto) até cair no ID de um ticket de admin para extrair o hash da senha do admin e quebrá-lo offline. Nenhum papel especial é necessário: só estar logado.

**Correção sugerida:** Trocar por `storage.getSupportTicketsByUserId(req.user!.id)` (já existe em server/storage.ts:2254), que filtra por userId. E, em getSupportTicketById, substituir `user: true` por uma projeção explícita (`columns: { id: true, fullName: true, username: true, role: true }`) para que nenhum caminho da aplicação possa vazar hash de senha, CPF ou chave PIX via relation.

#### GET /api/analyst/analytics/users devolve todos os usuários sem remover o hash de senha

**Arquivo:** `server/routes.ts:1705`  |  **Categoria:** exposicao_de_dados

O handler termina com `return res.json(allUsers)` diretamente sobre o retorno de storage.getAllUsers() (server/storage.ts:304), que é `db.query.users.findMany({...})` sem projeção — traz a linha inteira, inclusive a coluna `password`. Todas as outras rotas equivalentes fazem o strip: /api/admin/users (routes.ts:1477), /api/analyst/users (routes.ts:1610), /api/metis-viewer/users (routes.ts:1771). Esta ficou de fora. A rota é liberada para qualquer `analista` que tenha a permissão `view_reports` (routes.ts:1693), permissão que é atribuída por padrão a analistas.

**Cenário de falha:** Um analista de nível 1 com view_reports (perfil comum de SDR, dado a pessoas contratadas para o evento) faz GET /api/analyst/analytics/users e recebe um JSON com o hash scrypt da senha de TODOS os usuários do sistema, incluindo o(s) admin(s), além de CPF, chave PIX, saldo e totalEarnings de cada um. Basta rodar um cracker offline sobre o hash do admin — ou, mais direto, usar CPF+chave PIX para fraude fora do sistema. Um analista demitido/temporário sai do evento com a base inteira.

**Correção sugerida:** Aplicar o mesmo strip usado nas rotas irmãs: `return res.json(allUsers.map(u => { const { password, ...rest } = u; return rest; }))`. Melhor ainda: mudar storage.getAllUsers() para nunca selecionar a coluna `password` (usar `columns: { password: false }` no findMany) e ter um getUserWithPasswordByUsername separado, usado só pelo LocalStrategy em server/auth.ts:121.

#### PATCH /api/referrals/:id permite a qualquer analista mudar status e reatribuir dono da indicação, movendo dinheiro sem a permissão edit_referral_status

**Arquivo:** `server/routes.ts:2055`  |  **Categoria:** autorizacao

A rota é registrada apenas com `requireAuth` e o gate é uma checagem inline de papel: `const isAdminOrAnalyst = req.user!.role === "admin" || req.user!.role === "analista"` (linha 2057) — nenhuma consulta a `permissions`, nenhuma checagem de analystLevel. Em seguida ela copia do body `status` (linha 2129), `userId` (linha 2128) e `commissionIndicator`/`commissionPromoter` (linhas 2132-2133) para updateData, sem schema Zod. Em storage.updateReferral, `if (updates.status !== undefined && updates.status !== currentReferral.status)` delega para updateReferralStatus (storage.ts:1781-1783), que credita saldo real (storage.ts:1467-1482); e `if (updates.userId !== undefined ...)` transfere a comissão de um usuário para outro com updateUserBalance (storage.ts:1763-1770). Isso contorna inteiramente o middleware requireStatusEditPermission (routes.ts:177-234) que protege a rota dedicada PATCH /api/referrals/:id/status, e também contorna o escopo do analista nível 3 (que na listagem só enxerga getReferralsBySupervisor, mas aqui pode agir sobre qualquer ID).

**Cenário de falha:** Um analista com `permissions: []` (portanto sem edit_referral_status; ele recebe 403 em PATCH /api/referrals/10/status) envia PATCH /api/referrals/10 com body {"status":"converted","paymentProof":"x"} e recebe 200 — o pool de R$60 é creditado. Pior variante: ele envia PATCH /api/referrals/10 com {"userId": <id de um indicador laranja que ele mesmo criou>}; storage.updateReferral debita a comissão do indicador original e credita no laranja (storage.ts:1767-1770), e ainda usa `updateUserBalance(updates.userId, valor, true)` que soma também em totalEarnings. O laranja saca via /api/withdrawals. Um analista nível 3, cujo escopo deveria ser só a equipe supervisionada, faz o mesmo em qualquer indicação do sistema iterando IDs.

**Correção sugerida:** Trocar a checagem inline por `requireStatusEditPermission`/`requireAnalystPermission("edit_referral_status")` na rota, e validar o body com um schema Zod de allowlist. Remover `status`, `userId`, `commissionIndicator` e `commissionPromoter` do que essa rota aceita — mudança de status deve passar só por PATCH /api/referrals/:id/status, e reatribuição de dono/comissão deve ser rota separada exclusiva de admin. Adicionar também a checagem de escopo do analista nível 3 (verificar que o referral pertence a um supervisionado) antes de qualquer escrita.

#### WebSocket /ws sem autenticação recebe o broadcast completo das indicações (nome, telefone, placa, comprovante)

**Arquivo:** `server/routes.ts:3926`  |  **Categoria:** exposicao_de_dados

`new WebSocketServer({ server, path: '/ws' })` é criado sem opção `verifyClient` e o handler `wss.on('connection', ...)` (linha 3931) adiciona o socket ao Set de clientes sem ler cookie de sessão, sem passport, sem qualquer checagem. A função broadcastUpdate (linha 3947) envia o payload para TODOS os sockets abertos. Os payloads são objetos de indicação inteiros: routes.ts:1858 envia o retorno de storage.updateReferralStatus, routes.ts:2187 o de storage.updateReferral, routes.ts:2275 e 2373 as linhas devolvidas por `.returning()` do drizzle — todos contendo fullName, phone, licensePlate, notes, statusHistory e paymentProof do lead.

**Cenário de falha:** Qualquer pessoa na internet (ou qualquer pessoa no WiFi do evento com a URL do app) abre `new WebSocket('wss://<host>/ws')` no console do navegador, sem login. A partir daí, cada validação, conversão ou mudança de status feita pelos analistas durante o dia empurra para esse socket o nome completo, telefone e placa do cliente indicado, além do comprovante de pagamento em base64. É vazamento contínuo e passivo de toda a base de leads gerada no evento, sem deixar rastro em log de acesso HTTP.

**Correção sugerida:** Autenticar o upgrade: usar a opção `verifyClient` (ou o evento `server.on('upgrade')`) para carregar a sessão a partir do cookie metis.sid via storage.sessionStore, rejeitar quem não estiver autenticado, e guardar o papel do usuário junto ao socket. Em broadcastUpdate, filtrar por papel/escopo e enviar apenas um payload mínimo (por exemplo `{ id, status }`) para que o cliente refaça o fetch autenticado, em vez de empurrar o registro completo.

#### POST /api/validate/cross-app fica sem autenticação porque CROSS_APP_SECRET não está definido

**Arquivo:** `server/crossAppValidation.ts:40`  |  **Categoria:** endpoint_publico

A rota é registrada sem middleware de autenticação (registerCrossAppValidationRoutes é chamada em routes.ts:61) e a única barreira é `if (appSecret !== process.env.CROSS_APP_SECRET) return 401`. A variável CROSS_APP_SECRET não existe nem no .env nem no .env.example do repositório (só aparecem MASTER_PASSWORD e DEVELOPER_MASTER_PASSWORD). Com a variável indefinida, uma requisição que simplesmente omite o campo appSecret produz `undefined !== undefined`, que é false — a checagem passa e o handler executa. O corpo então consulta users por CPF, users por telefone e referrals por placa, devolvendo o `fullName` do titular e a data de cadastro.

**Cenário de falha:** Um atacante anônimo envia POST /api/validate/cross-app com body {"cpf":"12345678901"} — sem appSecret. Resposta: {"hasDuplicates":true,"duplicates":[{"type":"cpf","isDuplicate":true,"data":{"userName":"Fulano de Tal","registeredAt":"..."}}]}. Isso é um oráculo público de CPF→nome e telefone→nome sobre toda a base de indicadores, e placa→nome do cliente indicado sobre toda a base de leads. Rodando uma lista de CPFs vazados de outra fonte, dá para confirmar quem está cadastrado e o nome completo de cada um, sem nunca fazer login.

**Correção sugerida:** Falhar fechado: `const secret = process.env.CROSS_APP_SECRET; if (!secret) return res.status(503).json({ error: 'Validação cruzada não configurada' }); if (typeof appSecret !== 'string' || !safeCompare(appSecret, secret)) return res.status(401)...`. Usar comparação em tempo constante (a função safeCompare já existe em routes.ts:14) e documentar CROSS_APP_SECRET no .env.example como obrigatória.

#### updateWithdrawalStatus: idempotência por check-then-act permite estorno e pagamento duplicados

**Arquivo:** `server/storage.ts:2031`  |  **Categoria:** concorrencia-dinheiro

A checagem de idempotência (linhas 2031-2049) faz um SELECT e compara em memória, sem lock nem transação. O UPDATE seguinte (linha 2067) não tem condição de estado anterior. Os efeitos colaterais monetários — devolução ao saldo em 'rejected' (linha 2076) e updateUserTotalEarnings + createCashFlowEntry em 'paid' (linhas 2097-2107) — rodam fora de qualquer transação.

**Cenário de falha:** Dois admins clicam em 'Rejeitar' no saque #10 (R$200) quase simultaneamente, ou o front reenvia por timeout. Ambos leem status='pending', ambos passam pela guarda, ambos executam updateUserBalance(+200). O usuário recebe R$400 de volta por um saque de R$200. No caso 'paid', gera duas entradas de outflow em cash_flow e dobra totalEarnings.

**Correção sugerida:** Trocar por UPDATE condicional atômico: UPDATE withdrawal_requests SET status = :novo ... WHERE id = :id AND status <> :novo RETURNING *; executar os efeitos colaterais somente se rowCount === 1, tudo dentro da mesma db.transaction.

#### Rotas de criação por analista aceitam commissionValidated/commissionConverted sem clamp do pool

**Arquivo:** `server/routes.ts:2697`  |  **Categoria:** validacao-dinheiro

POST /api/analyst/indicadores (linha 2697), POST /api/analyst/promotores (linha 2742) e POST /api/admin/users (linha 2656) espalham req.body direto no objeto passado a storage.createUser, que grava commissionValidated e commissionConverted (storage.ts:231-232). Só as rotas de promotor/supervisor aplicam o clamp contra POOL_VALIDATED=4 e POOL_CONVERTED=60. Não existe CHECK no schema (shared/schema.ts:63-64 são decimal nullable sem restrição).

**Cenário de falha:** Um analista com a permissão create_indicadores cria um indicador com {"commissionValidated":"500.00"}. Quando a primeira indicação desse usuário é validada, storage.ts:1371-1382 calcula indTake=500 → newCommissionIndicator=500 e newCommissionPromoter = POOL_VALIDATED - 500 = -496. O indicador recebe R$500 de saldo sacável e o promotor tem R$496 SUBTRAÍDOS do saldo dele (updateUserBalance com valor negativo, sem qualquer piso). Um único lead validado zera e joga o saldo do promotor para negativo.

**Correção sugerida:** Aplicar a mesma validação de pool dessas rotas (routes.ts:2785-2790) em todas as rotas de criação de usuário, de preferência centralizada em storage.createUser: rejeitar commissionValidated fora de [0, POOL_VALIDATED] e commissionConverted fora de [0, POOL_CONVERTED]. Adicionar CHECK (commission_validated BETWEEN 0 AND 4) e CHECK (commission_converted BETWEEN 0 AND 60) no banco. Adicionalmente, clampar newCommissionPromoter/newCommissionSupervisor em >= 0 em storage.ts.

#### GET /api/tickets usa o ID do usuário como ID do ticket e devolve ticket de terceiro

**Arquivo:** `server/routes.ts:1328`  |  **Categoria:** correcao

A rota 'listar meus tickets' chama storage.getSupportTicketById(req.user!.id) — passa o ID do USUÁRIO onde a função espera o ID do TICKET (storage.ts:2210 faz where eq(supportTickets.id, id)). A função ainda faz with:{user:true, responses:{with:{user:true}}}, retornando o cadastro completo do dono do ticket, sem remover a senha.

**Cenário de falha:** O usuário de id=7 abre a tela de suporte. A API retorna o TICKET #7, que pertence a outra pessoa, incluindo o objeto 'user' completo desse terceiro (cpf, pixKey, phone, balance e o hash da senha, já que nenhum campo é removido aqui) e todas as respostas do ticket. Quem tem id sem ticket correspondente vê a lista vazia e conclui que o suporte 'não funciona'. É simultaneamente vazamento de dados e funcionalidade quebrada.

**Correção sugerida:** Trocar por storage.getSupportTicketsByUserId(req.user!.id) (que já existe, storage.ts:2224) e remover password/campos sensíveis do objeto 'user' embutido em getSupportTicketById.

#### createUserWithReferralAttribution roda o INSERT do usuário FORA da transação e pode esgotar o pool

**Arquivo:** `server/storage.ts:2818`  |  **Categoria:** transacao

O método abre db.transaction(async (tx) => {...}) e usa 'tx' para buscar/atualizar o referral_link (linhas 2826 e 2857), mas chama this.createUser(...) na linha 2881 e this.logUserAction(...) na linha 2885 usando o cliente GLOBAL 'db'. Ou seja: o usuário é inserido em OUTRA conexão e commitado independentemente da transação externa. O pool tem no máximo 10 conexões por padrão (db/index.ts:42) com connectionTimeoutMillis de 10s.

**Cenário de falha:** (a) Integridade: se o commit da transação externa falhar, o contador registrations do link volta atrás mas o usuário permanece criado — e vice-versa, a atribuição de promoterId/supervisorId feita dentro do tx não protege nada. (b) Disponibilidade, que é o risco do evento: 10 cadastros simultâneos via link de indicação seguram as 10 conexões do pool dentro de suas transações e todos ficam esperando uma 11ª conexão para o createUser. Deadlock de pool até estourarem os 10s de connectionTimeout — as 10 requisições falham e as seguintes entram na mesma fila. Com 2000 cadastros no mesmo dia, atrás do mesmo WiFi, o cadastro simplesmente para.

**Correção sugerida:** Passar 'tx' adiante: extrair a lógica de createUser para aceitar um executor (tx ou db) e usá-lo nas linhas 2881 e 2885. Aumentar DATABASE_POOL_MAX para o dia do evento e nunca fazer I/O em outra conexão dentro de uma transação aberta.

#### Analista pagina em memória carregando TODAS as indicações a cada requisição

**Arquivo:** `server/routes.ts:328`  |  **Categoria:** escalabilidade

Para role='analista', GET /api/referrals chama storage.getAllReferrals() (linha 328) — que faz SELECT da tabela inteira com JOIN em users e companies, sem LIMIT (storage.ts:1029-1093) — e só então filtra e fatia em JavaScript (linhas 333-353). O mesmo padrão se repete em GET /api/analyst/referrals (1528), /api/analyst/stats (1567), /api/analyst/analytics/referrals (1726) e /api/supervisor/referrals (3073). getAllWithdrawalRequests (storage.ts:1979) ainda faz uma query por saque dentro de um Promise.all (N+1).

**Cenário de falha:** No dia do SEBRAE a base cresce para dezenas de milhares de indicações. Cada refresh do painel de qualquer analista (e o front tem WebSocket disparando invalidação a cada 'referral_updated') puxa a tabela inteira com JOIN para o Node, serializa em JSON e descarta 99% no slice. Com o pool limitado a 10 conexões (db/index.ts:42) e vários analistas validando em paralelo, as conexões ficam presas nessas varreduras e as rotas de CADASTRO começam a estourar o connectionTimeoutMillis de 10s. O sintoma no evento é o app inteiro travando, não só o painel do analista.

**Correção sugerida:** Implementar paginação, filtro e busca em SQL para o caminho do analista (reaproveitar o padrão de getReferralsByUserIdPaginated, storage.ts:886) e para getReferralsBySupervisor. Trocar o N+1 de getAllWithdrawalRequests por um único JOIN agregado. Subir DATABASE_POOL_MAX e criar índices em referrals(status), referrals(user_id, created_at) e referrals(created_by, created_at).

### MEDIO

#### generateTicketNumber por contagem: colisão sob concorrência viola o UNIQUE e derruba a abertura de chamado

**Arquivo:** `server/storage.ts:2261`  |  **Categoria:** identificador-sequencial

generateTicketNumber conta os tickets do dia (2269-2274) e devolve `YYYYMMDD-(count+1)` (2276-2277). O valor é usado em createSupportTicket (2169-2177) para gravar support_tickets.ticket_number, coluna com restrição UNIQUE (shared/schema.ts:230 e db/migrations/0000_quick_emma_frost.sql:154). Contagem seguida de inserção é check-then-act clássico: duas aberturas simultâneas contam o mesmo total e geram o mesmo número. Não há retry nem tratamento do erro 23505 — em routes.ts:3282 e 1358 o erro sobe e vira 500 genérico.

**Cenário de falha:** Dois usuários abrem chamado no mesmo instante quando já existem 7 tickets no dia. Ambos leem todayTickets.length=7 e geram '20260728-0008'. O primeiro INSERT passa; o segundo falha com unique_violation (23505), a rota devolve 500 e o usuário perde o chamado que digitou. Sob volume alto (suporte durante o evento) isso deixa de ser exceção.

**Correção sugerida:** Usar uma SEQUENCE do Postgres por dia (ou simplesmente o id serial formatado) em vez de COUNT(*)+1; alternativamente, envolver o INSERT em retry que captura 23505 e recalcula o número, como já é feito em createReferralLink (storage.ts:2657-2667).

#### Transferência de comissão entre indicadores em dois UPDATEs soltos: falha no meio destrói saldo

**Arquivo:** `server/storage.ts:1763`  |  **Categoria:** transacao-ausente

Ao reatribuir uma indicação para outro usuário, updateReferral debita o indicador antigo (`updateUserBalance(currentReferral.userId, -currentCommissionIndicator, false)`, linha 1767) e credita o novo (`updateUserBalance(updates.userId, currentCommissionIndicator, true)`, linha 1770) em duas chamadas independentes, fora de transação, e só depois grava a indicação (1787-1790). Não há atomicidade entre débito, crédito e a mudança do vínculo. Observação adicional confirmada no código: o crédito passa updateEarnings=true, incrementando totalEarnings (valor "já pago") de um valor que apenas mudou de dono e ainda está no saldo.

**Cenário de falha:** Admin corrige o dono da indicação #900 (comissão R$3). O débito no usuário antigo é aplicado; nesse instante o pool está saturado (ver o achado do pool de 10 conexões) e a segunda chamada estoura o timeout de conexão. O erro sobe, a indicação não é atualizada e os R$3 simplesmente desaparecem: saíram do saldo do indicador antigo e nunca chegaram ao novo. Repetir a operação debita de novo o antigo, já que a indicação continua apontando para ele.

**Correção sugerida:** Executar débito, crédito e o UPDATE da indicação dentro de uma única db.transaction (passando tx a updateUserBalance). Corrigir também o updateEarnings=true na linha 1770, que infla totalEarnings sem que exista pagamento.

#### Bloqueio por fraude não recupera comissões já creditadas nem trava saques em andamento

**Arquivo:** `server/storage.ts:1613`  |  **Categoria:** perda-dinheiro

enforceFraudBlock (1613-1651) apenas seta users.isActive=false. Ele não zera nem congela o saldo, não cancela withdrawal_requests em 'pending'/'approved'/'retido' do fraudador, e updateWithdrawalStatus (2036) não verifica isActive antes de marcar 'paid'. Ao mesmo tempo, marcar cada indicação como 'false' faz updateReferralStatus cair no caso 'outros status' (comentário da linha 1422), zerando as comissões e aplicando delta NEGATIVO no saldo — mas apenas no saldo, que já pode ter sido esvaziado por um saque. Como users.balance não tem CHECK >= 0 (shared/schema.ts:65), o estorno simplesmente empurra o saldo para negativo em vez de recuperar o dinheiro.

**Cenário de falha:** Indicador fraudador cadastra 40 leads falsos no evento. 30 são validados (saldo R$90), ele pede saque de R$90 (saldo -> 0, saque 'pending'). Só depois o analista começa a marcar os leads como 'false'. Do 11º 'false' em diante o usuário é bloqueado, mas os 30 estornos de -R$3 levam o saldo a -R$90 e não devolvem nada à empresa. Pior: o saque de R$90 continua na fila e o admin, sem nenhum aviso de que o usuário está bloqueado, marca 'paid' — a empresa paga R$90 de comissão sobre leads reconhecidamente falsos e ainda registra totalEarnings +90 e cashFlow -90.

**Correção sugerida:** Em enforceFraudBlock, dentro da mesma transação: cancelar (status 'rejected' sem estorno, ou novo status 'cancelado_fraude') todos os withdrawal_requests do usuário em pending/approved/retido, e registrar o saldo negativo resultante como perda em auditoria. Em updateWithdrawalStatus, bloquear a transição para 'paid' quando o usuário estiver com isActive=false, exigindo liberação explícita do financeiro.

#### Estorno pode debitar promotor/supervisor diferente daquele que foi creditado

**Arquivo:** `server/storage.ts:1360`  |  **Categoria:** duplicacao-dinheiro

updateReferralStatus determina QUEM recebe/paga lendo o vínculo ao vivo do usuário no momento da chamada: user.promoterId (1476, 1494) e user.teamSupervisorId (1360-1363). O VALOR do estorno vem da linha da indicação (previousCommission*), mas o destinatário vem do estado atual do usuário. A indicação tem seu próprio campo promoterId (shared/schema.ts:103), que é ignorado nesse cálculo. Existem rotas que trocam esses vínculos a qualquer momento: PATCH de usuário com promoterId (routes.ts:3106-3111), /assign-promoter (3483-3486) e /assign (3518-3540).

**Cenário de falha:** Indicador I está sob o promotor P1. Lead validado: P1 recebe +R$1,00 e I +R$3,00. No dia seguinte o admin transfere I para o promotor P2 (POST /api/users/:id/assign-promoter). O analista então marca a mesma indicação como 'rejected'. O estorno de -R$1,00 é aplicado em P2 (user.promoterId atual), não em P1. P1 fica com R$1,00 indevido e P2 fica R$1,00 no negativo. Com uma equipe inteira transferida no meio do evento, o desvio escala linearmente com o número de leads reprocessados. O mesmo vale para o supervisor quando teamSupervisorId muda.

**Correção sugerida:** Persistir na própria indicação, no momento do crédito, os IDs de quem recebeu cada parcela (a coluna supervisorId já existe e é gravada em 1535; falta usar referrals.promoterId da mesma forma) e usar ESSES IDs para calcular e aplicar os estornos, em vez de reler user.promoterId/user.teamSupervisorId.

#### Supervisor com alocação de conversão nula perde a parcela de validação já creditada quando o lead converte

**Arquivo:** `server/storage.ts:1402`  |  **Categoria:** rateio-comissao

No ramo previousStatus==='validated' de status==='converted', se supervisorAllocConverted for null o código cai no else da linha 1402 e faz newCommissionSupervisor = 0 (1403) — em vez de preservar previousCommissionSupervisor, como faz com o indicador (1396) e com o promotor (1405). Como o delta é finalCommissionSupervisor - previousCommissionSupervisor (1469), o supervisor é debitado do que já havia recebido na validação. supervisorAllocValidated e supervisorAllocConverted são campos independentes: PATCH /api/promoter/users/:id/commissions (routes.ts:2909) permite atualizar apenas um dos dois, e um supervisor criado por rota administrativa pode ter só o de validação preenchido. Além disso, nesse mesmo else o promotor recebe POOL_CONVERTED - indBonusTake, o que faz a soma das parcelas do lead ficar MENOR que os R$64 dos dois pools.

**Cenário de falha:** Supervisor S com commissionValidated='4.00' e commissionConverted=NULL; indicador I sob S com comissões padrão. (1) Lead validado: indicador +R$3,00, supervisor 4-3 = +R$1,00, promotor 4-4 = R$0. Soma = R$4 (pool ok). (2) Mesmo lead marcado 'converted': supervisorUser existe mas supervisorAllocConverted é null -> linha 1403 zera; newCommissionSupervisor = 0, delta = 0 - 1 = -R$1,00. newCommissionIndicator = 3+50 = 53, newCommissionPromoter = 0 + (60-50) = 10. Distribuição final do lead: 53 + 0 + 10 = R$63,00 contra os R$64,00 dos dois pools. O supervisor perde o R$1,00 que já havia recebido e R$1,00 fica retido sem dono.

**Correção sugerida:** Nesse else usar newCommissionSupervisor = previousCommissionSupervisor (preservar), coerente com o tratamento do indicador e do promotor, e tratar supervisorAllocConverted null como 'sem alocação de conversão' explicitamente. Melhor ainda: aplicar a correção do achado do 'converted' (cálculo absoluto) e adicionar uma asserção pós-cálculo de que indicador + supervisor + promotor === POOL_VALIDATED (+ POOL_CONVERTED quando aplicável), abortando a operação se a soma não bater.

#### N+1 em getAllWithdrawalRequests: uma consulta de referrals por saque, sem paginação

**Arquivo:** `server/storage.ts:1979`  |  **Categoria:** n-mais-1

`getAllWithdrawalRequests` (storage.ts:1967-2017) carrega TODOS os saques com `user` e `processedByUser` e depois faz `Promise.all(withdrawals.map(...))` disparando um `db.query.referrals.findMany` por saque (linha 1983), filtrando por user_id + status — colunas sem índice. Serve GET /api/admin/withdrawals (routes.ts:2481). Não há LIMIT em lugar nenhum.

**Cenário de falha:** Depois do evento, 1.500 saques solicitados. O admin abre a tela de saques: são 1.500 seq scans de referrals disparados de uma vez contra um pool de 10 conexões. As 1.500 consultas ficam enfileiradas, o pool fica 100% ocupado por minutos e TODAS as outras rotas (login, cadastro, criação de lead) passam a esperar conexão — uma única tela administrativa congela o sistema inteiro.

**Correção sugerida:** Paginar a rota (LIMIT/OFFSET) e substituir o N+1 por uma única consulta agregada: um LEFT JOIN LATERAL ou um GROUP BY em referrals filtrado por `inArray(referrals.userId, userIds)` da página atual.

#### Exportação para Excel monta a planilha de forma síncrona no event loop

**Arquivo:** `server/routes.ts:1997`  |  **Categoria:** cpu-bloqueante

GET /api/admin/export/referrals (routes.ts:1933) carrega `getAllReferrals()` + `getAllUsers()` + `getAllCompanies()` em memória (linhas 1938-1940) e depois chama `XLSX.utils.json_to_sheet` (linha 1972) e `XLSX.write(wb, { type: 'buffer' })` (linha 1997) — ambos 100% síncronos. Não há LIMIT nem filtro de período.

**Cenário de falha:** Um admin clica em 'Exportar' no meio do evento com 30.000 leads. A montagem da planilha bloqueia o event loop por vários segundos (o buffer XLSX de 30k linhas com 15 colunas facilmente passa de 10MB). Durante esse tempo o processo não aceita nenhuma outra requisição: nenhum indicador consegue cadastrar lead, ninguém consegue logar. Como não há feedback, o admin clica de novo e repete o bloqueio.

**Correção sugerida:** Aceitar filtro obrigatório de período/status, limitar o número de linhas exportadas, e gerar a planilha fora do event loop (worker_thread) ou em streaming CSV. No mínimo, restringir a exportação a horários fora do pico.

#### Limite de cadastros por IP (500/15min) vai barrar a fila do evento atrás do WiFi compartilhado

**Arquivo:** `server/security.ts:49`  |  **Categoria:** rate-limit-inadequado

`MAX_REGISTRATIONS_PER_IP = envLimit("REGISTER_MAX_PER_IP", 500)` (security.ts:49) com janela de 15 minutos (security.ts:19). O contador incrementa em toda resposta com status < 500 (security.ts:205), ou seja, cadastros bem-sucedidos e tentativas duplicadas (400) contam igual. O próprio comentário do arquivo (security.ts:21-38) alerta para o cenário de evento presencial e recomenda REGISTER_MAX_PER_IP=0, mas nem .env nem .env.example definem a variável — o padrão de 500 é o que vai valer.

**Cenário de falha:** 2.000 pessoas cadastrando no mesmo WiFi (mesmo IP público) num ritmo de fila de evento. Passados 500 cadastros dentro de uma janela de 15 minutos, todos os demais recebem HTTP 429 'Muitas tentativas de cadastro'. Como o rate limiter é em memória (Map em security.ts:54) e não distingue usuários, a fila inteira trava por até 15 minutos, ao vivo, na frente da plateia. Se houver proxy/CDN na frente sem TRUST_PROXY configurado, todo mundo aparece com o mesmo IP e o efeito é garantido.

**Correção sugerida:** Definir explicitamente REGISTER_MAX_PER_IP=0 (ou um valor muito alto) no .env do evento, e trocar a proteção por algo que não dependa de IP (captcha, token de link de indicação, limite por CPF). Só contar respostas de erro, não os cadastros bem-sucedidos.

#### PATCH /api/referrals/:id/contact-status escreve em qualquer indicação sem checar dono ou equipe

**Arquivo:** `server/routes.ts:2198`  |  **Categoria:** idor

O único controle é a lista de papéis na linha 2201: `["admin","analista","indicador","indicador_nivel_1","promotor","vendedor","gerente"]` — praticamente todo mundo. Depois disso o handler só verifica se a indicação existe (linha 2216) e vai direto para o UPDATE em db (linhas 2248-2258), sem comparar referral.userId/createdBy/promoterId com req.user.id, e sem checar escopo de supervisão. Ele também reescreve o campo `statusHistory` inteiro com `[...(existingReferral.statusHistory || []), statusHistoryEntry]` (linha 2245), lido e regravado fora de transação.

**Cenário de falha:** Um indicador comum, logado, faz PATCH /api/referrals/731/contact-status com {"contactStatus":"sem_sucesso"} para uma indicação que não é dele — os IDs são seriais, então basta iterar de 1 até N. A indicação de um concorrente passa a aparecer como 'Sem Sucesso' para o closer, que deixa de trabalhar o lead; a comissão de conversão do indicador legítimo nunca acontece. Em escala, com um laço de alguns milhares de requisições no dia do evento, dá para sabotar toda a esteira de vendas e, de quebra, poluir o statusHistory de cada registro (que ainda é lido-modificado-gravado sem transação, então mudanças concorrentes se perdem).

**Correção sugerida:** Adicionar a mesma checagem de acesso usada em /api/referrals/:id/conversations (routes.ts:694-698): permitir apenas admin, analista, o dono (referral.userId ou createdBy), o promotor da indicação ou o vendedor/gerente responsável — retornando 403 caso contrário. E trocar a leitura+regravação do statusHistory por um append atômico no SQL (jsonb_insert / `statusHistory || $1::jsonb`) em vez de reconstruir o array em memória.

#### paymentProof aceita string base64 arbitrária de até 50 MB, sem tipo, tamanho ou formato, e é relida em listagens completas

**Arquivo:** `server/routes.ts:1841`  |  **Categoria:** validacao_de_entrada

O comprovante entra por dois caminhos: updateReferralStatusSchema define `paymentProof: z.string().optional()` (shared/schema.ts:557) — sem max(), sem regex de data URI, sem allowlist de MIME; e PATCH /api/referrals/:id copia `paymentProof` cru do body (routes.ts:2134). O parser aceita corpos de 50 MB (`express.json({ limit: '50mb' })`, server/index.ts:76). O valor cai numa coluna `text("payment_proof")` sem limite (shared/schema.ts:127). Não existe nenhum ponto de validação de conteúdo — a única checagem é `paymentProof.trim().length > 0` (routes.ts:2101). E storage.getAllReferrals seleciona explicitamente `paymentProof: referrals.paymentProof` (storage.ts:1064), sendo usada sem paginação por /api/analyst/referrals (routes.ts:1528), /api/admin/referrals sem paginated (routes.ts:1498) e /api/supervisor/referrals (routes.ts:3073). A rota /api/support/upload (routes.ts:3307) é um mock que ignora o arquivo e devolve uma URL falsa.

**Cenário de falha:** Um analista (ou um admin comprometido pelo achado do /api/register-with-referral) converte 50 indicações enviando em cada uma um paymentProof de ~45 MB de lixo base64 — nada valida que é imagem. São ~2 GB gravados na coluna text. No dia do evento, o primeiro analista que abrir a tela de indicações dispara GET /api/analyst/referrals, que roda getAllReferrals sem paginação, carrega todas essas strings na memória do Node e as serializa em JSON: o processo estoura a heap e o servidor cai para todo mundo — em cima de 2000 cadastros acontecendo ao mesmo tempo. Mesmo sem má-fé, comprovantes legítimos de foto de celular (5-10 MB em base64) multiplicados pelo volume do evento produzem o mesmo efeito.

**Correção sugerida:** Validar o campo no schema: `paymentProof: z.string().regex(/^data:image\/(png|jpe?g|webp);base64,/).max(2_000_000).optional()` (≈1,5 MB de imagem), rejeitando qualquer outro formato. Reduzir o limite do express.json para algo como 3mb e criar uma rota de upload dedicada. Excluir `paymentProof` da projeção de getAllReferrals (storage.ts:1064) e servi-lo por uma rota própria GET /api/referrals/:id/payment-proof; e paginar /api/analyst/referrals e /api/supervisor/referrals como já é feito em getAllReferralsPaginated.

#### indicador_nivel_1 converte a própria indicação e gera o pool de R$60 com um comprovante que é qualquer string

**Arquivo:** `server/routes.ts:202`  |  **Categoria:** autorizacao

O middleware requireStatusEditPermission libera o papel indicador_nivel_1 para mudar o status da própria indicação de 'validated' para 'converted' (routes.ts:202-231) — sem nenhum analista, closer ou admin no caminho. O handler exige comprovante (routes.ts:1825-1832), mas a exigência é apenas que `validatedData.paymentProof` seja truthy: o schema aceita qualquer string (shared/schema.ts:557). Em seguida storage.updateReferralStatus credita o pool de conversão (storage.ts:1384-1409 e 1467-1482). Some-se a isso que indicador_nivel_1 é explicitamente isento do limite de 100 indicações/dia (routes.ts:462).

**Cenário de falha:** Um indicador_nivel_1 tem 30 indicações já validadas por um analista. Ele envia, para cada uma, PATCH /api/referrals/<id>/status com {"status":"converted","paymentProof":"x"} — nenhuma venda existiu, nenhum comprovante real foi anexado. O sistema aceita as 30 e gera 30 × R$60 = R$1.800 de passivo. Como esse papel é criado pelos promotores especiais, a regra de storage.ts:1424-1438 redireciona a comissão inteira para o promotor, que NÃO é bloqueado de sacar (o forbidRole em /api/withdrawals só bloqueia indicador_nivel_1, routes.ts:1205). Ou seja, a dupla indicador_nivel_1 + promotor consegue transformar leads apenas validados em dinheiro sacável sem ninguém do processo de vendas participar.

**Correção sugerida:** Remover a permissão de auto-conversão do indicador_nivel_1 em requireStatusEditPermission, ou fazer com que essa transição grave um estado intermediário ('aguardando_confirmacao') que não credita comissão até um analista/vendedor confirmar. Independentemente disso, validar o formato do paymentProof (ver achado do comprovante) para que 'x' não seja aceito como comprovante de pagamento.

#### POST /api/referrals/check-duplicate devolve os dados completos de qualquer lead a partir de telefone ou placa

**Arquivo:** `server/routes.ts:609`  |  **Categoria:** exposicao_de_dados

A rota só exige requireAuth. Ela lê `const { phone, licensePlate, licensePlates } = req.body` sem schema, sem limite de quantidade de placas, e passa para storage.checkDuplicateReferralWithOwner, que devolve id, fullName, phone, licensePlate, createdAt do lead e ainda fullName e state de quem o cadastrou (server/storage.ts:1288-1296). A resposta espalha esses campos com `...duplicate` (routes.ts:640), ou seja, entrega tudo. Não há checagem de que o solicitante tenha qualquer relação com aquele lead nem limite de tentativas.

**Cenário de falha:** Um indicador logado (ou um atacante que criou uma conta pelo cadastro aberto) roda um laço enviando POST /api/referrals/check-duplicate com {"licensePlates":["ABC1D23", "ABC1D24", ...]} varrendo o espaço de placas Mercosul, ou com listas de telefones. Para cada acerto ele recebe nome completo do cliente, telefone, placa, data e o nome + estado do indicador que registrou. Em uma tarde isso extrai a carteira de leads inteira da empresa — inclusive para revender ou abordar os clientes de concorrentes internos. O campo `licensePlates` também não tem limite de tamanho, então um único POST com 100.000 placas dispara 100.000 consultas sequenciais ao banco (laço `for` com await em routes.ts:625), derrubando o pool de conexões no dia do evento.

**Correção sugerida:** Validar o body com Zod (`z.object({ phone: z.string().optional(), licensePlates: z.array(z.string()).max(3).optional() })`) e responder apenas `{ isDuplicate: boolean, ownerFirstName, ownerState, originalDate }` — nunca fullName/phone/licensePlate do lead nem o id. Aplicar rate limiting por conta nessa rota, já que o objetivo legítimo (avisar o indicador que a placa já existe) não exige devolver o registro.

#### Reatribuição de indicação debita o indicador antigo e pode falhar antes de creditar o novo

**Arquivo:** `server/storage.ts:1767`  |  **Categoria:** escrita-parcial

updateReferral() faz duas chamadas sequenciais e sem transação: primeiro remove a comissão do usuário antigo (linha 1767) e depois credita o novo (linha 1770). Se a segunda falhar, a primeira já foi commitada. O userId vem de routes.ts:2128 como parseInt(userId) sem validação de NaN, e a condição de disparo (linha 1742) é 'updates.userId !== currentReferral.userId' — NaN é diferente de qualquer número, então o caminho é acionado. Adicionalmente, a segunda chamada usa updateEarnings=true, inflando totalEarnings, o que contraria a regra documentada em storage.ts:496-500 (totalEarnings só cresce quando um SAQUE é pago).

**Cenário de falha:** Admin/analista envia PATCH /api/referrals/300 com {"userId":""} ou {"userId":"joao"} (select do front sem valor). parseInt → NaN. A linha 1767 executa 'balance - 53' no indicador original (commitado). A linha 1770 tenta UPDATE users SET balance = balance + 53 WHERE id = NaN → o Postgres rejeita/não afeta linha e a rota devolve 500. Resultado: R$53 evaporaram do saldo do indicador, sem registro em cash_flow e sem qualquer indicação de para onde foram. No cenário 'feliz' (userId válido), o novo indicador ainda tem totalEarnings inflado e passa a aparecer como se já tivesse recebido o valor.

**Correção sugerida:** Validar userId com Number.isInteger antes de montar updateData (routes.ts:2128) e retornar 400. Em storage.ts, envolver as duas chamadas de updateUserBalance em db.transaction, e trocar o updateEarnings=true da linha 1770 por false, para respeitar a semântica de totalEarnings.

#### deleteUser viola FK de terceiros e sempre falha quando o usuário tem histórico

**Arquivo:** `server/storage.ts:683`  |  **Categoria:** dados-orfaos

A transação de deleteUser apaga referral_conversations e cash_flow filtrando por userId/createdBy do usuário deletado (linhas 697-706), mas depois apaga as INDICAÇÕES desse usuário (linha 713) e os saques dele (linha 709). Sobram linhas de outras pessoas apontando para esses registros: referral_conversations.referral_id (FK, schema.ts:214), cash_flow.related_referral_id (FK, schema.ts:203), cash_flow.related_withdrawal_id (FK, schema.ts:202) e sales_leads.referral_id (FK, schema.ts:271). Nenhuma dessas FKs tem ON DELETE CASCADE.

**Cenário de falha:** Admin usa DELETE /api/admin/users/77/delete com a senha mestre. O indicador 77 tem uma indicação em que um analista escreveu uma observação (referral_conversations com user_id do analista, referral_id da indicação 77) e tem um saque já pago (cash_flow com related_withdrawal_id e created_by = admin). O DELETE de referrals dispara erro 23503 de foreign key, a transação inteira faz rollback e a rota devolve 500 'Erro ao deletar usuário' — sempre, para qualquer usuário com histórico real. O admin não consegue remover cadastros de teste antes do evento e não recebe nenhuma pista do motivo (o error handler mascara mensagens 5xx).

**Correção sugerida:** Dentro da transação, apagar por referral_id/withdrawal_id em vez de por user_id: coletar os ids das indicações e saques do usuário e apagar referral_conversations, cash_flow (related_referral_id/related_withdrawal_id) e sales_leads que os referenciem, antes de apagar referrals/withdrawal_requests. Alternativamente, declarar onDelete:'cascade' nas FKs em shared/schema.ts e migrar. Melhor ainda: substituir a exclusão física por isActive=false.

#### CPF sem dígito verificador e sem normalização: o mesmo CPF cria duas contas

**Arquivo:** `shared/schema.ts:493`  |  **Categoria:** validacao-identidade

insertUserSchema valida CPF apenas com z.string().min(11).max(14). Não há verificação de dígito verificador em nenhum lugar do repositório (busca por validateCpf/digitoVerificador retorna apenas validateCpfForWithdrawal, que só compara). storage.createUser grava cpf exatamente como recebido (storage.ts:215), sem strip de pontuação, e a constraint UNIQUE (schema.ts:46) é sobre a string bruta. As checagens de duplicidade também usam igualdade exata: storage.getUserByCpf (eq) e crossAppValidation.validateUserDuplicates (eq, linha 204).

**Cenário de falha:** A mesma pessoa se cadastra às 9h com cpf='529.982.247-25' e às 14h com cpf='52998224725'. As duas strings são diferentes, a UNIQUE não bloqueia, getUserByCpf não encontra e o sistema cria DUAS contas para o mesmo CPF. As duas acumulam comissão e as duas passam em validateCpfForWithdrawal (storage.ts:2459 faz replace(/\D/g,'') dos dois lados), ou seja, ambas sacam para o mesmo PIX. Também é possível cadastrar cpf='00000000000' ou '12345678901', que não existem. Com 2000+ cadastros em um dia e digitação em celular, isso acontece por acidente, não só por má fé.

**Correção sugerida:** Adicionar .transform(v => v.replace(/\D/g,'')).refine(isValidCpf) em insertUserSchema (implementar o algoritmo dos dois dígitos verificadores) e normalizar também em storage.createUser. Migrar a base existente para CPF só-dígitos antes de recriar a UNIQUE. Fazer o mesmo com users.phone, que hoje também é comparado por igualdade exata em crossAppValidation.ts:217.

#### generateTicketNumber conta linhas e colide com a UNIQUE de ticket_number

**Arquivo:** `server/storage.ts:2261`  |  **Categoria:** concorrencia

O número do ticket é gerado contando quantos tickets existem hoje (linha 2269) e somando 1 (linha 2276). supportTickets.ticketNumber tem constraint UNIQUE (shared/schema.ts:230). Não há lock nem retry, e createSupportTicket (linha 2168) não trata erro 23505. Bônus: as linhas 2266-2267 fazem today.setHours() duas vezes sobre o MESMO objeto Date, então todayStart já foi mutado quando todayEnd é calculado — a janela fica errada.

**Cenário de falha:** Dois usuários abrem um chamado no mesmo segundo. Ambos contam 12 tickets do dia e ambos geram '20260728-0013'. O segundo INSERT viola a UNIQUE, a exceção sobe sem tratamento e a rota devolve 500 'Erro ao criar ticket'. No dia do evento, com suporte sendo acionado em paralelo, o canal de suporte fica intermitente exatamente quando é mais necessário.

**Correção sugerida:** Usar uma SEQUENCE do Postgres por dia, ou um sufixo aleatório (crypto.randomUUID().slice(0,4)), ou envolver em retry com tratamento do código 23505. Corrigir também a mutação do Date: criar dois objetos separados a partir de new Date().

#### Placa e telefone gravados sem normalização na edição, furando a checagem de duplicidade

**Arquivo:** `server/routes.ts:2126`  |  **Categoria:** normalizacao

Na criação, createReferralSchema normaliza a placa (toUpperCase + remoção de não-alfanuméricos, shared/schema.ts:541). Já em PATCH /api/referrals/:id as linhas 2125-2126 gravam phone e licensePlate exatamente como vieram do corpo. As buscas por duplicata usam formas incompatíveis entre si: checkDuplicateReferral compara LOWER(license_plate) contra o valor bruto (storage.ts:1249), checkDuplicatePlate remove só o hífen com REPLACE (storage.ts:866) e getReferralByPlate faz igualdade exata com a placa já limpa (storage.ts:2616).

**Cenário de falha:** Um analista corrige a placa da indicação #120 para 'abc-1d23' via PATCH. A linha grava 'abc-1d23'. Depois, um indicador tenta cadastrar 'ABC1D23': checkDuplicateReferralWithOwner compara LOWER('abc-1d23') com 'abc1d23' → não bate → a indicação duplicada é aceita e vai gerar comissão em dobro pelo mesmo carro. Do mesmo modo, GET /api/search-plate?plate=ABC1D23 responde 'disponível para cadastro' para uma placa que já está na base.

**Correção sugerida:** Extrair a normalização para uma função única (normalizePlate/normalizePhone) e aplicá-la em TODOS os pontos de escrita (criação, PATCH, bulk update) e de leitura/comparação. Criar índice funcional único sobre a forma normalizada para que o banco garanta a regra independentemente do caminho de código.

#### Editar um link de indicação regenera o token sem sufixo único: 500 por colisão e QR codes já distribuídos param de funcionar

**Arquivo:** `server/storage.ts:2725`  |  **Categoria:** correcao

createReferralLink gera o slug com sufixo aleatório e trata colisão com retry (linhas 2635-2637 e 2659-2665). Já updateReferralLink gera o slug apenas a partir do nome, SEM sufixo (linhas 2725-2727), grava em linkToken (coluna 'slug', UNIQUE por shared/schema.ts:258) e não trata o erro 23505.

**Cenário de falha:** Dois promotores criam links chamados 'Evento SEBRAE'. O primeiro edita o nome do dele: o token vira 'evento-sebrae' e todos os QR codes/cartões já impressos com '/ref/evento-sebrae-a1b2' deixam de existir — os cadastros do dia perdem a atribuição de promotor e ninguém recebe comissão de indicação. O segundo promotor edita o link dele: o slug 'evento-sebrae' já existe → violação de UNIQUE → 500 'Erro ao atualizar link de referência', sem explicação.

**Correção sugerida:** Não alterar linkToken em updates — o token deve ser imutável após a criação; atualizar apenas 'name' e 'isActive'. Se a regeneração for realmente desejada, reaproveitar a mesma lógica de sufixo + retry de createReferralLink e tratar o código 23505 como 409.

### BAIXO

#### statusHistory (JSONB) sobrescrito por read-modify-write: entradas de auditoria são perdidas em atualizações concorrentes

**Arquivo:** `server/storage.ts:1331`  |  **Categoria:** lost-update

O histórico de status é lido em memória e regravado inteiro: em updateReferralStatus lê `referral.statusHistory` (1331) e grava `[...currentHistory, newHistoryEntry]` (1522); em validateReferral lê (1660) e grava o array completo (1671); e em routes.ts:2343-2352 o mesmo padrão para indicatorPaymentStatus. Como o UPDATE substitui o JSONB inteiro sem transação nem guarda de versão, a última escrita apaga a entrada gravada pela concorrente.

**Cenário de falha:** O analista salva os dados de validação (PATCH /api/referrals/:id/validate) e, quase ao mesmo tempo, o promotor autorizado marca o pagamento ao indicador (PATCH /api/referrals/:id/indicator-payment-status). As duas leem o histórico com 3 entradas; cada uma grava um array de 4 elementos. A entrada da requisição que terminar primeiro desaparece — a trilha de auditoria do dinheiro (quem mudou o quê e quando) fica incompleta exatamente nos casos disputados.

**Correção sugerida:** Anexar no banco em vez de reescrever: `set({ statusHistory: sql`COALESCE(status_history,'[]'::jsonb) || ${JSON.stringify([entry])}::jsonb` })`, o que é atômico no nível da linha e dispensa a leitura prévia.

#### Reatribuição de indicação infla totalEarnings sem nenhum saque pago

**Arquivo:** `server/storage.ts:1777`  |  **Categoria:** invariante-inconsistente

Em storage.updateReferral, ao trocar o userId da indicação, o saldo é retirado do usuário antigo com updateUserBalance(..., -valor, false) (1774) mas creditado no novo com updateUserBalance(..., +valor, TRUE) (1777). O terceiro parâmetro true faz também 'total_earnings = total_earnings + amount' (storage.ts:508-515). Isso contraria a regra documentada no próprio arquivo (comentários das linhas 1492-1493 e 505-507): totalEarnings deve refletir apenas saques efetivamente PAGOS, e é incrementado em updateWithdrawalStatus:2104. Além disso o totalEarnings do usuário ANTIGO não é decrementado, então o valor é duplicado no agregado.

**Cenário de falha:** Indicação com commissionIndicator=R$53,00 atribuída ao indicador A (que já sacou e tem totalEarnings=R$53). O admin percebe que o lead era do indicador B e faz PATCH /api/referrals/:id com userId=B. Resultado: A fica com balance -53 e totalEarnings ainda 53; B fica com balance +53 e totalEarnings +53 sem nunca ter recebido um centavo. O relatório 'total já pago' do dia do evento passa a somar R$53 inexistentes por reatribuição, e a conferência contra o cashFlow (que só registra saída em saque pago) nunca fecha.

**Correção sugerida:** Trocar o terceiro argumento da linha 1777 para false (ou omitir), mantendo totalEarnings sob responsabilidade exclusiva de updateWithdrawalStatus/updateUserTotalEarnings. Executar as duas chamadas de saldo dentro de uma db.transaction() junto com o UPDATE da indicação.

#### updateUserBalance faz duas leituras extras do usuário só para logar, em cada crédito de comissão

**Arquivo:** `server/storage.ts:491`  |  **Categoria:** consulta-desnecessaria

`updateUserBalance` (storage.ts:486-527) faz `getUserById` antes do UPDATE (linha 491) e outro `getUserById` depois (linha 519) apenas para imprimir o saldo em console.log. `updateReferralStatus` chama updateUserBalance até 3 vezes por mudança de status (indicador em storage.ts:1468, supervisor em 1474, promotor em 1480), além de já ter feito getReferralById, getUserById do indicador, do supervisor, do promotor e do admin. `updateUserTotalEarnings` (storage.ts:540) repete o mesmo padrão.

**Cenário de falha:** Cada validação de lead feita por um analista dispara ~14 round-trips ao banco, dos quais 6 existem só para produzir linhas de log. Numa jornada de validação em massa após o evento (milhares de leads), isso multiplica por ~1,8x a carga no pool de 10 conexões e, junto com a ausência de índice em referrals.user_id, transforma cada clique de validação em centenas de milissegundos.

**Correção sugerida:** Usar `.returning({ balance: users.balance, totalEarnings: users.totalEarnings })` no próprio UPDATE e eliminar os dois getUserById. Reduzir os console.log por operação (eles também são custo real de I/O em produção).

#### companyId da indicação é decidido pelo header Host enviado pelo cliente

**Arquivo:** `server/tenancy.ts:49`  |  **Categoria:** validacao_de_entrada

resolveTenant tenta APP_TENANT, depois APP_ID/REPL_SLUG, e então cai em `req.headers.host` (linhas 49-57), com fallback final para gruposantana. Nenhuma dessas variáveis está definida no .env do projeto (só DATABASE_URL, SESSION_SECRET, MASTER_PASSWORD, TRUST_PROXY, COOKIE_SECURE, CORS_ORIGINS, DEVELOPER_MASTER_PASSWORD e as do Postgres/Docker), então o header Host é o que realmente decide. Em POST /api/referrals, para todo usuário não-admin, o companyId validado pelo Zod é sobrescrito por `finalReferralData.companyId = tenantConfig.companyId` (routes.ts:546-549) — isto é, um valor derivado de dado controlado pelo cliente é usado como enforcement de segurança/tenant.

**Cenário de falha:** Um indicador manda POST /api/referrals com o header `Host: kongpix.qualquercoisa` (curl ou qualquer cliente HTTP permite). resolveTenant vê 'kong' no host e devolve companyId 11; a indicação é gravada na Kong Pix em vez do Grupo Santana, mesmo que o formulário tenha escolhido outra empresa. O efeito prático é contaminação cruzada entre tenants: métricas de /api/admin/company-metrics/:companyId e o rateio de caixa por empresa passam a contar leads que não são daquela empresa, e o comentário do próprio código diz que essa sobrescrita existe 'for security'.

**Correção sugerida:** Exigir APP_TENANT explícito e falhar na inicialização se não estiver definido em produção (mesmo padrão já adotado para SESSION_SECRET em server/auth.ts:64-70). Remover o fallback por req.headers.host, ou validar o host contra uma allowlist fechada vinda de env. Em POST /api/referrals, validar que o companyId enviado pertence ao tenant configurado em vez de derivá-lo da requisição.

#### parseInt(req.params.id) sem validação de NaN em dezenas de rotas devolve 500 em vez de 400

**Arquivo:** `server/routes.ts:686`  |  **Categoria:** validacao-entrada

Apenas GET /api/users/:id (linha 384) e algumas rotas de empresa (linhas 816 e 847) validam o resultado de parseInt. Nas demais o valor vai direto para o banco: /api/referrals/:id/conversations (686 e 715), /api/tickets/:id (1339), /api/referrals/:id/status (1819 e 1836, além de 204 no middleware), /api/referrals/:id (2065), /api/referrals/:id/contact-status (2206), /api/admin/withdrawals/:id (2512), /api/admin/users/:id/permissions (2612), /api/admin/users/:id (3103), /api/admin/users/:id/status (3190), /api/sales/leads/:id (3397, 3417, 3434), /api/referral-links/:id (3766). Um id não numérico vira NaN e a query em coluna integer falha com 22P02.

**Cenário de falha:** Qualquer GET /api/referrals/abc/conversations (link quebrado, crawler, autocomplete do navegador, front enviando 'undefined' na URL) gera exceção no driver, cai no catch genérico e devolve 500 com stack no log do servidor. No dia do evento isso enche o log de 500 e mascara os erros reais que precisam ser diagnosticados na hora, além de devolver o código HTTP errado (deveria ser 400/404).

**Correção sugerida:** Criar um middleware/helper 'parseId(req.params.id)' que retorna 400 'ID inválido' quando !Number.isInteger(n) || n <= 0, e aplicá-lo em todas as rotas com :id. Alternativa rápida: registrar app.param('id', ...) validando uma única vez.
