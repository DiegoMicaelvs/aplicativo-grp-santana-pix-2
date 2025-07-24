import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, XCircle } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
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

const PERMISSION_GROUPS: Record<string, { key: AnalystPermission; label: string; description: string }[]> = {
  "Visualização": [
    { key: "view_referrals", label: "Visualizar Indicações", description: "Permite visualizar todas as indicações do sistema" },
    { key: "view_users", label: "Visualizar Usuários", description: "Permite visualizar informações dos usuários" },
    { key: "view_reports", label: "Visualizar Relatórios", description: "Acesso aos relatórios do sistema" },
  ],
  "Gestão": [
    { key: "edit_referral_status", label: "Editar Status das Indicações", description: "Permite alterar o status das indicações" },
    { key: "manage_withdrawals", label: "Gerenciar Saques", description: "Aprovar ou rejeitar solicitações de saque" },
    { key: "manage_companies", label: "Gerenciar Empresas", description: "Criar e editar empresas no sistema" },
  ],
  "Criação de Usuários": [
    { key: "create_indicadores", label: "Criar Indicadores", description: "Permite criar novos usuários indicadores" },
    { key: "create_promotores", label: "Criar Promotores", description: "Permite criar novos usuários promotores" },
  ],
};

export default function AnalystPermissions() {
  const { user } = useAuth();
  
  if (!user || user.role !== "analista") {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Restrito</h2>
              <p className="text-gray-500">Esta página é exclusiva para analistas.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userPermissions = user.permissions || [];
  const analystLevel = user.analystLevel || 1;
  
  const hasPermission = (permission: AnalystPermission) => {
    return userPermissions.includes(permission);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Minhas Permissões</h1>
          <p className="text-gray-600">Visualize suas permissões e capacidades no sistema</p>
        </div>
        <BackButton to="/analyst" />
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Informações do Analista
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Nome</p>
              <p className="font-medium">{user.fullName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Nível de Acesso</p>
              <div className="mt-1">
                <Badge 
                  className={
                    analystLevel === 3 
                      ? "bg-green-100 text-green-800" 
                      : analystLevel === 2 
                      ? "bg-yellow-100 text-yellow-800" 
                      : "bg-blue-100 text-blue-800"
                  }
                >
                  Nível {analystLevel} - {
                    analystLevel === 3 ? "Sênior" : 
                    analystLevel === 2 ? "Pleno" : 
                    "Júnior"
                  }
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total de Permissões</p>
              <p className="font-medium">{userPermissions.length} permissões ativas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Permissões Detalhadas</CardTitle>
          <CardDescription>
            Suas permissões determinam quais ações você pode realizar no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => (
              <div key={groupName}>
                <h3 className="font-semibold text-lg mb-4">{groupName}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {permissions.map(({ key, label, description }) => {
                    const hasAccess = hasPermission(key);
                    return (
                      <div 
                        key={key} 
                        className={`p-4 rounded-lg border ${
                          hasAccess 
                            ? "border-green-200 bg-green-50" 
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {hasAccess ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-gray-400" />
                              )}
                              <h4 className={`font-medium ${
                                hasAccess ? "text-green-900" : "text-gray-600"
                              }`}>
                                {label}
                              </h4>
                            </div>
                            <p className={`text-sm mt-1 ${
                              hasAccess ? "text-green-700" : "text-gray-500"
                            }`}>
                              {description}
                            </p>
                          </div>
                          <Badge 
                            variant={hasAccess ? "default" : "secondary"}
                            className={hasAccess ? "bg-green-600" : ""}
                          >
                            {hasAccess ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Capacidades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {hasPermission("view_referrals") && (
              <p className="text-sm">✓ Você pode visualizar todas as indicações do sistema</p>
            )}
            {hasPermission("edit_referral_status") && (
              <p className="text-sm">✓ Você pode alterar o status das indicações</p>
            )}
            {hasPermission("view_users") && (
              <p className="text-sm">✓ Você pode visualizar informações dos usuários</p>
            )}
            {hasPermission("manage_withdrawals") && (
              <p className="text-sm">✓ Você pode gerenciar solicitações de saque</p>
            )}
            {hasPermission("view_reports") && (
              <p className="text-sm">✓ Você tem acesso aos relatórios do sistema</p>
            )}
            {hasPermission("manage_companies") && (
              <p className="text-sm">✓ Você pode gerenciar empresas</p>
            )}
            {hasPermission("create_indicadores") && (
              <p className="text-sm">✓ Você pode criar novos indicadores</p>
            )}
            {hasPermission("create_promotores") && (
              <p className="text-sm">✓ Você pode criar novos promotores</p>
            )}
            {userPermissions.length === 0 && (
              <p className="text-sm text-gray-500">
                Você ainda não possui permissões atribuídas. Entre em contato com um administrador.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}