# Documentação Técnica - Sistema "Indique e Ganhe"

## Estrutura do Projeto

### Organização de Diretórios
```
/
├── client/               # Frontend da aplicação
│   ├── public/           # Arquivos estáticos
│   └── src/              # Código-fonte do frontend
│       ├── components/   # Componentes React reutilizáveis
│       ├── hooks/        # Hooks personalizados (useAuth, etc.)
│       ├── lib/          # Funções utilitárias e configurações
│       └── pages/        # Páginas da aplicação
├── db/                   # Configurações de banco de dados
├── server/               # Backend da aplicação
│   ├── auth.ts           # Autenticação de usuários
│   ├── routes.ts         # Rotas da API
│   └── storage.ts        # Acesso aos dados
└── shared/               # Código compartilhado entre frontend e backend
    └── schema.ts         # Definição do modelo de dados
```

## Modelo de Dados

### Tabelas Principais

#### Usuários (users)
```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  cpf: text("cpf").notNull().unique(),
  birthdate: text("birthdate").notNull(),
  bank: text("bank"),
  agency: text("agency"),
  account: text("account"),
  role: text("role").default("referrer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

#### Indicações (referrals)
```typescript
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  licensePlate: text("license_plate").notNull(),
  comments: text("comments"),
  status: text("status").default("pending").notNull().$type<ReferralStatus>(),
  commission: decimal("commission", { precision: 10, scale: 2 }),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
});
```

### Relacionamentos
```typescript
export const usersRelations = relations(users, ({ many }) => ({
  referrals: many(referrals),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  user: one(users, { fields: [referrals.userId], references: [users.id] }),
}));
```

## Fluxos Principais

### Autenticação
1. O usuário acessa a página de login ou registro
2. Após a submissão de credenciais, o cliente envia uma requisição POST para /api/login ou /api/register
3. O servidor valida os dados e, se corretos:
   - Para login: autentica o usuário e retorna seus dados
   - Para registro: cria um novo usuário, autentica e retorna seus dados
4. O cliente armazena os dados do usuário no estado global de autenticação
5. Rotas protegidas verificam a presença do usuário no estado antes de renderizar

### Ciclo de Indicações
1. Usuário autenticado cria uma nova indicação preenchendo os dados básicos
2. A indicação é enviada ao servidor com status "pending"
3. Administradores visualizam indicações pendentes e podem:
   - Atualizar para "processing" quando iniciam o contato
   - Atualizar para "converted" quando há interesse
   - Atualizar para "rejected" quando recusada
   - Atualizar para "validated" quando dados são validados (gera comissão de R$3)
   - Atualizar para "paid" quando o pagamento é realizado
4. A cada mudança de status, o sistema recalcula comissões e notifica o usuário

### Processamento de Comissões
1. Indicações com status "validated" geram comissão de R$3 cada
2. Sistema agrupa indicações em conjuntos de 3 para aplicar o arredondamento
3. Para cada conjunto completo, adiciona R$1 de bônus (total R$10)
4. Administradores podem visualizar comissões pendentes por usuário
5. Ao efetuar pagamento, status muda para "paid" com registro da data

## Segurança

### Autenticação
- Senhas armazenadas com algoritmo scrypt
- Salt único por usuário
- Comparação time-safe para prevenir timing attacks
- Sessões gerenciadas via cookies HTTP-only

### Autorização
- Middleware de autenticação para proteger rotas da API
- Verificação de perfil para ações administrativas
- Componentes de rota protegida no frontend

### Validação de Dados
- Validação completa via Zod tanto no frontend quanto no backend
- Sanitização de dados antes de operações no banco

## Implementação Técnica

### Frontend
- React com TypeScript para tipo-segurança
- TanStack Query para gerenciamento de estado assíncrono
- Componentes de UI construídos com TailwindCSS e Shadcn
- Formulários gerenciados com react-hook-form
- Interface responsiva para desktop e dispositivos móveis

### Backend
- Express.js com TypeScript
- Middleware de autenticação com Passport.js
- ORM Drizzle para operações no banco de dados
- Sistema de logs para auditoria
- Tratamento centralizado de erros

## Processo de Deployment
- Configuração via Replit para ambiente de desenvolvimento
- Builds otimizados para produção
- Migração automática de esquema de banco de dados
- Proteção de rotas sensíveis em ambiente de produção

---

**Documento preparado para registro técnico**  
*Grupo Santana - Maio/2025*