-- Índice único parcial de placa ativa.
--
-- POR QUE É MANUAL: o Drizzle não expressa bem índice único sobre EXPRESSÃO
-- (UPPER/REPLACE) combinado com cláusula WHERE parcial. Como `drizzle-kit push`
-- remove índices que não conhece, REAPLIQUE este arquivo sempre depois de rodar
-- `npm run db:push`.
--
-- O QUE RESOLVE: a checagem de duplicata na aplicação consulta o banco e só
-- depois insere. Dois envios simultâneos da mesma placa passavam os dois pela
-- consulta e criavam duas indicações — comissão paga em dobro pelo mesmo carro.
-- Este índice torna isso impossível no banco; a rota trata o erro 23505 e
-- devolve a mesma mensagem de "placa já cadastrada".
--
-- Placas de indicações canceladas/falsas ficam de fora do índice para que o
-- mesmo carro possa ser reindicado depois de um cancelamento legítimo.

CREATE UNIQUE INDEX IF NOT EXISTS referrals_placa_ativa_uniq
  ON referrals (UPPER(REPLACE(license_plate, '-', '')))
  WHERE status NOT IN ('false', 'rejected');

-- Verificar duplicatas ANTES de aplicar (deve retornar 0 linhas):
--   SELECT UPPER(REPLACE(license_plate,'-','')) AS placa, count(*)
--   FROM referrals
--   WHERE status NOT IN ('false','rejected')
--   GROUP BY 1 HAVING count(*) > 1;
