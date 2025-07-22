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

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalReferrals: number;
  pendingReferrals: number;
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: string;
  conversionRate: number;
}

export default function ManagerDashboard() {
  const [location, navigate] = useLocation();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard/stats"],
  });

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
    },
    {
      title: "Usuários",
      description: "Gerenciar todos os usuários",
      icon: Users,
      path: "/admin/profiles",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Analistas",
      description: "Configurar permissões dos analistas",
      icon: UserCheck,
      path: "/admin/analysts",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Promotores",
      description: "Gerenciar promotores e indicadores",
      icon: Shield,
      path: "/admin/indicators",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Financeiro",
      description: "Saques e pagamentos",
      icon: DollarSign,
      path: "/admin/withdrawals",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Relatórios",
      description: "Análises e estatísticas",
      icon: BarChart3,
      path: "/admin/analytics",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Auditoria",
      description: "Logs de sistema",
      icon: ClipboardList,
      path: "/admin/audit-log",
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
    {
      title: "Configurações",
      description: "Configurações do sistema",
      icon: Settings,
      path: "/admin/settings",
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
  ];

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
                  Total de Usuários
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {dashboardStats?.activeUsers || 0} ativos
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
              <div className="text-2xl font-bold">{dashboardStats?.totalReferrals || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {dashboardStats?.pendingReferrals || 0} pendentes
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
              <div className="text-2xl font-bold">{dashboardStats?.pendingWithdrawals || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                R$ {dashboardStats?.pendingWithdrawalsAmount || "0,00"}
              </p>
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
                {dashboardStats?.conversionRate || 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Últimos 30 dias
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => {
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