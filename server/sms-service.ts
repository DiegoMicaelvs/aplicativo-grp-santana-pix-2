// Configuração do cliente Comtele
const COMTELE_API_URL = 'https://sms.comtele.com.br/api/v2/send';
const COMTELE_AUTH_KEY = 'c2e18779-6859-4988-b4c5-aa3521658e3b';
const COMTELE_SENDER = 'KongPix'; // Sender ID customizado

// Verificar se as credenciais estão configuradas
const isComteleConfigured = (): boolean => {
  return !!(COMTELE_AUTH_KEY && COMTELE_API_URL);
};

// Função para validar e formatar número de telefone brasileiro
const formatBrazilianPhoneNumber = (phone: string): string => {
  // Remove todos os caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Verifica se é um número brasileiro válido
  if (cleanPhone.length === 11 && cleanPhone.startsWith('11')) {
    // Formato: 11999999999 -> +5511999999999
    return `+55${cleanPhone}`;
  } else if (cleanPhone.length === 10 && cleanPhone.startsWith('11')) {
    // Formato: 1199999999 -> +551199999999
    return `+55${cleanPhone}`;
  } else if (cleanPhone.length === 11) {
    // Outros DDDs: 21999999999 -> +5521999999999
    return `+55${cleanPhone}`;
  } else if (cleanPhone.length === 10) {
    // Outros DDDs: 2199999999 -> +552199999999
    return `+55${cleanPhone}`;
  }
  
  // Se já tem código do país, retorna como está
  if (cleanPhone.startsWith('55') && cleanPhone.length === 13) {
    return `+${cleanPhone}`;
  }
  
  return phone; // Retorna original se não conseguir formatar
};

// Função principal para enviar SMS via Comtele
export const sendSMS = async (to: string, message: string): Promise<boolean> => {
  if (!isComteleConfigured()) {
    console.log('[SMS] SMS não enviado - Comtele não configurado');
    return false;
  }

  try {
    const formattedNumber = formatBrazilianPhoneNumber(to);
    console.log(`[SMS] Enviando SMS para ${formattedNumber} via Comtele`);
    
    // Preparar dados para Comtele
    const payload = {
      Sender: COMTELE_SENDER,
      Receivers: formattedNumber.replace('+55', ''), // Comtele espera número sem +55
      Content: message
    };

    // Fazer requisição para API Comtele
    const response = await fetch(COMTELE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'auth-key': COMTELE_AUTH_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.Success) {
      console.log(`[SMS] SMS enviado com sucesso - RequestID: ${result.Object?.requestUniqueId}`);
      return true;
    } else {
      console.error('[SMS] Erro ao enviar SMS:', result.Message || 'Erro desconhecido');
      return false;
    }
  } catch (error: any) {
    console.error('[SMS] Erro ao enviar SMS:', error.message);
    return false;
  }
};

// Funções específicas para diferentes tipos de notificação
export const sendReferralNotification = async (
  userPhone: string, 
  userName: string, 
  referralId: number
): Promise<boolean> => {
  const message = `🎯 Kong Pix - Nova indicação recebida!\n\nOlá ${userName}, sua indicação #${referralId} foi registrada com sucesso e está em análise.\n\nAcompanhe o status pelo app!`;
  return sendSMS(userPhone, message);
};

export const sendStatusUpdateNotification = async (
  userPhone: string,
  userName: string,
  referralId: number,
  newStatus: string
): Promise<boolean> => {
  const statusMessages: { [key: string]: string } = {
    'approved': '✅ Aprovada! Comissão creditada.',
    'validated': '✅ Validada! Aguardando processamento.',
    'converted': '💰 Convertida! Bônus adicional creditado.',
    'rejected': '❌ Rejeitada. Verifique os dados.',
    'pending': '⏳ Em análise novamente.'
  };

  const statusText = statusMessages[newStatus] || `Status atualizado para: ${newStatus}`;
  const message = `📊 Kong Pix - Atualização de Status\n\nOlá ${userName}, sua indicação #${referralId}:\n${statusText}\n\nAcesse o app para mais detalhes!`;
  
  return sendSMS(userPhone, message);
};

export const sendWithdrawalNotification = async (
  userPhone: string,
  userName: string,
  amount: number,
  status: 'approved' | 'rejected'
): Promise<boolean> => {
  const statusText = status === 'approved' 
    ? `💰 APROVADO! R$ ${amount.toFixed(2)} será transferido em até 24h.`
    : `❌ REJEITADO. Entre em contato com o suporte.`;
    
  const message = `💳 Kong Pix - Saque ${status === 'approved' ? 'Aprovado' : 'Rejeitado'}\n\nOlá ${userName}, seu saque de R$ ${amount.toFixed(2)}:\n${statusText}\n\nDúvidas? Fale conosco!`;
  
  return sendSMS(userPhone, message);
};

export const sendAdminWithdrawalNotification = async (
  adminPhone: string,
  userName: string,
  userCPF: string,
  amount: number
): Promise<boolean> => {
  const message = `🚨 Kong Pix - NOVA SOLICITAÇÃO DE SAQUE!\n\nIndicador: ${userName}\nCPF: ${userCPF}\nValor: R$ ${amount.toFixed(2)}\n\nAcesse o painel para processar:\nkongprotecaoveicular.com.br/admin`;
  
  return sendSMS(adminPhone, message);
};

export const sendWelcomeSMS = async (
  userPhone: string,
  userName: string
): Promise<boolean> => {
  const message = `🎉 Bem-vindo à Kong Pix!\n\nOlá ${userName}, seu cadastro foi aprovado!\n\nComece a indicar e ganhe R$ 3,00 por indicação validada.\n\nAcesse: kongprotecaoveicular.com.br`;
  
  return sendSMS(userPhone, message);
};

export const sendDailyEarningSummary = async (
  userPhone: string,
  userName: string,
  dailyEarnings: number,
  totalReferrals: number
): Promise<boolean> => {
  if (dailyEarnings <= 0) return false;
  
  const message = `📈 Kong Pix - Resumo Diário\n\nOlá ${userName}!\nHoje você ganhou: R$ ${dailyEarnings.toFixed(2)}\nIndicações: ${totalReferrals}\n\nParabéns! Continue indicando!`;
  
  return sendSMS(userPhone, message);
};

// Função para testar se o SMS está funcionando
export const testSMS = async (testPhone: string): Promise<boolean> => {
  const testMessage = `📱 Kong Pix - Teste de SMS\n\nSeu sistema de SMS está funcionando perfeitamente!\n\nData: ${new Date().toLocaleString('pt-BR')}`;
  return sendSMS(testPhone, testMessage);
};

// Verificar se as credenciais estão configuradas
export const isSMSConfigured = (): boolean => {
  return isComteleConfigured();
};

// Obter status da configuração
export const getSMSStatus = () => {
  return {
    configured: isSMSConfigured(),
    provider: 'Comtele',
    authKey: COMTELE_AUTH_KEY ? `${COMTELE_AUTH_KEY.substring(0, 8)}...` : 'não configurado',
    sender: COMTELE_SENDER || 'não configurado',
    apiUrl: COMTELE_API_URL,
    help: 'Sistema configurado para usar Comtele como provedor de SMS'
  };
};