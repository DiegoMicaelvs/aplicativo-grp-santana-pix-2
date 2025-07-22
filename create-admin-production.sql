-- Script SQL para criar admin diretamente no banco de produção
-- Execute este script no console do banco de dados PostgreSQL

-- Primeiro, verificar se o admin já existe
SELECT id, username, email, is_active, created_at 
FROM users 
WHERE username = 'admin@kongpix.com.br';

-- Se não existir, execute este INSERT:
-- NOTA: A senha abaixo já está hasheada para "admin123"
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
  'c5ba67a0e7392279c6240e98f403b34e12806fa8dc938a0b045da949f21bce8f0e3de35ab39a6e99dcb18a5327ba8a4e67ced752b80fbeead1f623c3901fc872.9f85488ca673d1a96ba223344c6323ad',
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
) ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  is_active = true,
  updated_at = NOW()
RETURNING id, username, email, created_at;

-- Verificar se foi criado com sucesso
SELECT id, username, email, role, is_active, created_at 
FROM users 
WHERE username = 'admin@kongpix.com.br';

-- Credenciais para login:
-- Email: admin@kongpix.com.br
-- Senha: admin123