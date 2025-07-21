# Instruções de Teste de Login em Produção

## Problema Identificado
O login funciona no preview local mas não no link publicado (https://indique.replit.app).

## Ajustes Realizados

### 1. Configurações de Cookie
- Removido `secure: true` para permitir cookies em HTTP e HTTPS
- Cookie configurado com `sameSite: "lax"`
- Nome da sessão definido como `kong.sid`

### 2. CORS Configurado
- Permite requisições de domínios `replit.app`
- Credenciais habilitadas (`Access-Control-Allow-Credentials: true`)

### 3. Trust Proxy
- Configurado `app.set("trust proxy", 1)` para funcionar atrás de proxy

## Como Testar

1. **Limpar dados do navegador**:
   - Abra o DevTools (F12)
   - Vá em Application > Storage > Clear site data
   - Ou use uma aba anônima

2. **Tentar login novamente**:
   - URL: https://indique.replit.app/auth
   - Usuário: `admin@kongpix.com.br`
   - Senha: `admin123`

3. **Verificar no DevTools**:
   - Na aba Network, procure a requisição POST para `/api/login`
   - Verifique se há cookie `kong.sid` sendo definido
   - Na aba Application > Cookies, verifique se o cookie foi salvo

## Possíveis Soluções Adicionais

Se ainda não funcionar, pode ser necessário:

1. **Configurar variável de ambiente**:
   - Adicionar `SESSION_SECRET` nas variáveis de ambiente do Replit
   - Valor: string aleatória segura (ex: resultado de `openssl rand -hex 32`)

2. **Verificar domínio**:
   - O Replit pode estar usando HTTPS mas reportando como HTTP
   - Isso pode causar problemas com cookies secure

3. **Debug adicional**:
   - Verificar logs do servidor para erros de sessão
   - Testar com diferentes navegadores