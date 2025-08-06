import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Definir permissões padrão por nível de analista
const DEFAULT_PERMISSIONS = {
  1: [
    'view_referrals',
    'view_users', 
    'view_reports',
    'edit_referral_status' // Essencial para editar status de indicações
  ],
  2: [
    'view_referrals',
    'view_users',
    'view_reports', 
    'edit_referral_status',
    'manage_withdrawals' // Nível 2 pode gerenciar saques
  ],
  3: [
    'view_referrals',
    'view_users',
    'view_reports',
    'edit_referral_status',
    'manage_withdrawals',
    'create_indicadores', // Nível 3 pode criar usuários
    'create_promotores'
  ]
};

export async function ensureAnalystPermissions(userId?: number) {
  try {
    // Se userId fornecido, atualizar apenas esse usuário
    if (userId) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (user && user.role === 'analista') {
        const level = user.analystLevel || 1;
        const defaultPerms = DEFAULT_PERMISSIONS[level as keyof typeof DEFAULT_PERMISSIONS] || DEFAULT_PERMISSIONS[1];
        const currentPerms = user.permissions || [];
        
        // Mesclar permissões existentes com as padrão
        const newPermissions = Array.from(new Set([...currentPerms, ...defaultPerms]));
        
        if (newPermissions.length !== currentPerms.length) {
          await db.update(users)
            .set({ permissions: newPermissions })
            .where(eq(users.id, userId));
            
          console.log(`✅ Permissões atualizadas para ${user.fullName} (Nível ${level})`);
          return newPermissions;
        }
      }
      return user?.permissions;
    }
    
    // Atualizar todos os analistas
    const analysts = await db.query.users.findMany({
      where: eq(users.role, 'analista')
    });
    
    console.log('Garantindo permissões corretas para todos os analistas...\n');
    
    for (const analyst of analysts) {
      const level = analyst.analystLevel || 1;
      const defaultPerms = DEFAULT_PERMISSIONS[level as keyof typeof DEFAULT_PERMISSIONS] || DEFAULT_PERMISSIONS[1];
      const currentPerms = analyst.permissions || [];
      
      // Mesclar permissões existentes com as padrão
      const newPermissions = Array.from(new Set([...currentPerms, ...defaultPerms]));
      
      if (newPermissions.length !== currentPerms.length) {
        await db.update(users)
          .set({ permissions: newPermissions })
          .where(eq(users.id, analyst.id));
          
        console.log(`✅ ${analyst.fullName} (Nível ${level}):`);
        console.log(`   Antes: ${currentPerms.join(', ') || 'Nenhuma'}`);
        console.log(`   Depois: ${newPermissions.join(', ')}\n`);
      } else {
        console.log(`✓ ${analyst.fullName} (Nível ${level}) - Permissões já estão corretas`);
      }
    }
    
    console.log('\n✅ Todas as permissões foram verificadas e atualizadas!');
    
  } catch (error) {
    console.error('Erro ao garantir permissões:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  ensureAnalystPermissions()
    .catch(console.error)
    .finally(() => process.exit(0));
}