-- ============================================
-- Script de Preparação para Produção
-- Sistema Indique e Ganhe - Kong Pix
-- ============================================

-- 1. LIMPAR DADOS DE TESTE
-- ============================================

-- Limpar conversações de teste
DELETE FROM referral_conversations WHERE referral_id IN (
  SELECT id FROM referrals WHERE notes LIKE '%teste%' OR notes LIKE '%test%'
);

-- Limpar atividades de vendas
DELETE FROM sales_activities WHERE lead_id IN (
  SELECT id FROM sales_leads WHERE notes LIKE '%teste%' OR notes LIKE '%test%'
);

-- Limpar lembretes de vendas
DELETE FROM sales_reminders WHERE lead_id IN (
  SELECT id FROM sales_leads WHERE notes LIKE '%teste%' OR notes LIKE '%test%'
);

-- Limpar leads de vendas de teste
DELETE FROM sales_leads WHERE notes LIKE '%teste%' OR notes LIKE '%test%';

-- Limpar respostas de tickets de teste
DELETE FROM ticket_responses WHERE ticket_id IN (
  SELECT id FROM support_tickets WHERE subject LIKE '%teste%' OR subject LIKE '%test%'
);

-- Limpar tickets de teste
DELETE FROM support_tickets WHERE subject LIKE '%teste%' OR subject LIKE '%test%';

-- Limpar fluxo de caixa de teste
DELETE FROM cash_flow WHERE description LIKE '%teste%' OR description LIKE '%test%';

-- Limpar solicitações de saque de teste
DELETE FROM withdrawal_requests WHERE id IN (
  SELECT id FROM withdrawal_requests wr
  JOIN users u ON wr.user_id = u.id
  WHERE u.email LIKE '%teste%' OR u.email LIKE '%test%'
);

-- Limpar indicações de teste
DELETE FROM referrals WHERE id IN (
  SELECT r.id FROM referrals r
  JOIN users u ON r.user_id = u.id
  WHERE u.email LIKE '%teste%' OR u.email LIKE '%test%'
  OR r.full_name LIKE '%teste%' OR r.full_name LIKE '%test%'
);

-- Limpar usuários de teste (exceto admin principal)
DELETE FROM users WHERE 
  (email LIKE '%teste%' OR email LIKE '%test%' OR full_name LIKE '%teste%' OR full_name LIKE '%test%')
  AND id != 4; -- Preservar admin principal

-- Limpar log de auditoria de ações de teste
DELETE FROM audit_log WHERE 
  details LIKE '%teste%' OR details LIKE '%test%'
  OR user_id IN (SELECT id FROM users WHERE email LIKE '%teste%' OR email LIKE '%test%');

-- 2. CRIAR ADMIN MASTER PARA PRODUÇÃO
-- ============================================

-- Verificar se existe o admin master
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin@kongpix.com.br') THEN
    INSERT INTO users (
      username, password, email, full_name, cpf, phone, 
      role, is_active, created_at, balance, total_earnings
    ) VALUES (
      'admin@kongpix.com.br',
      -- Senha: KongPix@2025! (você deve alterar após o primeiro login)
      '2a97516c354b5f3d1c3b3d1e1f4e3f3d3e3f3e3d1f4e3f3d3e3f3e3d1f4e3f3d.3d1f4e3f3d3e3f3e3d1f4e3f3d3e3f3e',
      'admin@kongpix.com.br',
      'Administrador Kong Pix',
      '00000000000',
      '00000000000',
      'admin',
      true,
      NOW(),
      0.00,
      0.00
    );
  END IF;
END $$;

-- 3. GARANTIR EMPRESAS PADRÃO
-- ============================================

-- Limpar empresas de teste
DELETE FROM companies WHERE name LIKE '%teste%' OR name LIKE '%test%';

-- Garantir que existe pelo menos uma empresa padrão
INSERT INTO companies (name, created_at) 
SELECT 'Kong Pix Proteção Veicular', NOW()
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Kong Pix Proteção Veicular');

-- 4. CRIAR ÍNDICES PARA MELHORAR PERFORMANCE
-- ============================================

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- 5. ESTATÍSTICAS FINAIS
-- ============================================

SELECT 'ESTATÍSTICAS APÓS LIMPEZA:' as info;

SELECT 
  'Total de Usuários: ' || COUNT(*) as estatistica 
FROM users WHERE is_active = true;

SELECT 
  'Total de Indicações: ' || COUNT(*) as estatistica 
FROM referrals;

SELECT 
  'Total de Empresas: ' || COUNT(*) as estatistica 
FROM companies;

SELECT 
  'Sistema preparado para produção!' as mensagem;