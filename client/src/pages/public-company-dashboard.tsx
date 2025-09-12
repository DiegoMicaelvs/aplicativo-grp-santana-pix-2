import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Target, DollarSign, Activity } from "lucide-react";
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
  rejectedReferrals: number;
  totalPaidToIndicators: number;
  totalPaidToPromoters: number;
  totalPaidValues: number;
}

export default function PublicCompanyDashboard() {
  const { companyId } = useParams();

  // Fetch company metrics
  const { data: metrics, isLoading, error } = useQuery<CompanyMetrics>({
    queryKey: [`/api/public/company-metrics/${companyId}`],
    enabled: !!companyId,
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
        <Badge variant="outline" className="mt-2">
          Modo Visualização Pública
        </Badge>
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
              <Badge variant="outline">{metrics.activeIndicators} Indicadores Ativos</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

          {/* Número de Indicadores */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Indicadores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalIndicators}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.activeIndicators} ativos
              </p>
            </CardContent>
          </Card>

          {/* Número de Promotores */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Promotores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalPromoters}</div>
              <p className="text-xs text-muted-foreground">
                na empresa
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

        {/* Values Released */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              Valores Liberados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(metrics.totalPaidToIndicators)}
                </div>
                <p className="text-sm text-muted-foreground">Liberado para Indicadores</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">
                  {formatCurrency(metrics.totalPaidToPromoters)}
                </div>
                <p className="text-sm text-muted-foreground">Liberado para Promotores</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-700">
                  {formatCurrency(metrics.totalPaidValues)}
                </div>
                <p className="text-sm text-muted-foreground">Total Liberado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Status das Indicações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {metrics.pendingReferrals}
                </div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
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
                <p className="text-sm text-muted-foreground">Indicações nos últimos 30 dias</p>
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