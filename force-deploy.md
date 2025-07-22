# Como Forçar Deploy das Mudanças no Replit

## Problema
O Replit Deploy às vezes não reflete as mudanças mais recentes do desenvolvimento.

## Soluções Implementadas

### 1. Build Manual Executado
- ✅ Executado `npm run build` com sucesso
- ✅ Gerados arquivos na pasta `dist/`
- ✅ Build inclui todas as mudanças do papel Gerente

### 2. Verificações de Deploy
- **Script de build**: `vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`
- **Script de start**: `NODE_ENV=production node dist/index.js`
- **Deployment target**: `autoscale` configurado no `.replit`

### 3. Passos para Forçar Deploy
1. **Build manual realizado** ✅
2. **Limpar cache do navegador** - Recomendado para testar
3. **Verificar deploy no painel Replit** - Clicar em "Deploy" novamente
4. **Aguardar propagação** - Pode levar alguns minutos

### 4. Mudanças Implementadas (Devem aparecer no deploy)
- ✅ Novo papel "Gerente" no sistema
- ✅ Dashboard em `/manager` para gerentes
- ✅ Navegação atualizada no header
- ✅ Formulário de criação de usuários com papel gerente
- ✅ Rotas protegidas para gerentes
- ✅ Cores verdes para identificação visual

## Verificações de Deploy
1. Acesse: https://indique.replit.app/admin/profiles
2. Verifique se aparece "Gerente" no dropdown de papel
3. Teste login com usuário gerente (se criado)
4. Verifique se aparece "Painel Gerente" no menu

## Se o problema persistir
- Esperar alguns minutos para propagação
- Limpar cache do navegador (Ctrl+F5)
- Tentar navegação anônima/incógnito
- Verificar se o deploy foi acionado corretamente no painel Replit