import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  FileText, 
  BarChart3, 
  Settings, 
  UserPlus,
  Shield,
  CheckCircle
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { AnalystPermission } from "@shared/schema";

const PERMISSION_LABELS: Record<AnalystPermission, string> = {
  view_referrals: "Visualizar Indicações",
  edit_referral_status: "Editar Status das Indicações",
  view_users: "Visualizar Usuários",
  manage_withdrawals: "Gerenciar Saques",
  view_reports: "Visualizar Relatórios",
  manage_companies: "Gerenciar Empresas",
  create_indicadores: "Criar Novos Indicadores",
  create_promotores: "Criar Novos Promotores"
};

export default function AnalystDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Fetch basic stats
  const { data: stats = {} } = useQuery({
    queryKey: ["/api/admin/stats"]
  });

  const hasPermission = (permission: AnalystPermission) => {
    return user?.permissions?.includes(permission);
  };

  const getAnalystLevelBadge = (level?: number) => {
    const levelNum = level || 1;
    const colors = {
      1: "bg-blue-100 text-blue-800",
      2: "bg-yellow-100 text-yellow-800", 
      3: "bg-green-100 text-green-800",
    };
    
    const labels = {
      1: "Nível 1 - Júnior",
      2: "Nível 2 - Pleno",
      3: "Nível 3 - Sênior",
    };
    
    return (
      <Badge className={colors[levelNum as keyof typeof colors]}>
        {labels[levelNum as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard do Analista</h1>
            <p className="text-gray-600 mt-2">
              Bem-vindo, {user?.fullName}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {getAnalystLevelBadge(user?.analystLevel)}
            <Badge variant="outline" className="text-sm">
              <Shield className="h-3 w-3 mr-1" />
              {user?.permissions?.length || 0} permissões
            </Badge>
          </div>
        </div>
      </div>

      {/* Permissions Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Suas Permissões
          </CardTitle>
          <CardDescription>
            Funcionalidades disponíveis para seu nível de acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {user?.permissions?.map((permission) => (
              <Badge key={permission} variant="secondary" className="justify-center p-2">
                <CheckCircle className="h-3 w-3 mr-1" />
                {PERMISSION_LABELS[permission as AnalystPermission]}
              </Badge>
            ))}
          </div>
          {(!user?.permissions || user.permissions.length === 0) && (
            <p className="text-gray-500 text-center py-4">
              Nenhuma permissão específica configurada. Entre em contato com o administrador.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Create Indicador */}
        {hasPermission("create_indicadores") && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5 text-blue-600" />
                Criar Indicador
              </CardTitle>
              <CardDescription>
                Cadastrar um novo indicador no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setLocation("/analyst/create-indicador")}
                className="w-full"
              >
                Novo Indicador
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create Promotor */}
        {hasPermission("create_promotores") && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5 text-green-600" />
                Criar Promotor
              </CardTitle>
              <CardDescription>
                Cadastrar um novo promotor no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setLocation("/analyst/create-promotor")}
                className="w-full"
                variant="outline"
              >
                Novo Promotor
              </Button>
            </CardContent>
          </Card>
        )}

        {/* View Referrals */}
        {hasPermission("view_referrals") && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-purple-600" />
                Indicações
              </CardTitle>
              <CardDescription>
                Visualizar e gerenciar indicações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setLocation("/admin/referrals-detailed")}
                className="w-full"
                variant="outline"
              >
                Ver Indicações
              </Button>
            </CardContent>
          </Card>
        )}

        {/* View Users */}
        {hasPermission("view_users") && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-orange-600" />
                Usuários
              </CardTitle>
              <CardDescription>
                Visualizar usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setLocation("/admin/indicators")}
                className="w-full"
                variant="outline"
              >
                Ver Usuários
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Manage Withdrawals */}
        {hasPermission("manage_withdrawals") && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-red-600" />
                Saques
              </CardTitle>
              <CardDescription>
                Gerenciar solicitações de saque
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setLocation("/admin/withdrawals")}
                className="w-full"
                variant="outline"
              >
                Gerenciar Saques
              </Button>
            </CardContent>
          </Card>
        )}

        {/* View Reports */}
        {hasPermission("view_reports") && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-teal-600" />
                Relatórios
              </CardTitle>
              <CardDescription>
                Visualizar relatórios e analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setLocation("/admin/analytics")}
                className="w-full"
                variant="outline"
              >
                Ver Relatórios
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIndicators || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promotores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPromoters || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingReferrals || 0}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}