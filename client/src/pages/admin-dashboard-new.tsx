import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Activity, 
  FileText, 
  CreditCard, 
  BarChart3, 
  Shield, 
  Settings,
  Eye,
  UserCheck,
  ClipboardList,
  Wallet,
  HelpCircle,
  Building2
} from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"]
  });

  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ["/api/admin/referrals"]
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["/api/admin/withdrawals"]
  });

  // Calculate key metrics
  const stats = {
    totalUsers: users.length,
    totalIndicators: users.filter(u => u.role === "indicador").length,
    totalPromoters: users.filter(u => u.role === "promotor").length,
    totalReferrals: referrals.length,
    pendingReferrals: referrals.filter(r => r.status === "pending").length,
    validatedReferrals: referrals.filter(r => r.status === "validated").length,
    totalCommissions: referrals.reduce((sum, r) => 
      sum + (parseFloat(r.commissionIndicator) || 0) + (parseFloat(r.commissionPromoter) || 0), 0),
    pendingWithdrawals: withdrawals.filter(w => w.status === "pending").length,
    totalPendingAmount: withdrawals.filter(w => w.status === "pending")
      .reduce((sum, w) => sum + parseFloat(w.amount), 0)
  };

  if (usersLoading || referralsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando painel administrativo...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
        <p className="text-gray-600 mt-2">Controle completo do sistema Indique e Ganhe</p>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalIndicators} indicadores, {stats.totalPromoters} promotores
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicações</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingReferrals} pendentes, {stats.validatedReferrals} validadas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ {stats.totalCommissions.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">comissões geradas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saques Pendentes</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingWithdrawals}</div>
            <p className="text-xs text-muted-foreground">R$ {stats.totalPendingAmount.toFixed(2)} a processar</p>
          </CardContent>
        </Card>
      </div>

      {/* 10 Control Tabs - Mobile Optimized with Touch Support */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="w-full">
          <div className="overflow-x-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 pb-2">
            <TabsList className="inline-flex w-max h-auto p-1 bg-muted rounded-md gap-1">
              <TabsTrigger 
                value="overview" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Visão Geral
              </TabsTrigger>
              <TabsTrigger 
                value="indicators" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Indicadores
              </TabsTrigger>
              <TabsTrigger 
                value="referrals" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Indicações
              </TabsTrigger>
              <TabsTrigger 
                value="payments" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Pagamentos
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Análises
              </TabsTrigger>
              <TabsTrigger 
                value="withdrawals" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Saques
              </TabsTrigger>
              <TabsTrigger 
                value="audit" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Auditoria
              </TabsTrigger>
              <TabsTrigger 
                value="team" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Equipes
              </TabsTrigger>
              <TabsTrigger 
                value="profiles" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Perfis
              </TabsTrigger>
              <TabsTrigger 
                value="support" 
                className="whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all hover:bg-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Suporte
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/admin/indicators">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Gestão de Indicadores
                  </CardTitle>
                  <CardDescription>
                    Visualize e gerencie todos os indicadores cadastrados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.totalIndicators}</div>
                  <p className="text-sm text-gray-600">indicadores ativos</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/admin/referrals-detailed">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-green-600" />
                    Indicações Detalhadas
                  </CardTitle>
                  <CardDescription>
                    Análise completa de todas as indicações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.totalReferrals}</div>
                  <p className="text-sm text-gray-600">indicações registradas</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/admin/payments">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    Controle de Pagamentos
                  </CardTitle>
                  <CardDescription>
                    Gerencie pagamentos e fluxo de caixa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">R$ {stats.totalCommissions.toFixed(2)}</div>
                  <p className="text-sm text-gray-600">em comissões</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/admin/analytics">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-600" />
                    Análise de Indicadores
                  </CardTitle>
                  <CardDescription>
                    Análise detalhada dos cadastros e performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.totalReferrals > 0 ? 
                      ((stats.validatedReferrals / stats.totalReferrals) * 100).toFixed(1) + "%" : "0%"
                    }
                  </div>
                  <p className="text-sm text-gray-600">taxa de conversão</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/admin/withdrawals">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-red-600" />
                    Gestão de Saques
                  </CardTitle>
                  <CardDescription>
                    Processar solicitações de saque
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.pendingWithdrawals}</div>
                  <p className="text-sm text-gray-600">saques pendentes</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/admin/audit-log">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-indigo-600" />
                    Log de Auditoria
                  </CardTitle>
                  <CardDescription>
                    Rastro completo de todas as ações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600">
                    <Shield className="h-8 w-8" />
                  </div>
                  <p className="text-sm text-gray-600">auditoria ativa</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/team-dashboard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-teal-600" />
                    Dashboard de Equipes
                  </CardTitle>
                  <CardDescription>
                    Visão das equipes de promotores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-teal-600">{stats.totalPromoters}</div>
                  <p className="text-sm text-gray-600">promotores ativos</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/admin/companies">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-cyan-600" />
                    Gestão de Empresas
                  </CardTitle>
                  <CardDescription>
                    Configure empresas do programa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-cyan-600">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <p className="text-sm text-gray-600">empresas ativas</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/admin/support-tickets">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-pink-600" />
                    Tickets de Suporte
                  </CardTitle>
                  <CardDescription>
                    Gerencie solicitações de suporte dos usuários
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-pink-600">
                    <HelpCircle className="h-8 w-8" />
                  </div>
                  <p className="text-sm text-gray-600">sistema de suporte</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <Link href="/admin/profiles">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-pink-600" />
                    Gestão de Perfis
                  </CardTitle>
                  <CardDescription>
                    Gerencie perfis e permissões
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-pink-600">{users.filter(u => u.role === "admin").length}</div>
                  <p className="text-sm text-gray-600">administradores</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-600" />
                  Configurações
                </CardTitle>
                <CardDescription>
                  Configurações do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">
                  <Settings className="h-8 w-8" />
                </div>
                <p className="text-sm text-gray-600">configurações avançadas</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Quick Indicators View */}
        <TabsContent value="indicators">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Indicadores</CardTitle>
              <CardDescription>
                Acesso rápido à gestão completa de indicadores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/admin/indicators" className="flex-1">
                  <Button size="sm" className="w-full text-xs sm:text-sm">
                    <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Ver Indicadores
                  </Button>
                </Link>
                <Link href="/admin/analytics" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
                    <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Performance
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 sm:p-4 border rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalIndicators}</div>
                  <div className="text-xs sm:text-sm text-gray-600">Total de Indicadores</div>
                </div>
                <div className="text-center p-3 sm:p-4 border rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-green-600">{users.filter(u => u.role === "indicador" && u.status === "active").length}</div>
                  <div className="text-xs sm:text-sm text-gray-600">Indicadores Ativos</div>
                </div>
                <div className="text-center p-3 sm:p-4 border rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-orange-600">
                    {stats.totalIndicators > 0 ? (stats.totalReferrals / stats.totalIndicators).toFixed(1) : 0}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Média por Indicador</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Additional tabs would be implemented similarly */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Indicações</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin/referrals-detailed">
                <Button size="sm" className="w-full text-xs sm:text-sm">
                  <ClipboardList className="h-4 w-4 mr-1 sm:mr-2" />
                  Ver Indicações
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin/payments">
                <Button size="sm" className="w-full text-xs sm:text-sm">
                  <CreditCard className="h-4 w-4 mr-1 sm:mr-2" />
                  Controle de Pagamentos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Indicadores</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin/analytics">
                <Button size="sm" className="w-full text-xs sm:text-sm">
                  <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
                  Ver Análises
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Saques</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin/withdrawals">
                <Button size="sm" className="w-full text-xs sm:text-sm">
                  <Wallet className="h-4 w-4 mr-1 sm:mr-2" />
                  Gerenciar Saques
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Log de Auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin/audit-log">
                <Button size="sm" className="w-full text-xs sm:text-sm">
                  <Shield className="h-4 w-4 mr-1 sm:mr-2" />
                  Log de Auditoria
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard de Equipes</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/team-dashboard">
                <Button size="sm" className="w-full text-xs sm:text-sm">
                  <Activity className="h-4 w-4 mr-1 sm:mr-2" />
                  Dashboard Equipes
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Perfis</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin/profiles">
                <Button size="sm" className="w-full text-xs sm:text-sm">
                  <UserCheck className="h-4 w-4 mr-1 sm:mr-2" />
                  Gerenciar Perfis
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support">
          <Card>
            <CardHeader>
              <CardTitle>Tickets de Suporte</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin/support-tickets">
                <Button size="sm" className="w-full text-xs sm:text-sm">
                  <HelpCircle className="h-4 w-4 mr-1 sm:mr-2" />
                  Tickets Suporte
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}