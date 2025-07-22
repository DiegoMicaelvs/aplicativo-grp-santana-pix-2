# Solução para Bancos de Dados Separados (Preview vs Produção)

## O Problema

O Replit mantém bancos de dados completamente separados para cada ambiente:

1. **Ambiente Preview (Desenvolvimento)**: Usa um banco PostgreSQL local do Repl
2. **Ambiente Publicado (Produção)**: Usa um banco PostgreSQL criado durante o deploy

Por isso, usuários criados em um ambiente não aparecem no outro - são bancos de dados completamente diferentes!

## Soluções Disponíveis

### 1. Usar Sempre o Ambiente Publicado (Recomendado)

Para garantir consistência, sempre use o ambiente publicado (https://indique.replit.app) para:
- Cadastrar novos usuários
- Fazer testes reais
- Demonstrações

O ambiente de preview deve ser usado apenas para desenvolvimento.

### 2. Exportar/Importar Dados Entre Ambientes

Criamos um script para sincronizar dados quando necessário:

```bash
# No ambiente de origem (onde estão os dados)
cd scripts && tsx export-import-data.ts export

# No ambiente de destino (onde quer importar)
cd scripts && tsx export-import-data.ts import
```

### 3. Scripts de Manutenção Disponíveis

```bash
# Verificar qual ambiente e banco está sendo usado
cd scripts && tsx diagnose-database-sync.ts

# Redefinir senha de qualquer usuário
cd scripts && tsx reset-admin-password.ts email@exemplo.com nova-senha

# Limpar sessões antigas
cd scripts && tsx clean-sessions.ts

# Verificar configurações do ambiente
cd scripts && tsx check-environment.ts
```

### 4. Criar Usuário Admin em Ambos Ambientes

Para facilitar, você pode criar o mesmo usuário admin em ambos ambientes:

```bash
# Executar no ambiente preview
cd scripts && tsx ../db/create-admin.ts

# Depois fazer deploy e executar no ambiente publicado
cd scripts && tsx ../db/create-admin.ts
```

## Dados Atuais no Banco

### Ambiente Atual (Preview)
- Total de usuários: 4
- Usuários admin:
  - admin@kongpix.com.br (senha: admin123)
  - diegomicael58@gmail.com
  - admin@gruposantana.com

### Para Verificar o Ambiente Publicado
1. Acesse https://indique.replit.app
2. Faça login com as credenciais criadas lá
3. Ou execute os scripts de diagnóstico no console do Replit Deploy

## Recomendações

1. **Para Produção**: Use sempre o ambiente publicado
2. **Para Desenvolvimento**: Use o preview, mas lembre que os dados são separados
3. **Para Sincronizar**: Use o script export/import quando necessário
4. **Para Problemas de Login**: Verifique em qual ambiente o usuário foi criado

## Observação Importante

Esta separação de bancos é uma característica de segurança do Replit - evita que dados de desenvolvimento se misturem com dados de produção. É uma boa prática, mas precisa ser gerenciada corretamente.