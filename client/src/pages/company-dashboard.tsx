import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Share2, BarChart3, TrendingUp, Users, Target, DollarSign, Activity, Link2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
// Format currency to Brazilian Real
const formatCurrency = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue);
};
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

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
  recentReferrals: number; // Last 30 days
  pendingReferrals: number;
  rejectedReferrals: number;
  totalPaidToIndicators: number;
  totalPaidToPromoters: number;
  totalPaidValues: number;
}

interface Company {
  id: number;
  name: string;
  isActive: boolean;
}

export default function CompanyDashboard() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all_companies");
  const { toast } = useToast();

  // Fetch all companies
  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
  });

  // Fetch company metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<CompanyMetrics>({
    queryKey: [`/api/admin/company-metrics/${selectedCompanyId}`],
    enabled: selectedCompanyId !== "all_companies",
  });

  const handleShareDashboard = async () => {
    try {
      const shareData = {
        title: `Dashboard de Acompanhamento - ${metrics?.companyName || 'Empresa'}`,
        text: `Confira as métricas da empresa: Taxa de conversão: ${metrics?.conversionRate.toFixed(1)}%, Total de indicações: ${metrics?.totalReferrals}`,
        url: window.location.href,
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link copiado!",
          description: "O link do dashboard foi copiado para a área de transferência.",
        });
      }
    } catch (error) {
      console.error("Erro ao compartilhar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível compartilhar o dashboard.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateShareableLink = () => {
    if (selectedCompanyId === "all_companies") return;
    
    const shareableUrl = `${window.location.origin}/public-dashboard/${selectedCompanyId}`;
    
    navigator.clipboard.writeText(shareableUrl).then(() => {
      toast({
        title: "Link copiado!",
        description: "O link compartilhável foi copiado para a área de transferência. Agora você pode enviar para gestores acompanharem as métricas sem precisar fazer login.",
      });
    }).catch(() => {
      // Fallback: show the link in a prompt
      prompt("Copie este link para compartilhar:", shareableUrl);
    });
  };

  const handleExportReport = () => {
    if (!metrics) return;

    // Create CSV data
    const csvData = [
      ["Métrica", "Valor"],
      ["Empresa", metrics.companyName],
      ["Total de Indicadores", metrics.totalIndicators.toString()],
      ["Total de Promotores", metrics.totalPromoters.toString()],
      ["Total de Indicações", metrics.totalReferrals.toString()],
      ["Indicações Convertidas", metrics.convertedReferrals.toString()],
      ["Taxa de Conversão (%)", metrics.conversionRate.toFixed(2)],
      ["Média por Indicador", metrics.averageReferralsPerIndicator.toFixed(2)],
      ["Comissões Indicadores", formatCurrency(metrics.totalCommissionIndicators)],
      ["Comissões Promotores", formatCurrency(metrics.totalCommissionPromoters)],
      ["Total de Comissões", formatCurrency(metrics.totalCommissions)],
      ["Valores Liberados - Indicadores", formatCurrency(metrics.totalPaidToIndicators)],
      ["Valores Liberados - Promotores", formatCurrency(metrics.totalPaidToPromoters)],
      ["Total Valores Liberados", formatCurrency(metrics.totalPaidValues)],
      ["Indicadores Ativos", metrics.activeIndicators.toString()],
      ["Indicações Recentes (30 dias)", metrics.recentReferrals.toString()],
      ["Indicações Pendentes", metrics.pendingReferrals.toString()],
      ["Indicações Rejeitadas", metrics.rejectedReferrals.toString()],
    ];

    const csvContent = csvData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `dashboard_${metrics.companyName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Relatório exportado!",
      description: "O arquivo CSV foi baixado com sucesso.",
    });
  };

  if (companiesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Acompanhamento</h1>
            <p className="text-gray-600 mt-2">Carregando empresas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <BackButton />
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Acompanhamento</h1>
            <p className="text-gray-600 mt-2">Acompanhe as métricas de performance por empresa</p>
          </div>
          {metrics && (
            <div className="flex gap-2">
              <Button onClick={handleShareDashboard} variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
              <Button onClick={handleExportReport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Company Selection */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <BarChart3 className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Selecione a empresa para acompanhamento:
              </label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder="Escolha uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_companies">Todas as Empresas</SelectItem>
                  {companies?.map((company: Company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name} {!company.isActive && "(Inativa)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCompanyId !== "all_companies" && (
              <Button
                onClick={handleGenerateShareableLink}
                variant="outline"
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <Link2 className="h-4 w-4" />
                Compartilhar Link
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {selectedCompanyId === "all_companies" ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecione uma empresa</h3>
            <p className="text-gray-600 text-center max-w-md">
              Escolha uma empresa específica para visualizar suas métricas de performance e acompanhamento detalhado.
            </p>
          </CardContent>
        </Card>
      ) : metricsLoading ? (
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
      ) : metrics ? (
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
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sem dados disponíveis</h3>
            <p className="text-gray-600 text-center max-w-md">
              Não foram encontrados dados para a empresa selecionada.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}