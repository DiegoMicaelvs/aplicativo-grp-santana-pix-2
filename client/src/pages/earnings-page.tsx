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
    (r.status === 'paid' || r.status === 'validated') && r.commission
  ) || [];
  
  // Calculate total earnings
  const totalEarnings = paidReferrals.reduce((sum, r) => {
    const commission = r.commission ? (typeof r.commission === 'string' ? parseFloat(r.commission) : r.commission) : 0;
    return sum + commission;
  }, 0);
  
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
              <h1 className="text-3xl font-bold leading-tight text-gray-900 font-heading">Histórico de Ganhos</h1>
              <p className="mt-2 text-gray-600">
                Acompanhe todas as suas comissões de indicações.
              </p>
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
                        <div className="ml-5 w-0 flex-1">
                          <div className="text-sm font-medium text-gray-500 truncate">Total de Ganhos</div>
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
                        <div className="ml-5 w-0 flex-1">
                          <div className="text-sm font-medium text-gray-500 truncate">Indicações Pagas/Validadas</div>
                          <div className="text-lg font-medium text-gray-900">{paidReferrals.length}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Earnings Table */}
                <div className="mt-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Detalhamento de Ganhos</CardTitle>
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
                                      {referral.firstName.charAt(0)}{referral.lastName.charAt(0)}
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">{referral.firstName} {referral.lastName}</div>
                                      <div className="text-sm text-gray-500">{referral.email}</div>
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
                                    {formatCurrency(referral.commission)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm text-gray-900">
                                    {referral.paidAt ? formatDate(referral.paidAt) : 'Pendente'}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="p-6 text-center text-gray-500">
                          Você ainda não tem ganhos registrados. As indicações validadas e pagas aparecerão aqui.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Earnings Information */}
                <div className="mt-8">
                  <Card className="bg-blue-50">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-medium text-blue-900">Como são calculados os ganhos?</h3>
                      <div className="mt-4 text-sm text-blue-700">
                        <p>
                          Você recebe <strong>{formatCurrency(3)}</strong> para cada indicação validada.
                        </p>
                        <p className="mt-2">
                          <strong>Arredondamento especial:</strong> A cada 3 indicações validadas, o valor total de <strong>{formatCurrency(9)}</strong> é arredondado para <strong>{formatCurrency(10)}</strong>!
                        </p>
                        <p className="mt-2 text-xs text-blue-600">
                          * Promoção válida até agosto de 2025. Valor regular após esse período: {formatCurrency(1.5)} por indicação validada.
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