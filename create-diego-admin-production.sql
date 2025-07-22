-- Script SQL para criar/atualizar diego@gruposantana.com.br como admin no banco de produção
-- Execute este script no console do banco de dados PostgreSQL de produção

-- Primeiro, verificar se o usuário já existe
SELECT id, username, email, role, is_active, created_at 
FROM users 
WHERE username = 'diego@gruposantana.com.br';

-- Se existir, execute este UPDATE para torná-lo admin:
UPDATE users 
SET 
  role = 'admin',
  password = 'c5ba67a0e7392279c6240e98f403b34e12806fa8dc938a0b045da949f21bce8f0e3de35ab39a6e99dcb18a5327ba8a4e67ced752b80fbeead1f623c3901fc872.9f85488ca673d1a96ba223344c6323ad', -- senha: admin123
  is_active = true,
  must_change_password = false,
  updated_at = NOW()
WHERE username = 'diego@gruposantana.com.br'
RETURNING id, username, email, role;

-- Se NÃO existir, execute este INSERT:
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
  'c5ba67a0e7392279c6240e98f403b34e12806fa8dc938a0b045da949f21bce8f0e3de35ab39a6e99dcb18a5327ba8a4e67ced752b80fbeead1f623c3901fc872.9f85488ca673d1a96ba223344c6323ad', -- senha: admin123
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
) ON CONFLICT (username) DO UPDATE SET
  role = 'admin',
  password = EXCLUDED.password,
  is_active = true,
  must_change_password = false,
  updated_at = NOW()
RETURNING id, username, email, role, created_at;

-- Verificar o resultado final
SELECT id, username, email, role, is_active, created_at, updated_at 
FROM users 
WHERE username = 'diego@gruposantana.com.br';

-- ============================================
-- CREDENCIAIS PARA LOGIN:
-- Email: diego@gruposantana.com.br
-- Senha: admin123
-- Perfil: admin (administrador)
-- ============================================