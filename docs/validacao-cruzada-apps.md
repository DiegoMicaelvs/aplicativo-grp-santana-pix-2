# Sistema de Validação Cruzada Entre Aplicativos

## Visão Geral

Este documento explica como configurar e usar o sistema de validação cruzada para prevenir duplicidade de cadastros entre diferentes instâncias do aplicativo "Indique e Ganhe".

## Problema Resolvido

Quando você faz um remix/fork do aplicativo, cada instância tem seu próprio banco de dados isolado. Isso permite que um mesmo usuário se cadastre em múltiplos aplicativos e indique a mesma placa várias vezes, recebendo comissões duplicadas.

## Solução Implementada

### 1. API de Validação Cruzada

Cada aplicativo expõe um endpoint seguro `/api/validate/cross-app` que permite outros aplicativos verificarem:
- CPFs já cadastrados
- Telefones já cadastrados  
- Placas já indicadas

### 2. Validação Bidirecional

Ao criar um novo usuário ou indicação, o sistema:
1. Verifica duplicatas no banco local
2. Consulta APIs de outros aplicativos configurados
3. Bloqueia o cadastro se encontrar duplicatas

## Configuração

### Passo 1: Configure o Secret de Autenticação

No Replit Secrets, adicione:
```
CROSS_APP_SECRET=sua-chave-secreta-compartilhada
```

**Importante**: Use a mesma chave em todos os aplicativos que devem compartilhar validação.

### Passo 2: Configure as URLs dos Outros Aplicativos

Edite o arquivo `server/crossAppValidation.ts` e adicione as URLs:

```typescript
export const CENTRAL_VALIDATION_APIS = [
  'https://app-principal.replit.app',
  'https://app-secundario.replit.app',
  // Adicione todas as instâncias aqui
];
```

### Passo 3: Ative a Validação nas Rotas

A validação já está integrada em:
- Registro de novos usuários (`/api/register`)
- Criação de indicações (`/api/referrals`)
- Criação de usuários pelo admin
- Criação de usuários por analistas

## Como Funciona

### Fluxo de Validação

1. **Usuário tenta se cadastrar**
   - Sistema verifica CPF e telefone localmente
   - Consulta outros apps via API
   - Se encontrar duplicata, bloqueia com mensagem específica

2. **Usuário tenta criar indicação**
   - Sistema verifica placa e telefone localmente
   - Consulta outros apps via API
   - Se encontrar duplicata, mostra quem já indicou

### Mensagens de Erro

- **CPF duplicado**: "Este CPF já está cadastrado em outro aplicativo"
- **Telefone duplicado**: "Este telefone já está cadastrado em outro aplicativo"
- **Placa duplicada**: "Esta placa já foi indicada em outro aplicativo"

## Segurança

1. **Autenticação por Secret**: Apenas apps com o secret correto podem consultar
2. **Timeout de Requisições**: Se um app estiver offline, não bloqueia o cadastro
3. **Logs de Auditoria**: Todas as validações são registradas

## Cenários de Uso

### Cenário 1: Rede de Parceiros
- Empresa principal tem app principal
- Cada parceiro tem seu próprio remix
- Todos compartilham a mesma base de validação
- Evita que indicadores "pulem" entre parceiros

### Cenário 2: Multi-regional
- Um app por região/estado
- Validação cruzada evita cadastros duplicados
- Mantém integridade dos dados nacionalmente

## Troubleshooting

### Problema: Validação não está funcionando

1. Verifique se `CROSS_APP_SECRET` está configurado
2. Confirme que as URLs em `CENTRAL_VALIDATION_APIS` estão corretas
3. Teste o endpoint manualmente:

```bash
curl -X POST https://seu-app.replit.app/api/validate/cross-app \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "12345678900",
    "appSecret": "sua-chave-secreta"
  }'
```

### Problema: Falsos positivos

Se usuários legítimos estão sendo bloqueados:
1. Verifique se não há apps de teste nas URLs
2. Confirme que os bancos estão sincronizados
3. Use o painel admin para verificar duplicatas

## Desabilitar Validação

Para desabilitar temporariamente:
1. Remova o `CROSS_APP_SECRET` das variáveis
2. Ou deixe `CENTRAL_VALIDATION_APIS` vazio

## Monitoramento

O sistema registra:
- Todas as tentativas de validação
- Apps que consultaram
- Duplicatas encontradas
- Erros de comunicação

Acesse os logs no painel admin em "Logs de Auditoria".