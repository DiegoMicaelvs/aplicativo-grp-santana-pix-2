import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Share2, BarChart3, TrendingUp, Users, Target, DollarSign, Activity, Link2, Calendar } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
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

// Generate month options for the last 24 months
const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  
  // Add "All time" option
  options.push({ value: "all_time", label: "Todos os períodos" });
  
  // Add current month first
  const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const currentMonthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  options.push({ value: currentMonth, label: currentMonthLabel });
  
  // Add previous 23 months
  for (let i = 1; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  
  return options;
};

// Chart colors using the new green military palette
const CHART_COLORS = {
  primary: '#4B5320', // Verde Militar
  secondary: '#808080', // Cinza
  success: '#6B7240', // Verde militar mais claro
  warning: '#B8860B', // Dourado escuro
  error: '#8B4513', // Marrom avermelhado
  info: '#5F6A6B', // Cinza azulado
  light: '#A8B19C', // Verde militar claro
};

// Prepare chart data
const prepareReferralStatusData = (metrics: CompanyMetrics) => [
  { name: 'Pendentes', value: metrics.pendingReferrals, color: CHART_COLORS.warning },
  { name: 'Convertidas', value: metrics.convertedReferrals, color: CHART_COLORS.success },
  { name: 'Rejeitadas', value: metrics.rejectedReferrals, color: CHART_COLORS.error }
];

const prepareCommissionData = (metrics: CompanyMetrics) => [
  { 
    category: 'Indicadores', 
    valor: metrics.totalCommissionIndicators,
    liberado: metrics.totalPaidToIndicators,
  },
  { 
    category: 'Promotores', 
    valor: metrics.totalCommissionPromoters,
    liberado: metrics.totalPaidToPromoters,
  }
];

const preparePerformanceData = (metrics: CompanyMetrics) => [
  {
    metric: 'Taxa de Conversão',
    percentual: metrics.conversionRate,
    total: metrics.totalReferrals
  },
  {
    metric: 'Média por Indicador', 
    percentual: metrics.averageReferralsPerIndicator,
    total: metrics.totalIndicators
  }
];

const prepareFinancialOverviewData = (metrics: CompanyMetrics) => [
  {
    categoria: 'Comissões',
    indicadores: metrics.totalCommissionIndicators,
    promotores: metrics.totalCommissionPromoters,
    total: metrics.totalCommissions
  },
  {
    categoria: 'Liberado',
    indicadores: metrics.totalPaidToIndicators,
    promotores: metrics.totalPaidToPromoters, 
    total: metrics.totalPaidValues
  }
];

// Custom tooltip formatter
const formatTooltipValue = (value: number, name: string) => {
  if (name.toLowerCase().includes('valor') || name.toLowerCase().includes('total') || 
      name.toLowerCase().includes('comissão') || name.toLowerCase().includes('liberado')) {
    return [formatCurrency(value), name];
  }
  return [value.toLocaleString('pt-BR'), name];
};

export default function CompanyDashboard() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all_companies");
  const [selectedMonth, setSelectedMonth] = useState<string>("all_time");
  const { toast } = useToast();
  
  const monthOptions = generateMonthOptions();

  // Fetch all companies
  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
  });

  // Fetch company metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<CompanyMetrics>({
    queryKey: [`/api/admin/company-metrics/${selectedCompanyId}`, selectedMonth],
    enabled: selectedCompanyId !== "all_companies",
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedMonth !== "all_time") {
        params.append('month', selectedMonth);
      }
      const url = `/api/admin/company-metrics/${selectedCompanyId}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
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
    
    const params = new URLSearchParams();
    if (selectedMonth !== "all_time") {
      params.append('month', selectedMonth);
    }
    
    const shareableUrl = `${window.location.origin}/public-dashboard/${selectedCompanyId}${params.toString() ? '?' + params.toString() : ''}`;
    
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
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleGenerateShareableLink}
                  variant="outline"
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <Link2 className="h-4 w-4" />
                  Compartilhar Link
                </Button>
              </div>
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

          {/* Visual Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Referral Status Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Status das Indicações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prepareReferralStatusData(metrics)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prepareReferralStatusData(metrics).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value.toLocaleString('pt-BR'), 'Quantidade']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Commission vs Released Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Comissões vs Valores Liberados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={prepareCommissionData(metrics)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`} />
                    <Tooltip formatter={formatTooltipValue} />
                    <Legend />
                    <Bar dataKey="valor" fill={CHART_COLORS.primary} name="Total Comissões" />
                    <Bar dataKey="liberado" fill={CHART_COLORS.success} name="Valores Liberados" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance and Financial Overview Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Métricas de Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={preparePerformanceData(metrics)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'percentual' ? `${Number(value).toFixed(1)}%` : value.toLocaleString('pt-BR'),
                        name === 'percentual' ? 'Percentual' : 'Total'
                      ]} 
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="percentual" 
                      stroke={CHART_COLORS.primary} 
                      strokeWidth={3}
                      name="Percentual"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Financial Overview Area Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Visão Geral Financeira
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={prepareFinancialOverviewData(metrics)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="categoria" />
                    <YAxis tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`} />
                    <Tooltip formatter={formatTooltipValue} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stackId="1" 
                      stroke={CHART_COLORS.primary} 
                      fill={CHART_COLORS.light}
                      name="Total"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="indicadores" 
                      stackId="2" 
                      stroke={CHART_COLORS.success} 
                      fill={CHART_COLORS.success}
                      name="Indicadores"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="promotores" 
                      stackId="3" 
                      stroke={CHART_COLORS.secondary} 
                      fill={CHART_COLORS.secondary}
                      name="Promotores"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo do Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: CHART_COLORS.warning }}>
                    {metrics.pendingReferrals}
                  </div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: CHART_COLORS.success }}>
                    {metrics.convertedReferrals}
                  </div>
                  <p className="text-sm text-muted-foreground">Convertidas</p>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: CHART_COLORS.error }}>
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
                    {selectedMonth === "all_time" ? "Indicações nos últimos 30 dias" : 
                     `Indicações em ${monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth}`}
                  </p>
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