import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  Users, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  UserCheck,
  Shield,
  Activity,
  BarChart3,
  Settings,
  ClipboardList
} from "lucide-react";
import type { User } from "@shared/schema";

/**
 * Formato real devolvido por GET /api/admin/stats (storage.getAdminStats).
 *
 * A tela consultava "/api/admin/dashboard/stats", rota que nunca existiu no
 * servidor, e lia campos que ela também não devolve (totalUsers, activeUsers,
 * pendingWithdrawals...). O resultado eram quatro cartões sempre zerados.
 */
interface DashboardStats {
  totalIndicadores: number;
  totalReferrals: number;
  pendingReferrals: number;
  convertedReferrals: number;
  conversionRate: string;
}

interface WithdrawalResumo {
  id: number;
  status: string;
  amount: string;
}

export default function ManagerDashboard() {
  const [location, navigate] = useLocation();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
  });

  /**
   * O gerente só enxerga o que as permissões do cadastro dele permitem — as
   * mesmas que o servidor exige (ver requirePermissao em server/routes.ts).
   * Sem isso o menu oferecia telas que respondiam 403 ao serem abertas.
   */
  const permissoes: string[] = (user as any)?.permissions ?? [];
  const ehAdmin = user?.role === "admin";
  const pode = (...necessarias: string[]) =>
    ehAdmin || necessarias.some((p) => permissoes.includes(p));

  // Saques pendentes: só busca se houver permissão, senão a chamada daria 403.
  const podeVerSaques = pode("manage_withdrawals", "view_financial_reports");
  const { data: saques } = useQuery<WithdrawalResumo[]>({
    queryKey: ["/api/admin/withdrawals"],
    enabled: podeVerSaques,
  });

  const saquesPendentes = (saques ?? []).filter((s) => s.status === "pending");
  const totalPendente = saquesPendentes.reduce(
    (soma, s) => soma + (parseFloat(s.amount) || 0),
    0,
  );

  /**
   * `requer` lista as permissões que abrem cada atalho — as MESMAS que o
   * servidor cobra na rota correspondente. Item sem `requer` aparece sempre.
   * O menu é filtrado logo abaixo: nada de oferecer porta que responde 403.
   */
  const menuItems = [
    {
      title: "Visão Geral",
      description: "Resumo completo do sistema",
      icon: Activity,
      path: "/manager",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Indicações",
      description: "Gerenciar todas as indicações",
      icon: FileText,
      path: "/admin/referrals-detailed",
      color: "text-green-600",
      bgColor: "bg-green-50",
      requer: ["view_all_referrals", "edit_all_referrals"],
    },
    {
      title: "Usuários",
      description: "Gerenciar todos os usuários",
      icon: Users,
      path: "/admin/profiles",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      requer: ["view_all_users", "manage_all_users"],
    },
    {
      title: "Analistas",
      description: "Configurar permissões dos analistas",
      icon: UserCheck,
      path: "/admin/analysts",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      requer: ["manage_analysts"],
    },
    {
      title: "Promotores",
      description: "Gerenciar promotores e indicadores",
      icon: Shield,
      path: "/admin/indicators",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      requer: ["manage_promoters", "view_all_users"],
    },
    {
      title: "Financeiro",
      description: "Saques e pagamentos",
      icon: DollarSign,
      path: "/admin/withdrawals",
      color: "text-green-600",
      bgColor: "bg-green-50",
      requer: ["manage_withdrawals", "view_financial_reports"],
    },
    {
      title: "Relatórios",
      description: "Análises e estatísticas",
      icon: BarChart3,
      path: "/admin/analytics",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      requer: ["view_all_reports", "view_financial_reports"],
    },
    {
      title: "Auditoria",
      description: "Logs de sistema",
      icon: ClipboardList,
      path: "/admin/audit-log",
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      requer: ["audit_access"],
    },
    {
      title: "Configurações",
      description: "Configurações do sistema",
      icon: Settings,
      path: "/admin/settings",
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      // Não há permissão de gerente para configurações: só admin.
      somenteAdmin: true,
    },
  ];

  const itensVisiveis = menuItems.filter((item) => {
    if ((item as any).somenteAdmin) return ehAdmin;
    const requer = (item as any).requer as string[] | undefined;
    return !requer || pode(...requer);
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Painel do Gerente
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo(a), {user?.fullName}! Gerencie todas as operações do sistema.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Indicadores
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats?.totalIndicadores ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                cadastrados no sistema
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Indicações
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats?.totalReferrals ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {dashboardStats?.pendingReferrals ?? 0} pendentes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Saques Pendentes
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {/* Só quem tem permissão financeira busca os saques; para os
                  demais o cartão informa isso em vez de mostrar zero falso. */}
              {podeVerSaques ? (
                <>
                  <div className="text-2xl font-bold">{saquesPendentes.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    R$ {totalPendente.toFixed(2).replace(".", ",")} a processar
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">—</div>
                  <p className="text-xs text-muted-foreground mt-1">sem permissão financeira</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Taxa de Conversão
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardStats?.conversionRate ?? 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                convertidas sobre validadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {itensVisiveis.map((item) => {
            const Icon = item.icon;
            return (
              <Card 
                key={item.path}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(item.path)}
              >
                <CardHeader>
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${item.bgColor} mb-4`}>
                    <Icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Permissions Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Suas Permissões</CardTitle>
            <CardDescription>
              Como gerente, você tem acesso completo às seguintes áreas:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Visualização</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Todas as indicações e seus detalhes</li>
                  <li>• Todos os usuários do sistema</li>
                  <li>• Relatórios completos e financeiros</li>
                  <li>• Logs de auditoria do sistema</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Gerenciamento</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Editar status de indicações</li>
                  <li>• Gerenciar analistas e suas permissões</li>
                  <li>• Gerenciar promotores e indicadores</li>
                  <li>• Aprovar saques e pagamentos</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
}