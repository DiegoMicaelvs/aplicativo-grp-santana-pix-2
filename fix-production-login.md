# Solução Definitiva para Login em Produção

## O Problema

O login funciona no preview local mas falha no deploy do Replit devido a:
1. Cookies não sendo salvos corretamente entre domínios
2. Configurações de segurança do navegador bloqueando cookies third-party
3. Diferença entre ambiente HTTP local e HTTPS em produção

## Solução Implementada

### 1. Configurações de Cookie Ajustadas
```javascript
cookie: {
  secure: process.env.NODE_ENV === "production", // HTTPS em produção
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  httpOnly: true,
  path: "/"
}
```

### 2. CORS Configurado
- Permite credenciais (`credentials: true`)
- Aceita requisições de qualquer origem temporariamente

### 3. Trust Proxy Ativado
- `app.set("trust proxy", 1)` para funcionar atrás do proxy Replit

## Passos para Resolver

### 1. Configure as Variáveis de Ambiente no Replit
No painel do Replit, vá em "Secrets" e adicione:
- `NODE_ENV` = `production`
- `SESSION_SECRET` = (gere um valor aleatório seguro)

### 2. Limpe TODOS os Dados do Site
1. Abra o DevTools (F12)
2. Vá em Application > Storage
3. Clique em "Clear site data"
4. OU use uma nova aba anônima/privada

### 3. Teste o Login
- URL: https://indique.replit.app/auth
- Usuário: `admin@kongpix.com.br`
- Senha: `admin123`

### 4. Se Ainda Não Funcionar

#### Opção A: Verificar Console do Navegador
1. Abra DevTools (F12)
2. Vá na aba Console
3. Tente fazer login
4. Veja se há erros relacionados a cookies ou CORS

#### Opção B: Teste em Outro Navegador
- Chrome geralmente funciona melhor
- Safari pode ter restrições adicionais

#### Opção C: Desabilitar Proteção de Cookies (Temporário)
1. Chrome: Configurações > Privacidade > Cookies > Permitir todos
2. Firefox: about:config > network.cookie.sameSite.noneRequiresSecure = false

## Verificação Final

No DevTools > Network:
1. Procure a requisição POST para `/api/login`
2. Verifique os headers de resposta
3. Deve ter `Set-Cookie: kong.sid=...`
4. Se não tiver, o problema é no servidor

No DevTools > Application > Cookies:
1. Deve aparecer o cookie `kong.sid`
2. Verifique se `Secure` está marcado
3. Verifique se `SameSite` está como `None`

## Solução Alternativa

Se nada funcionar, pode ser necessário:
1. Usar autenticação baseada em tokens (JWT) ao invés de sessões
2. Hospedar em domínio próprio com certificado SSL
3. Usar proxy reverso para manter mesmo domínio