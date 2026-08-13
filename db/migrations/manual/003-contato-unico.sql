-- Telefone e e-mail únicos por usuário.
--
-- POR QUE É MANUAL: são índices únicos sobre EXPRESSÃO (lower/só-dígitos), que
-- o Drizzle não expressa. `npm run db:push` agora reaplica esta pasta sozinho
-- (ver scripts/db-push-seguro.mjs), mas se rodar `db:push:bruto` reaplique à mão.
--
-- O QUE RESOLVE: a liberação do saque compara a chave PIX com o telefone e o
-- e-mail do cadastro. Os dois eram campos livres, sem unicidade — duas contas
-- podiam declarar o mesmo contato, e a checagem de titularidade passava a
-- responder "confere" para a conta errada. Com o índice, um contato pertence a
-- um cadastro só.
--
-- LIMITE CONHECIDO: telefone e e-mail continuam AUTODECLARADOS — não há
-- confirmação por código. Quem informar o contato de outra pessoa no próprio
-- cadastro ainda passa pela checagem. Fechar isso exige confirmação (OTP por
-- SMS no telefone, link no e-mail) antes de habilitar o saque, o que muda o
-- fluxo de cadastro e é decisão de produto.
--
-- Verificar duplicatas ANTES de aplicar (as três consultas devem vir vazias):
--   SELECT regexp_replace(phone,'\D','','g') p, count(*) FROM users
--     WHERE phone IS NOT NULL AND phone <> '' GROUP BY 1 HAVING count(*)>1;
--   SELECT lower(email) e, count(*) FROM users
--     WHERE email IS NOT NULL AND email <> '' GROUP BY 1 HAVING count(*)>1;
--   SELECT lower(pix_key) k, count(*) FROM users
--     WHERE pix_key IS NOT NULL AND pix_key <> '' GROUP BY 1 HAVING count(*)>1;

CREATE UNIQUE INDEX IF NOT EXISTS users_telefone_uniq
  ON users (regexp_replace(phone, '\D', '', 'g'))
  WHERE phone IS NOT NULL AND phone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq
  ON users (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS users_chave_pix_uniq
  ON users (lower(pix_key))
  WHERE pix_key IS NOT NULL AND pix_key <> '';
