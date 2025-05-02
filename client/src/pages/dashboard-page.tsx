import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Clock, DollarSign, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Fetch referrals for the current user
  const { data: referrals, isLoading: isLoadingReferrals } = useQuery<Referral[]>({
    queryKey: ['/api/referrals'],
  });

  // Calculate statistics
  const totalReferrals = referrals?.length || 0;
  const convertedReferrals = referrals?.filter(r => r.status === 'converted').length || 0;
  const totalEarnings = referrals?.reduce((sum, r) => {
    const commission = r.commission ? (typeof r.commission === 'string' ? parseFloat(r.commission) : r.commission) : 0;
    return sum + commission;
  }, 0) || 0;
  
  // Get recent referrals (up to 5)
  const recentReferrals = referrals?.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  // Helper function to get appropriate badge color based on status
  const getStatusBadge = (status: ReferralStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case 'converted':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Convertido</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Em análise</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Não convertido</Badge>;
      case 'validated':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Validado</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800">Pago</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="bg-gray-100 flex-grow">
        <div className="py-10">
          <header>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold leading-tight text-gray-900 font-heading">Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Bem-vindo, {user?.firstName}! Veja o resumo da sua atividade como indicador.
              </p>
            </div>
          </header>
          
          <main>
            <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
              <div className="px-4 py-8 sm:px-0">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Total Referrals Card */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-primary rounded-md p-3">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <div className="text-sm font-medium text-gray-500 truncate">Total de Indicações</div>
                          <div className="text-lg font-medium text-gray-900">{totalReferrals}</div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <Link href="/referrals">
                          <Button variant="link" className="text-primary p-0">Ver todas</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Converted Referrals Card */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                          <Clock className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <div className="text-sm font-medium text-gray-500 truncate">Indicações Convertidas</div>
                          <div className="text-lg font-medium text-gray-900">{convertedReferrals}</div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <Link href="/referrals?status=converted">
                          <Button variant="link" className="text-primary p-0">Ver detalhes</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Earnings Card */}
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
                      <div className="mt-6">
                        <Link href="/earnings">
                          <Button variant="link" className="text-primary p-0">Ver histórico</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Referrals Table */}
                <div className="mt-8">
                  <h2 className="text-lg font-medium text-gray-900 font-heading">Indicações Recentes</h2>
                  <div className="mt-4 bg-white shadow overflow-hidden rounded-lg">
                    {isLoadingReferrals ? (
                      <div className="p-6 text-center">Carregando indicações...</div>
                    ) : recentReferrals && recentReferrals.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Indicado</TableHead>
                            <TableHead>Veículo</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Comissão</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentReferrals.map((referral) => (
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
                                <div className="text-sm text-gray-900">Placa: {referral.licensePlate}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-gray-900">{formatDate(referral.createdAt)}</div>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(referral.status)}
                              </TableCell>
                              <TableCell>
                                {referral.commission 
                                  ? formatCurrency(referral.commission) 
                                  : referral.status === 'rejected' 
                                    ? '-' 
                                    : 'Pendente'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-6 text-center text-gray-500">
                        Você ainda não tem indicações. Que tal começar a indicar agora?
                      </div>
                    )}
                  </div>
                </div>

                {/* New Referral Card */}
                <div className="mt-8 bg-white shadow rounded-lg">
                  <div className="px-6 py-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 font-heading">
                      Nova Indicação
                    </h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500">
                      <p>
                        Indique alguém que precise de seguro para seu veículo e ganhe comissão.
                      </p>
                    </div>
                    <div className="mt-5">
                      <Link href="/new-referral">
                        <Button>Fazer Nova Indicação</Button>
                      </Link>
                    </div>
                  </div>
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
