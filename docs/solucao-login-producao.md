# Solução para Problema de Login em Produção

## O Problema
Os usuários criados no ambiente de desenvolvimento (preview) não conseguiam fazer login no ambiente de produção (https://indique.replit.app), mesmo usando o mesmo banco de dados.

## Causa Raiz
1. **Banco de dados único**: Development e produção compartilham o mesmo banco PostgreSQL
2. **Configurações de cookies diferentes**: As sessões criadas em dev não funcionam em prod devido a diferenças nas configurações de cookies (secure, sameSite, domain)
3. **Detecção de ambiente**: O sistema não detectava corretamente quando estava em produção no Replit

## Solução Implementada

### 1. Detecção Inteligente de Ambiente
```javascript
const isProduction = process.env.NODE_ENV === "production" || 
                    process.env.REPLIT_DEPLOYMENT === "1" ||
                    (process.env.REPLIT_DEV_DOMAIN && !process.env.REPLIT_DEV_DOMAIN.includes("localhost"));
```

### 2. Configuração Adaptativa de Cookies
- **Desenvolvimento**: cookies com `secure: false` e `sameSite: "lax"`
- **Produção**: cookies com `secure: true`, `sameSite: "none"` e `domain: ".replit.app"`

### 3. Scripts de Manutenção
- `scripts/check-environment.ts`: Diagnostica configurações de ambiente
- `scripts/clean-sessions.ts`: Limpa sessões antigas e expiradas

## Como Testar

### Para Usuários
1. Limpe todos os cookies do navegador para o site ou use aba anônima
2. Acesse https://indique.replit.app
3. Faça login normalmente

### Para Desenvolvedores
1. Execute `cd scripts && tsx check-environment.ts` para verificar o ambiente
2. Execute `cd scripts && tsx clean-sessions.ts` para limpar sessões antigas
3. Monitore os logs com `[AUTH]` para ver o modo de operação

## Usuários de Teste
- **Admin**: admin@kongpix.com.br / <senha do ambiente>
- **Indicador**: diego@gruposantana.com.br / 123456
- **Teste**: teste@kongpix.com.br / 123456

## Notas Importantes
- Sempre use aba anônima ou limpe cookies ao alternar entre ambientes
- O sistema agora detecta automaticamente o ambiente de produção
- As sessões têm validade de 30 dias
- O banco de dados é compartilhado entre todos os ambientes