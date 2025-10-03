import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "wouter";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Target, DollarSign, Activity, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Format currency to Brazilian Real
const formatCurrency = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue);
};

interface CompanyMetrics {
  companyId: number;
  companyName: string;
  cashBalance: number;
  totalIndicators: number;
  totalPromoters: number;
  totalReferrals: number;
  convertedReferrals: number;
  conversionRate: number;
  averageReferralsPerIndicator: number;
  totalCommissionIndicators: number;
  totalCommissionPromoters: number;
  totalCommissions: number;
  activeIndicators: number;
  recentReferrals: number;
  pendingReferrals: number;
  analyzingReferrals: number;
  validatedReferrals: number;
  rejectedReferrals: number;
  totalPaidToIndicators: number;
  totalPaidToPromoters: number;
  totalPaidValues: number;
}

export default function PublicCompanyDashboard() {
  const { companyId } = useParams();
  const searchParams = new URLSearchParams(useSearch());
  const monthFilter = searchParams.get('month') || 'all_time';

  // Fetch company metrics
  const { data: metrics, isLoading, error } = useQuery<CompanyMetrics>({
    queryKey: [`/api/public/company-metrics/${companyId}`, monthFilter],
    enabled: !!companyId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (monthFilter !== "all_time") {
        params.append('month', monthFilter);
      }
      const url = `/api/public/company-metrics/${companyId}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
  });

  // Fetch current month metrics separately (always show current month data)
  const currentMonth = useMemo(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }, []);

  const { data: monthlyMetrics } = useQuery<CompanyMetrics>({
    queryKey: [`/api/public/company-metrics/${companyId}/monthly`, currentMonth],
    enabled: !!companyId,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('month', currentMonth);
      const url = `/api/public/company-metrics/${companyId}?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch monthly metrics');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard não encontrado</h3>
            <p className="text-gray-600 text-center max-w-md">
              O link compartilhado pode estar inválido ou expirado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Acompanhamento</h1>
        </div>
        <p className="text-gray-600">Métricas e performance empresarial em tempo real</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline">
            Modo Visualização Pública
          </Badge>
          {monthFilter !== "all_time" && (
            <Badge variant="secondary">
              {new Date(monthFilter + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              {metrics.companyName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant="secondary">{metrics.totalReferrals} Indicações</Badge>
              <Badge variant={metrics.conversionRate >= 15 ? "default" : "secondary"}>
                {metrics.conversionRate.toFixed(1)}% Conversão
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Cash Balance and Commissions Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Caixa e Pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-blue-700 mb-1">Caixa Disponível</p>
                <div className="text-3xl font-bold text-blue-600">
                  {formatCurrency(metrics.cashBalance)}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-blue-700 mb-1">Total Pago em Comissões</p>
                <div className="text-3xl font-bold text-purple-600">
                  {formatCurrency(metrics.totalCommissions)}
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-white rounded-lg border border-blue-100">
              <p className="text-sm text-gray-600">
                <strong>Saldo após comissões:</strong>{' '}
                <span className={metrics.cashBalance - metrics.totalCommissions >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {formatCurrency(metrics.cashBalance - metrics.totalCommissions)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Taxa de Conversão */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metrics.conversionRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.convertedReferrals} de {metrics.totalReferrals} indicações
              </p>
            </CardContent>
          </Card>

          {/* Média por Indicador */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média por Indicador</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.averageReferralsPerIndicator.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">
                indicações por pessoa
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Valores e Comissões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(metrics.totalCommissionIndicators)}
                </div>
                <p className="text-sm text-muted-foreground">Valor Gasto com Indicadores</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(metrics.totalCommissionPromoters)}
                </div>
                <p className="text-sm text-muted-foreground">Valor Gasto com Promotores</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(metrics.totalCommissions)}
                </div>
                <p className="text-sm text-muted-foreground">Total de Comissões</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Financial Metrics */}
        {monthlyMetrics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Valores e Comissões Mensais
                <Badge variant="outline" className="ml-2">
                  {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(monthlyMetrics.totalCommissionIndicators)}
                  </div>
                  <p className="text-sm text-muted-foreground">Valor Gasto com Indicadores</p>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(monthlyMetrics.totalCommissionPromoters)}
                  </div>
                  <p className="text-sm text-muted-foreground">Valor Gasto com Promotores</p>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(monthlyMetrics.totalCommissions)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total de Comissões</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Status das Indicações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {metrics.pendingReferrals}
                </div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.analyzingReferrals ?? 0}
                </div>
                <p className="text-sm text-muted-foreground">Em análise</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {metrics.validatedReferrals ?? 0}
                </div>
                <p className="text-sm text-muted-foreground">Validadas</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.convertedReferrals}
                </div>
                <p className="text-sm text-muted-foreground">Convertidas</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {metrics.rejectedReferrals}
                </div>
                <p className="text-sm text-muted-foreground">Rejeitadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.recentReferrals}</div>
                <p className="text-sm text-muted-foreground">
                  {monthFilter === "all_time" ? "Indicações nos últimos 30 dias" : 
                   `Indicações em ${new Date(monthFilter + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <p className="text-center text-sm text-gray-500">
          Dashboard gerado automaticamente • Dados atualizados em tempo real
        </p>
      </div>
    </div>
  );
}