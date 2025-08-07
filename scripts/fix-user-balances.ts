#!/usr/bin/env tsx

/**
 * Script para recalcular os saldos de todos os usuários baseado nas indicações atuais
 * 
 * REGRA DE NEGÓCIO CORRIGIDA:
 * - balance: saldo disponível para saque (comissões de indicações validadas/convertidas ainda não sacadas)
 * - totalEarnings: valor total já pago ao usuário (apenas saques com status "paid")
 */

import { config } from 'dotenv';
import { db } from '../db';
import { users, referrals, withdrawalRequests } from '../shared/schema';
import { eq, sql, and, or } from 'drizzle-orm';

config({ path: '.env' });

async function fixUserBalances() {
  console.log('=== Iniciando correção de saldos dos usuários ===\n');
  console.log('REGRA DE NEGÓCIO:');
  console.log('- Saldo Disponível: comissões de indicações validadas/convertidas ainda não sacadas');
  console.log('- Total de Ganhos: valor total já pago ao usuário (saques pagos)\n');
  
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
    
    // 3. Calcular SALDO DISPONÍVEL baseado nas comissões de indicações
    console.log('\nCalculando SALDO DISPONÍVEL baseado nas indicações...\n');
    
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
    
    // Calcular comissões para cada usuário (indicador)
    const userCommissions = new Map<number, number>();
    
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
        userCommissions.set(userId, totalCommission);
        const user = allUsers.find(u => u.id === userId);
        console.log(`Indicador ${user?.fullName || userId}: ${referralCount} indicações, comissão total: R$ ${totalCommission.toFixed(2)}`);
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
        const currentCommission = userCommissions.get(promoterId) || 0;
        userCommissions.set(promoterId, currentCommission + totalPromoterCommission);
        const promoter = allUsers.find(u => u.id === promoterId);
        console.log(`Promotor ${promoter?.fullName || promoterId}: ${referralCount} indicações gerenciadas, comissão: R$ ${totalPromoterCommission.toFixed(2)}`);
      }
    }
    
    // 5. Calcular saques aprovados e pagos
    console.log('\nCalculando saques processados...\n');
    
    const allWithdrawals = await db.select().from(withdrawalRequests);
    
    // Separar saques por status
    const approvedWithdrawals = new Map<number, number>();  // Saques aprovados mas não pagos
    const paidWithdrawals = new Map<number, number>();      // Saques pagos
    
    for (const withdrawal of allWithdrawals) {
      const userId = withdrawal.userId;
      const amount = parseFloat(withdrawal.amount?.toString() || '0');
      
      if (withdrawal.status === 'approved') {
        if (!approvedWithdrawals.has(userId)) {
          approvedWithdrawals.set(userId, 0);
        }
        approvedWithdrawals.set(userId, approvedWithdrawals.get(userId)! + amount);
      } else if (withdrawal.status === 'paid') {
        if (!paidWithdrawals.has(userId)) {
          paidWithdrawals.set(userId, 0);
        }
        paidWithdrawals.set(userId, paidWithdrawals.get(userId)! + amount);
      }
    }
    
    // 6. Atualizar saldos e total de ganhos
    console.log('\nAtualizando saldos finais...\n');
    
    for (const user of allUsers) {
      const totalCommissions = userCommissions.get(user.id) || 0;
      const totalApproved = approvedWithdrawals.get(user.id) || 0;
      const totalPaid = paidWithdrawals.get(user.id) || 0;
      
      // Saldo disponível = comissões totais - saques aprovados - saques pagos
      const balance = totalCommissions - totalApproved - totalPaid;
      
      // Total de ganhos = apenas saques pagos
      const totalEarnings = totalPaid;
      
      if (totalCommissions > 0 || totalApproved > 0 || totalPaid > 0) {
        console.log(`${user.fullName}:`);
        console.log(`  Comissões totais: R$ ${totalCommissions.toFixed(2)}`);
        console.log(`  Saques aprovados: R$ ${totalApproved.toFixed(2)}`);
        console.log(`  Saques pagos: R$ ${totalPaid.toFixed(2)}`);
        console.log(`  SALDO DISPONÍVEL: R$ ${balance.toFixed(2)}`);
        console.log(`  TOTAL DE GANHOS (já pago): R$ ${totalEarnings.toFixed(2)}\n`);
        
        await db.update(users)
          .set({ 
            balance: balance.toString(),
            totalEarnings: totalEarnings.toString()
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