# Como Criar Admin no Ambiente de Produção

## Instruções Passo a Passo

### 1. Acesse o Console do Replit Deploy

1. Entre no Replit: https://replit.com
2. Abra seu projeto
3. Clique na aba **"Deployments"** no menu lateral
4. Clique no deployment ativo (deve mostrar um status verde)
5. Procure e clique em **"Console"** ou **"Shell"**

### 2. No Console, Execute os Comandos

Cole e execute estes comandos um por vez:

```bash
# Navegue até a pasta de scripts
cd scripts

# Execute o script para criar admin
tsx create-production-admin.ts
```

### 3. Resultado Esperado

Se o admin for criado com sucesso, você verá:

```
✅ ADMIN CRIADO COM SUCESSO!
────────────────────────────────────────
📧 Email/Username: admin@kongpix.com.br
🔑 Senha: admin123
🆔 ID: [número do ID]
📅 Criado em: [data e hora]
────────────────────────────────────────
```

Se o admin já existir, você verá:

```
❌ Usuário admin já existe com ID: [número]
💡 Dica: Se esqueceu a senha, use:
   cd scripts && tsx reset-admin-password.ts admin@kongpix.com.br nova-senha
```

### 4. Acesse o Sistema

1. Vá para: https://indique.replit.app
2. Faça login com:
   - **Email**: admin@kongpix.com.br
   - **Senha**: admin123

## Comandos Úteis Adicionais

### Redefinir Senha (se necessário)
```bash
cd scripts && tsx reset-admin-password.ts admin@kongpix.com.br nova-senha-aqui
```

### Verificar Usuários Existentes
```bash
cd scripts && tsx diagnose-database-sync.ts
```

### Criar Outros Usuários Admin
Modifique o email e execute novamente:
```bash
# Edite o arquivo create-production-admin.ts primeiro
# Depois execute:
tsx create-production-admin.ts
```

## Notas Importantes

- **Cada ambiente tem seu próprio banco**: Usuários criados no preview não aparecem na produção
- **Sempre use produção para dados reais**: https://indique.replit.app
- **Guarde as credenciais com segurança**: admin@kongpix.com.br / admin123

## Problemas Comuns

### "Command not found: tsx"
Execute primeiro:
```bash
npm install
```

### "Database connection error"
Verifique se está no console do Deploy (produção), não no preview.

### "User already exists"
Use o comando de redefinir senha mostrado acima.