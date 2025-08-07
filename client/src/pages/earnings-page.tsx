import { useQuery } from "@tanstack/react-query";
import { Calendar, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { BackButton } from "@/components/ui/back-button";
import { useAuth } from "@/hooks/use-auth";
import { Referral, ReferralStatus } from "@shared/schema";

export default function EarningsPage() {
  const { user } = useAuth();
  
  // Fetch referrals for the current user
  const { data: referrals, isLoading: isLoadingReferrals } = useQuery<Referral[]>({
    queryKey: ['/api/referrals'],
  });

  // Filter only paid or validated referrals with commission
  const paidReferrals = referrals?.filter(r => 
    (r.status === 'paid' || r.status === 'validated' || r.status === 'converted') && r.commissionIndicator
  ) || [];
  
  // Total earnings now comes from user.totalEarnings (value already paid through withdrawals)
  const totalEarnings = user?.totalEarnings ? 
    (typeof user.totalEarnings === 'string' ? parseFloat(user.totalEarnings) : user.totalEarnings) : 0;
  
  // Format date to Brazilian format
  const formatDate = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleDateString('pt-BR');
  };
  
  // Format currency to Brazilian Real
  const formatCurrency = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '-';
    let numValue: number;
    
    try {
      numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return '-';
    } catch (e) {
      return '-';
    }
    
    return numValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Helper function to get appropriate badge color based on status
  const getStatusBadge = (status: ReferralStatus) => {
    switch (status) {
      case 'validated':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Validado</Badge>;
      case 'converted':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Convertido</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800">Pago</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="bg-gray-100 flex-grow">
        <div className="py-10">
          <header>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold leading-tight text-gray-900 font-heading">Histórico de Ganhos</h1>
                  <p className="mt-2 text-gray-600">
                    Acompanhe todas as suas comissões de indicações.
                  </p>
                </div>
                <BackButton to="/dashboard" />
              </div>
            </div>
          </header>
          
          <main>
            <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
              <div className="px-4 py-8 sm:px-0">
                {/* Total Earnings Summary */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-accent rounded-md p-3">
                          <DollarSign className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 flex-1">
                          <div className="text-sm font-medium text-gray-500">Total de Ganhos (Já Recebido)</div>
                          <div className="text-lg font-medium text-gray-900">{formatCurrency(totalEarnings)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                          <Calendar className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 flex-1">
                          <div className="text-sm font-medium text-gray-500">Saldo Disponível para Saque</div>
                          <div className="text-lg font-medium text-gray-900">{formatCurrency(user?.balance)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Earnings Table */}
                <div className="mt-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Indicações com Comissões</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingReferrals ? (
                        <div className="p-6 text-center">Carregando histórico de ganhos...</div>
                      ) : paidReferrals.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Indicado</TableHead>
                              <TableHead>Data</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Comissão</TableHead>
                              <TableHead>Data de Pagamento</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paidReferrals.map((referral) => (
                              <TableRow key={referral.id}>
                                <TableCell>
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold">
                                      {referral.fullName ? referral.fullName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">{referral.fullName || 'Nome não informado'}</div>
                                      <div className="text-sm text-gray-500">{referral.phone || 'Telefone não informado'}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm text-gray-900">{formatDate(referral.createdAt)}</div>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(referral.status)}
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatCurrency(referral.commissionIndicator)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm text-gray-900">
                                    {referral.status === 'paid' ? 'Pago' : 'Pendente'}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="p-6 text-center text-gray-500">
                          Você ainda não tem indicações com comissões. As indicações validadas, convertidas e pagas aparecerão aqui.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Earnings Information */}
                <div className="mt-8 space-y-4">
                  <Card className="bg-blue-50">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-medium text-blue-900">Entenda seus ganhos</h3>
                      <div className="mt-4 text-sm text-blue-700 space-y-3">
                        <div>
                          <strong>Saldo Disponível para Saque:</strong> Valor das comissões de indicações validadas/convertidas que você ainda não sacou.
                        </div>
                        <div>
                          <strong>Total de Ganhos (Já Recebido):</strong> Valor total que já foi pago para você através de saques aprovados.
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-green-50">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-medium text-green-900">Como são calculadas as comissões?</h3>
                      <div className="mt-4 text-sm text-green-700">
                        <p>
                          • <strong>Indicação Validada:</strong> {formatCurrency(3)} de comissão
                        </p>
                        <p className="mt-2">
                          • <strong>Indicação Convertida:</strong> {formatCurrency(50)} de comissão adicional
                        </p>
                        <p className="mt-3 text-xs text-green-600">
                          * Valores promocionais válidos até agosto de 2025.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}