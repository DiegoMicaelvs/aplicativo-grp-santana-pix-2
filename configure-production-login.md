# SOLUÇÃO PARA LOGIN NO DOMÍNIO PUBLICADO

## PROBLEMA IDENTIFICADO
O login não persiste em https://indique.replit.app porque:
- ❌ Variável `NODE_ENV` não está configurada
- ✅ Variável `SESSION_SECRET` existe
- Sem `NODE_ENV=production`, os cookies não são configurados corretamente para HTTPS

## PASSOS PARA RESOLVER (FAÇA AGORA)

### 1. Configure NODE_ENV no Replit
1. No painel do Replit, clique no ícone de **🔒 Secrets** (cadeado) na barra lateral esquerda
2. Clique em **"New Secret"**
3. Adicione:
   - **Key**: `NODE_ENV`
   - **Value**: `production`
4. Clique em **"Add Secret"**

### 2. Reinicie o Servidor
1. No Replit, clique no botão **"Stop"** no console
2. Depois clique em **"Run"** novamente
3. Aguarde o servidor reiniciar completamente

### 3. Limpe os Dados do Navegador
**IMPORTANTE**: Faça isso antes de testar!

**Opção A - Use Aba Anônima (Mais Fácil)**
- Chrome: Ctrl+Shift+N (Windows) ou Cmd+Shift+N (Mac)
- Firefox: Ctrl+Shift+P (Windows) ou Cmd+Shift+P (Mac)
- Edge: Ctrl+Shift+N (Windows) ou Cmd+Shift+N (Mac)

**Opção B - Limpe os Dados do Site**
1. Abra https://indique.replit.app
2. Pressione F12 para abrir o DevTools
3. Vá em **Application** > **Storage**
4. Clique em **"Clear site data"**

### 4. Teste o Login
1. Acesse: https://indique.replit.app/auth
2. Use as credenciais de administrador do ambiente.

> **Senhas não ficam neste arquivo.** Este documento é versionado num
> repositório público — as senhas de produção que estavam aqui devem ser
> consideradas comprometidas e trocadas. Para definir ou redefinir a senha do
> admin, use a variável de ambiente:
>
> ```bash
> ADMIN_PASSWORD='<senha forte>' npm run db:create-admin
> ```

## VERIFICAÇÃO
Para confirmar que funcionou:
1. Após login bem-sucedido, você deve ser redirecionado ao dashboard
2. Recarregue a página (F5) - você deve continuar logado
3. Se foi solicitado trocar senha, faça isso primeiro

## SE AINDA NÃO FUNCIONAR

### Verifique no Console (F12)
1. Na aba **Network**, procure a requisição POST para `/api/login`
2. Clique nela e veja a aba **Response Headers**
3. Deve ter: `set-cookie: kong.sid=...`

### Teste em Outro Navegador
- Chrome geralmente funciona melhor
- Safari pode ter restrições extras de segurança

### Configuração Adicional (se necessário)
No Chrome, se ainda tiver problemas:
1. Vá em Configurações > Privacidade e Segurança > Cookies
2. Adicione https://indique.replit.app como site permitido

## RESUMO
✅ NODE_ENV=production (CONFIGURE AGORA)
✅ SESSION_SECRET já existe
✅ Limpar dados do navegador
✅ Testar login novamente

O problema principal é a falta do NODE_ENV. Após configurá-lo, o login deve funcionar perfeitamente!