import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Users, TrendingUp, DollarSign, Activity, Target, Award, Calendar, BarChart3 } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BackButton } from "@/components/ui/back-button";

export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<string>("30_days");
  const [analysisType, setAnalysisType] = useState<string>("registrations");

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"]
  });

  const { data: referrals = [], isLoading: referralsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/referrals"]
  });

  const { data: auditLog = [], isLoading: auditLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/audit-log"]
  });

  // Filter data based on time range
  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case "7_days": return subDays(now, 7);
      case "30_days": return subDays(now, 30);
      case "90_days": return subDays(now, 90);
      case "this_month": return startOfMonth(now);
      default: return subDays(now, 30);
    }
  };

  const fromDate = getDateRange();
  const filteredUsers = users.filter((user: any) => new Date(user.createdAt) >= fromDate);
  const filteredReferrals = referrals.filter((referral: any) => new Date(referral.createdAt) >= fromDate);

  // Registration Analysis
  const registrationStats = {
    totalIndicators: filteredUsers.filter((u: any) => u.role === "indicador" || u.role === "indicador_nivel_1").length,
    totalPromoters: filteredUsers.filter((u: any) => u.role === "promotor").length,
    totalAnalysts: filteredUsers.filter((u: any) => u.role === "analista").length,
    activeUsers: filteredUsers.filter((u: any) => u.status === "active").length,
    selfRegistrations: filteredUsers.filter((u: any) => !u.createdBy).length,
    adminCreated: filteredUsers.filter((u: any) => u.createdBy).length
  };

  // Performance Analysis
  const performanceStats = {
    totalReferrals: filteredReferrals.length,
    validatedReferrals: filteredReferrals.filter((r: any) => r.status === "validated").length,
    conversionRate: filteredReferrals.length > 0 ? 
      (filteredReferrals.filter((r: any) => r.status === "validated").length / filteredReferrals.length * 100) : 0,
    totalCommissions: filteredReferrals
      .filter((r: any) => ['validated', 'converted', 'paid'].includes(r.status))
      .reduce((sum: number, r: any) => sum + (parseFloat(r.commissionIndicator) || 0) + (parseFloat(r.commissionPromoter) || 0), 0),
    avgReferralsPerIndicator: registrationStats.totalIndicators > 0 ? 
      filteredReferrals.length / registrationStats.totalIndicators : 0
  };

  // Registration timeline data
  const getRegistrationTimeline = () => {
    const timeline: { [key: string]: number } = {};
    const days = timeRange === "7_days" ? 7 : timeRange === "30_days" ? 30 : 90;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateKey = format(date, "dd/MM");
      timeline[dateKey] = 0;
    }

    filteredUsers.filter((u: any) => u.role === "indicador" || u.role === "indicador_nivel_1").forEach((user: any) => {
      const dateKey = format(new Date(user.createdAt), "dd/MM");
      if (timeline[dateKey] !== undefined) {
        timeline[dateKey]++;
      }
    });

    return Object.entries(timeline).map(([date, count]) => ({ date, count }));
  };

  // Top performers
  const getTopPerformers = () => {
    const indicatorPerformance = users
      .filter((u: any) => u.role === "indicador" || u.role === "indicador_nivel_1")
      .map((user: any) => {
        const userReferrals = filteredReferrals.filter((r: any) => r.userId === user.id);
        const validatedReferrals = userReferrals.filter((r: any) => r.status === "validated");
        const convertedReferrals = userReferrals.filter((r: any) => r.status === "converted");
        
        // Calculate total earnings from both validated and converted referrals
        const validatedEarnings = validatedReferrals.reduce((sum: number, r: any) => sum + (parseFloat(r.commissionIndicator) || 0), 0);
        const convertedEarnings = convertedReferrals.reduce((sum: number, r: any) => sum + (parseFloat(r.commissionIndicator) || 0), 0);
        const totalEarnings = validatedEarnings + convertedEarnings;
        
        return {
          id: user.id,
          name: user.fullName,
          totalReferrals: userReferrals.length,
          validatedReferrals: validatedReferrals.length,
          convertedReferrals: convertedReferrals.length,
          totalEarnings,
          conversionRate: userReferrals.length > 0 ? (validatedReferrals.length / userReferrals.length * 100) : 0
        };
      })
      .sort((a: any, b: any) => b.totalEarnings - a.totalEarnings)
      .slice(0, 10);

    return indicatorPerformance;
  };

  // Registration source analysis
  const getRegistrationSources = () => {
    const sources = {
      "Auto-cadastro": filteredUsers.filter((u: any) => (u.role === "indicador" || u.role === "indicador_nivel_1") && !u.createdBy).length,
      "Criado por Admin": filteredUsers.filter((u: any) => (u.role === "indicador" || u.role === "indicador_nivel_1") && u.createdBy).length
    };

    return Object.entries(sources).map(([name, value]) => ({ name, value }));
  };

  // Role distribution
  const getRoleDistribution = () => {
    const roles = {
      "Indicadores": filteredUsers.filter((u: any) => u.role === "indicador" || u.role === "indicador_nivel_1").length,
      "Promotores": filteredUsers.filter((u: any) => u.role === "promotor").length,
      "Analistas": filteredUsers.filter((u: any) => u.role === "analista").length,
      "Administradores": filteredUsers.filter((u: any) => u.role === "admin").length
    };

    const colors = ["#2B579A", "#3EAE7E", "#F3861D", "#1D3A5A"];
    return Object.entries(roles).map(([name, value], index) => ({ 
      name, 
      value, 
      color: colors[index] 
    }));
  };

  if (usersLoading || referralsLoading || auditLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando dados analíticos...</p>
          </div>
        </div>
      </div>
    );
  }

  const topPerformers = getTopPerformers();
  const registrationTimeline = getRegistrationTimeline();
  const registrationSources = getRegistrationSources();
  const roleDistribution = getRoleDistribution();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Análise de Indicadores</h1>
            <p className="text-gray-600 mt-2">Análise detalhada dos cadastros e performance dos indicadores</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7_days">Últimos 7 dias</SelectItem>
                <SelectItem value="30_days">Últimos 30 dias</SelectItem>
                <SelectItem value="90_days">Últimos 90 dias</SelectItem>
                <SelectItem value="this_month">Este mês</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={analysisType} onValueChange={setAnalysisType}>
              <SelectTrigger className="w-full md:w-60">
                <SelectValue placeholder="Tipo de Análise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="registrations">Análise de Cadastros</SelectItem>
                <SelectItem value="performance">Análise de Performance</SelectItem>
                <SelectItem value="earnings">Análise de Ganhos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Indicadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registrationStats.totalIndicators}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === "7_days" ? "nos últimos 7 dias" : 
               timeRange === "30_days" ? "nos últimos 30 dias" : "no período"}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {performanceStats.conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">de indicações validadas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Indicador</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceStats.avgReferralsPerIndicator.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">indicações por pessoa</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Totais</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {performanceStats.totalCommissions.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">no período</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Registration Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Timeline de Cadastros
            </CardTitle>
            <CardDescription>Novos indicadores cadastrados por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={registrationTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#2B579A" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Função</CardTitle>
            <CardDescription>Usuários cadastrados por tipo de função</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#1D3A5A"
                  dataKey="value"
                >
                  {roleDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Registration Sources */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fonte dos Cadastros</CardTitle>
          <CardDescription>Como os indicadores estão se registrando no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {registrationSources.map((source, index) => (
              <div key={source.name} className="text-center">
                <div className="text-3xl font-bold text-blue-600">{source.value}</div>
                <div className="text-sm text-gray-600">{source.name}</div>
                <div className="text-xs text-gray-500">
                  {registrationStats.totalIndicators > 0 
                    ? `${((source.value / registrationStats.totalIndicators) * 100).toFixed(1)}%`
                    : "0%"
                  }
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top Performers
          </CardTitle>
          <CardDescription>Indicadores com melhor performance no período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posição</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Indicações Totais</TableHead>
                  <TableHead>Indicações Validadas</TableHead>
                  <TableHead>Indicações Convertidas</TableHead>
                  <TableHead>Taxa de Conversão</TableHead>
                  <TableHead>Ganhos Totais</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPerformers.map((performer: any, index: number) => (
                  <TableRow key={performer.id}>
                    <TableCell>
                      <Badge className={
                        index === 0 ? "bg-yellow-100 text-yellow-800" :
                        index === 1 ? "bg-gray-100 text-gray-800" :
                        index === 2 ? "bg-orange-100 text-orange-800" :
                        "bg-blue-100 text-blue-800"
                      }>
                        {index + 1}º
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{performer.name}</TableCell>
                    <TableCell>{performer.totalReferrals}</TableCell>
                    <TableCell className="text-green-600">{performer.validatedReferrals}</TableCell>
                    <TableCell className="text-blue-600">{performer.convertedReferrals}</TableCell>
                    <TableCell>
                      <Badge className={
                        performer.conversionRate >= 80 ? "bg-green-100 text-green-800" :
                        performer.conversionRate >= 60 ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }>
                        {performer.conversionRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      R$ {performer.totalEarnings.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {topPerformers.length === 0 && (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum indicador com performance no período selecionado.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}