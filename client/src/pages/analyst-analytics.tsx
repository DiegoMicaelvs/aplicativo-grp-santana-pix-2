import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { BackButton } from "@/components/ui/back-button";
import { ArrowUp, ArrowDown, Users, UserPlus, BarChart, DollarSign, FileText } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";

export default function AnalystAnalyticsPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<string>("30_days");
  const [analysisType, setAnalysisType] = useState<string>("registrations");

  // Use appropriate endpoints based on user role
  const isAdmin = user?.role === "admin";
  const baseUrl = isAdmin ? "/api/admin" : "/api/analyst/analytics";

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: [`${baseUrl}/users`]
  });

  const { data: referrals = [], isLoading: referralsLoading } = useQuery<any[]>({
    queryKey: [`${baseUrl}/referrals`]
  });

  const { data: auditLog = [], isLoading: auditLoading } = useQuery<any[]>({
    queryKey: [`${baseUrl}/audit-log`]
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
    totalIndicators: filteredUsers.filter((u: any) => u.role === "indicador").length,
    totalPromoters: filteredUsers.filter((u: any) => u.role === "promotor").length,
    totalAnalysts: filteredUsers.filter((u: any) => u.role === "analista").length,
    activeUsers: filteredUsers.filter((u: any) => u.isActive).length,
    selfRegistrations: filteredUsers.filter((u: any) => !u.createdBy).length,
    adminCreated: filteredUsers.filter((u: any) => u.createdBy).length
  };

  // Performance Analysis
  const performanceStats = {
    totalReferrals: filteredReferrals.length,
    validatedReferrals: filteredReferrals.filter((r: any) => r.status === "validated").length,
    conversionRate: filteredReferrals.length > 0 ? 
      (filteredReferrals.filter((r: any) => r.status === "validated").length / filteredReferrals.length * 100) : 0,
    totalCommissions: filteredReferrals.reduce((sum: number, r: any) => 
      sum + (parseFloat(r.commissionIndicator) || 0) + (parseFloat(r.commissionPromoter) || 0), 0),
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

    filteredUsers.filter((u: any) => u.role === "indicador").forEach((user: any) => {
      const dateKey = format(new Date(user.createdAt), "dd/MM");
      if (timeline[dateKey] !== undefined) {
        timeline[dateKey]++;
      }
    });

    return Object.entries(timeline).map(([date, count]) => ({ date, count }));
  };

  const registrationData = getRegistrationTimeline();

  // Top performers
  const getTopPerformers = () => {
    const performerMap = new Map<number, { user: any, referralCount: number, totalCommission: number }>();

    filteredReferrals.forEach((referral: any) => {
      if (!performerMap.has(referral.userId)) {
        const userData = users.find((u: any) => u.id === referral.userId);
        if (userData) {
          performerMap.set(referral.userId, {
            user: userData,
            referralCount: 0,
            totalCommission: 0
          });
        }
      }

      const performer = performerMap.get(referral.userId);
      if (performer) {
        performer.referralCount++;
        performer.totalCommission += parseFloat(referral.commissionIndicator) || 0;
      }
    });

    return Array.from(performerMap.values())
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .slice(0, 5);
  };

  const topPerformers = getTopPerformers();

  if (usersLoading || referralsLoading || auditLoading) {
    return (
      <div className="container mx-auto p-6">
        <BackButton href="/analyst/dashboard" />
        <div className="flex items-center justify-center h-64">
          <p>Carregando dados de análise...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <BackButton href="/analyst/dashboard" />
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Relatórios e Analytics</h1>
        <p className="text-gray-600 mt-2">Análise detalhada de performance e estatísticas</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex gap-4">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7_days">Últimos 7 dias</SelectItem>
            <SelectItem value="30_days">Últimos 30 dias</SelectItem>
            <SelectItem value="90_days">Últimos 90 dias</SelectItem>
            <SelectItem value="this_month">Este mês</SelectItem>
          </SelectContent>
        </Select>

        <Select value={analysisType} onValueChange={setAnalysisType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="registrations">Cadastros</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="timeline">Linha do Tempo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Registration Analysis */}
      {analysisType === "registrations" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Total de Indicadores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{registrationStats.totalIndicators}</div>
                <p className="text-sm text-gray-600">Ativos no período</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Novos Cadastros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{filteredUsers.length}</div>
                <p className="text-sm text-gray-600">No período selecionado</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-5 w-5" />
                  Taxa de Ativação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {filteredUsers.length > 0 
                    ? Math.round((registrationStats.activeUsers / filteredUsers.length) * 100)
                    : 0}%
                </div>
                <p className="text-sm text-gray-600">Usuários ativos</p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown by role */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Distribuição por Tipo</CardTitle>
              <CardDescription>Breakdown de usuários cadastrados por função</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Indicadores</span>
                  <div className="flex items-center gap-2">
                    <Badge>{registrationStats.totalIndicators}</Badge>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${filteredUsers.length > 0 ? (registrationStats.totalIndicators / filteredUsers.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Promotores</span>
                  <div className="flex items-center gap-2">
                    <Badge>{registrationStats.totalPromoters}</Badge>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${filteredUsers.length > 0 ? (registrationStats.totalPromoters / filteredUsers.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Analistas</span>
                  <div className="flex items-center gap-2">
                    <Badge>{registrationStats.totalAnalysts}</Badge>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${filteredUsers.length > 0 ? (registrationStats.totalAnalysts / filteredUsers.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Performance Analysis */}
      {analysisType === "performance" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Total de Indicações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{performanceStats.totalReferrals}</div>
                <p className="text-sm text-gray-600">No período</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-5 w-5" />
                  Taxa de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{performanceStats.conversionRate.toFixed(1)}%</div>
                <p className="text-sm text-gray-600">Indicações validadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Total em Comissões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">R$ {performanceStats.totalCommissions.toFixed(2)}</div>
                <p className="text-sm text-gray-600">Gerado no período</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Indicadores</CardTitle>
              <CardDescription>Maiores geradores de receita no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformers.map((performer, index) => (
                  <div key={performer.user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{index + 1}º</Badge>
                      <div>
                        <p className="font-medium">{performer.user.fullName}</p>
                        <p className="text-sm text-gray-600">{performer.referralCount} indicações</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">R$ {performer.totalCommission.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Timeline Analysis */}
      {analysisType === "timeline" && (
        <Card>
          <CardHeader>
            <CardTitle>Linha do Tempo de Cadastros</CardTitle>
            <CardDescription>Evolução de novos indicadores no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {registrationData.map((data) => (
                <div key={data.date} className="flex items-center gap-4">
                  <span className="text-sm w-16">{data.date}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                    <div 
                      className="bg-blue-600 h-4 rounded-full"
                      style={{ width: `${Math.max((data.count / Math.max(...registrationData.map(d => d.count))) * 100, 5)}%` }}
                    />
                  </div>
                  <Badge variant="outline">{data.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}