-- =====================================================
-- SCRIPT PARA CRIAR ADMIN NO BANCO DE DADOS DE PRODUÇÃO
-- =====================================================
-- Execute este script diretamente no PostgreSQL de produção
-- Via Neon Console, pgAdmin, ou console do banco

-- 1. Verificar informações do banco atual
SELECT current_database() as banco_atual, current_user as usuario_atual, version() as versao_postgres;

-- 2. Verificar se o admin já existe
SELECT id, username, email, role, is_active, created_at 
FROM users 
WHERE username = 'admin@kongpix.com.br';

-- 3. CRIAR OU ATUALIZAR O ADMIN
-- Este comando cria o admin se não existir, ou atualiza se já existir
INSERT INTO users (
  username, 
  password, 
  full_name, 
  cpf, 
  email, 
  phone, 
  address, 
  shirt_size, 
  pix_key, 
  role, 
  is_active, 
  balance, 
  total_earnings, 
  must_change_password,
  created_at, 
  updated_at
) VALUES (
  'admin@kongpix.com.br',
  'c5ba67a0e7392279c6240e98f403b34e12806fa8dc938a0b045da949f21bce8f0e3de35ab39a6e99dcb18a5327ba8a4e67ced752b80fbeead1f623c3901fc872.9f85488ca673d1a96ba223344c6323ad', -- senha hasheada: admin123
  'Administrador Kong Pix',
  '00000000001',
  'admin@kongpix.com.br',
  '00000000001',
  'Sede Kong Pix - Centro',
  'M',
  'admin@kongpix.com.br',
  'admin',
  true,
  '0.00',
  '0.00',
  false,
  NOW(),
  NOW()
) 
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = 'admin',
  is_active = true,
  updated_at = NOW()
RETURNING id, username, email, role, is_active;

-- 4. Verificar todos os administradores
SELECT id, username, email, role, is_active, created_at 
FROM users 
WHERE role = 'admin'
ORDER BY created_at DESC;

-- =====================================================
-- INFORMAÇÕES DE LOGIN:
-- =====================================================
-- URL: https://indique.replit.app
-- Email: admin@kongpix.com.br
-- Senha: admin123
-- =====================================================

-- OPCIONAL: Criar também o diego@gruposantana.com.br como admin
INSERT INTO users (
  username, 
  password, 
  full_name, 
  cpf, 
  email, 
  phone, 
  address, 
  shirt_size, 
  pix_key, 
  role, 
  is_active, 
  balance, 
  total_earnings, 
  must_change_password,
  created_at, 
  updated_at
) VALUES (
  'diego@gruposantana.com.br',
  'c5ba67a0e7392279c6240e98f403b34e12806fa8dc938a0b045da949f21bce8f0e3de35ab39a6e99dcb18a5327ba8a4e67ced752b80fbeead1f623c3901fc872.9f85488ca673d1a96ba223344c6323ad', -- senha hasheada: admin123
  'Diego - Grupo Santana',
  '00000000002',
  'diego@gruposantana.com.br',
  '00000000002',
  'Grupo Santana - Administração',
  'M',
  'diego@gruposantana.com.br',
  'admin',
  true,
  '0.00',
  '0.00',
  false,
  NOW(),
  NOW()
) 
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = 'admin',
  is_active = true,
  updated_at = NOW()
RETURNING id, username, email, role, is_active;