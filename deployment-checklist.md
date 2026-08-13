# Checklist de Deploy - Sistema Indique e Ganhe Kong Pix

## ✅ Preparação Concluída

### 1. Limpeza de Dados
- [x] Usuários de teste removidos
- [x] Indicações de teste removidas
- [x] Logs de auditoria limpos
- [x] Empresas de teste removidas

### 2. Configurações de Segurança
- [x] Headers de segurança implementados
- [x] Rate limiting básico implementado
- [x] Proteção contra XSS ativa
- [x] Senha master configurada
- [x] Validação de dados com Zod

### 3. Rebranding Kong Pix
- [x] Nome da empresa atualizado
- [x] Cores do tema aplicadas
- [x] Links de redes sociais atualizados
- [x] Política de privacidade atualizada
- [x] Termos de uso atualizados

### 4. Administrador Kong Pix
- [x] Criar admin@kongpix.com.br
- [x] Senha temporária: admin123
- [x] Forçar mudança de senha no primeiro login

## 📋 Tarefas Pendentes para Deploy

### Antes do Deploy:
1. [ ] Alterar senha master no arquivo `server/config.ts`
2. [ ] Configurar variáveis de ambiente:
   ```
   DATABASE_URL=<sua-url-postgresql>
   NODE_ENV=production
   SESSION_SECRET=<valor-aleatorio-seguro>
   MASTER_PASSWORD=<nova-senha-master>
   ```
3. [ ] Revisar e ajustar rate limiting se necessário
4. [ ] Verificar certificado SSL configurado

### Após o Deploy:
1. [ ] Acessar com admin@kongpix.com.br
2. [ ] Alterar senha do administrador
3. [ ] Criar usuários de produção necessários
4. [ ] Configurar monitoramento
5. [ ] Testar todas as funcionalidades críticas

## 🔒 Informações Sensíveis

### Credenciais

Nenhuma credencial fica neste arquivo — ele é versionado num repositório
público. Este bloco já trouxe a senha do admin e a senha master em texto claro;
elas devem ser consideradas comprometidas e trocadas (continuam no histórico do
git, que não se apaga com um commit novo).

Onde cada uma vive agora:

| Credencial            | Origem                                            |
|-----------------------|---------------------------------------------------|
| Senha do admin        | `ADMIN_PASSWORD` ao rodar `npm run db:create-admin` |
| Senha master          | `MASTER_PASSWORD` (variável de ambiente)           |
| Master do desenvolvedor | `DEVELOPER_MASTER_PASSWORD`                      |
| Banco de dados        | `DATABASE_URL`                                     |
| Sessão                | `SESSION_SECRET`                                   |

Em produção, todas ficam nas *Environment Variables* do projeto na Vercel.

### ⚠️ Problema de Login em Produção:
Se o login não funcionar no link publicado (https://indique.replit.app):
1. Limpe os cookies/cache do navegador ou use aba anônima
2. Configure a variável SESSION_SECRET no Replit
3. Verifique o arquivo test-login-production.md para mais detalhes

### Dados do Sistema:
- Total de usuários: 2 (1 admin antigo + 1 admin Kong Pix)
- Total de indicações: 1
- Total de empresas: 1 (Kong Pix Proteção Veicular)

## ⚠️ Avisos Importantes

1. **SEMPRE** altere a senha master antes de ir para produção
2. **SEMPRE** use HTTPS em produção
3. **SEMPRE** faça backup antes de qualquer mudança
4. **NUNCA** exponha logs com informações sensíveis
5. **MONITORE** tentativas de login suspeitas

## 🚀 Comando de Deploy

Quando estiver pronto para deploy no Replit:
1. Certifique-se que todas as tarefas acima foram concluídas
2. Teste localmente uma última vez
3. Use o botão "Deploy" do Replit
4. Aguarde a confirmação de deploy bem-sucedido
5. Teste imediatamente no ambiente de produção