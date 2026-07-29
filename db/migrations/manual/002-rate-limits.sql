-- Tabela de contadores do rate limiting.
--
-- POR QUE É MANUAL: em banco vazio o `drizzle-kit push` não sabe se
-- `rate_limits` é uma tabela nova ou um rename de `session`, e faz uma
-- pergunta interativa — que trava um deploy automatizado. Criando a tabela
-- antes, o push a reconhece e segue sem perguntar.
--
-- RODE ESTE ARQUIVO ANTES do primeiro `npm run db:push` em um banco novo
-- (máquina nova, Supabase, staging).
--
-- O QUE RESOLVE: os contadores viviam num Map em memória. Com mais de uma
-- instância da aplicação cada uma tinha o próprio limite (N instâncias =
-- N vezes mais tentativas permitidas), e qualquer restart — deploy, crash,
-- autoscaling — zerava tudo, inclusive bloqueios ativos. Bastava esperar um
-- deploy para reiniciar um ataque de força bruta do zero.

CREATE TABLE IF NOT EXISTS rate_limits (
  chave            text      PRIMARY KEY,
  contador         integer   NOT NULL DEFAULT 0,
  janela_expira_em timestamp NOT NULL
);

-- Usado pela limpeza periódica das janelas vencidas
CREATE INDEX IF NOT EXISTS rate_limits_expira_em_idx
  ON rate_limits (janela_expira_em);

-- Formato das chaves:
--   login:ip:<ip>          tentativas de login por origem
--   login:user:<email>     tentativas contra uma conta específica
--   register:ip:<ip>       cadastros por origem
--   public:ip:<ip>         acesso às rotas públicas por origem
--
-- Consultar bloqueios ativos:
--   SELECT chave, contador, janela_expira_em
--   FROM rate_limits
--   WHERE janela_expira_em > now()
--   ORDER BY contador DESC;
--
-- Liberar alguém manualmente (ex.: usuário legítimo travado no evento):
--   DELETE FROM rate_limits WHERE chave = 'login:user:fulano@exemplo.com';
