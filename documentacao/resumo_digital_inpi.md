# Resumo Digital - Sistema "Indique e Ganhe"

## Informações Gerais

**Nome do Software:** Indique e Ganhe
**Versão:** 1.0.0
**Data de Criação:** Maio/2025
**Proprietário:** Grupo Santana
**Código de Assinatura:** GS25-9D7F4B2E835CAC1170-AUTHCODE-PROTECTED

## Descrição Técnica

### Objetivo do Software
O "Indique e Ganhe" é uma plataforma web que permite que pessoas cadastrem-se como indicadores e ganhem comissões ao referenciarem proprietários de veículos sem seguro para o Grupo Santana. O sistema gerencia todo o ciclo de indicações, desde o cadastro até o pagamento das comissões.

### Arquitetura e Tecnologias
- **Arquitetura:** Aplicação Web Fullstack
- **Frontend:** React.js com TypeScript, TailwindCSS, Shadcn/UI
- **Backend:** Node.js, Express.js
- **Banco de Dados:** PostgreSQL
- **ORM:** Drizzle
- **Gerenciamento de Estado:** TanStack Query
- **Autenticação:** Passport.js, scrypt (algoritmo de hash)
- **Navegação:** Wouter

### Funcionalidades Principais
1. **Gestão de Usuários:**
   - Cadastro e autenticação de indicadores
   - Perfis de usuário (indicador e administrador)
   - Proteção de rotas baseada em perfil

2. **Sistema de Indicações:**
   - Cadastro de indicações com dados básicos e placa do veículo
   - Rastreamento de status das indicações (pendente, processando, convertido, rejeitado, validado, pago)
   - Cálculo automático de comissões

3. **Painel do Indicador:**
   - Visão geral de indicações e comissões
   - Histórico completo de indicações
   - Projeção de ganhos

4. **Painel Administrativo:**
   - Gestão de todos os indicadores
   - Aprovação/rejeição de indicações
   - Processamento de pagamentos
   - Relatórios de desempenho

5. **Sistema de Comissões:**
   - R$3,00 por indicação com dados válidos
   - Sistema de arredondamento: R$10,00 a cada 3 indicações (em vez de R$9,00)
   - Pagamento até o dia 15 do mês seguinte

### Detalhes Técnicos de Implementação
- Implementação de REST API para comunicação frontend-backend
- Utilização de Hooks customizados React para gerenciamento de estado
- Sistema de proteção de rotas baseado em autenticação
- Hash de senhas usando scrypt com salt aleatório para segurança
- Validação de dados usando ZOD para tipo-segurança
- Armazenamento de sessão com tokens seguros

## Campo de Aplicação
O software é aplicado no setor de seguros automotivos, especificamente para criação de uma rede de indicadores não-profissionais que podem gerar leads qualificados para a empresa. O sistema incentiva a indicação de potenciais clientes através de um modelo de remuneração simples e transparente.

## Originalidade e Inovação
O sistema inova ao trazer um modelo de indicação simplificado, onde qualquer pessoa pode se tornar um indicador sem necessidade de conhecimento técnico sobre seguros. A plataforma também implementa um sistema de arredondamento de comissões que beneficia os usuários mais ativos, estimulando maior engajamento.

---

**Documento preparado para registro no INPI**  
*Grupo Santana - Maio/2025*