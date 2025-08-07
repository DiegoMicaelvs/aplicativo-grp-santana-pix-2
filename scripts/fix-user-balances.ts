#!/usr/bin/env tsx

/**
 * Script para recalcular os saldos de todos os usuários baseado nas indicações atuais
 * Corrige inconsistências causadas por atribuições de indicações sem transferência de comissões
 */

import { config } from 'dotenv';
import { db } from '../db';
import { users, referrals, withdrawalRequests } from '../shared/schema';
import { eq, sql, and, or } from 'drizzle-orm';

config({ path: '.env' });

async function fixUserBalances() {
  console.log('=== Iniciando correção de saldos dos usuários ===\n');
  
  try {
    // 1. Buscar todos os usuários
    const allUsers = await db.select().from(users);
    console.log(`Total de usuários: ${allUsers.length}\n`);
    
    // 2. Zerar saldos e total de ganhos de todos os usuários
    console.log('Zerando saldos para recalcular...');
    await db.update(users)
      .set({ 
        balance: '0',
        totalEarnings: '0'
      });
    
    // 3. Recalcular baseado nas indicações
    console.log('\nRecalculando saldos baseado nas indicações...\n');
    
    const allReferrals = await db.select().from(referrals);
    
    // Agrupar indicações por usuário
    const referralsByUser = new Map<number, typeof allReferrals>();
    
    for (const referral of allReferrals) {
      const userId = referral.userId;
      if (!referralsByUser.has(userId)) {
        referralsByUser.set(userId, []);
      }
      referralsByUser.get(userId)!.push(referral);
    }
    
    // Calcular comissões para cada usuário
    for (const [userId, userReferrals] of referralsByUser) {
      let totalCommission = 0;
      let referralCount = 0;
      
      for (const referral of userReferrals) {
        const commission = parseFloat(referral.commissionIndicator?.toString() || '0');
        if (commission > 0) {
          totalCommission += commission;
          referralCount++;
        }
      }
      
      if (totalCommission > 0) {
        const user = allUsers.find(u => u.id === userId);
        console.log(`Usuário ${user?.fullName || userId}: ${referralCount} indicações, total: R$ ${totalCommission.toFixed(2)}`);
        
        // Atualizar total de ganhos
        await db.update(users)
          .set({ 
            totalEarnings: totalCommission.toString()
          })
          .where(eq(users.id, userId));
      }
    }
    
    // 4. Calcular comissões de promotores
    console.log('\nCalculando comissões de promotores...\n');
    
    const referralsByPromoter = new Map<number, typeof allReferrals>();
    
    for (const referral of allReferrals) {
      const promoterId = referral.promoterId;
      if (promoterId) {
        if (!referralsByPromoter.has(promoterId)) {
          referralsByPromoter.set(promoterId, []);
        }
        referralsByPromoter.get(promoterId)!.push(referral);
      }
    }
    
    for (const [promoterId, promoterReferrals] of referralsByPromoter) {
      let totalPromoterCommission = 0;
      let referralCount = 0;
      
      for (const referral of promoterReferrals) {
        const commission = parseFloat(referral.commissionPromoter?.toString() || '0');
        if (commission > 0) {
          totalPromoterCommission += commission;
          referralCount++;
        }
      }
      
      if (totalPromoterCommission > 0) {
        const promoter = allUsers.find(u => u.id === promoterId);
        console.log(`Promotor ${promoter?.fullName || promoterId}: ${referralCount} indicações, comissão: R$ ${totalPromoterCommission.toFixed(2)}`);
        
        // Adicionar ao total de ganhos do promotor
        await db.update(users)
          .set({ 
            totalEarnings: sql`total_earnings + ${totalPromoterCommission}`
          })
          .where(eq(users.id, promoterId));
      }
    }
    
    // 5. Agora calcular o saldo disponível (total de ganhos - saques aprovados/pagos)
    console.log('\nCalculando saldos disponíveis (total - saques)...\n');
    
    const allWithdrawals = await db.select().from(withdrawalRequests)
      .where(or(
        eq(withdrawalRequests.status, 'approved'),
        eq(withdrawalRequests.status, 'paid')
      ));
    
    // Agrupar saques por usuário
    const withdrawalsByUser = new Map<number, number>();
    
    for (const withdrawal of allWithdrawals) {
      const userId = withdrawal.userId;
      const amount = parseFloat(withdrawal.amount?.toString() || '0');
      
      if (!withdrawalsByUser.has(userId)) {
        withdrawalsByUser.set(userId, 0);
      }
      withdrawalsByUser.set(userId, withdrawalsByUser.get(userId)! + amount);
    }
    
    // Atualizar saldos finais
    for (const user of allUsers) {
      const totalEarnings = parseFloat(user.totalEarnings?.toString() || '0');
      const totalWithdrawals = withdrawalsByUser.get(user.id) || 0;
      const balance = totalEarnings - totalWithdrawals;
      
      if (totalEarnings > 0 || totalWithdrawals > 0) {
        console.log(`${user.fullName}:`);
        console.log(`  Total ganho: R$ ${totalEarnings.toFixed(2)}`);
        console.log(`  Total sacado: R$ ${totalWithdrawals.toFixed(2)}`);
        console.log(`  Saldo disponível: R$ ${balance.toFixed(2)}\n`);
        
        await db.update(users)
          .set({ 
            balance: balance.toString()
          })
          .where(eq(users.id, user.id));
      }
    }
    
    console.log('=== Correção de saldos concluída com sucesso! ===');
    
  } catch (error) {
    console.error('Erro ao corrigir saldos:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Executar o script
fixUserBalances();