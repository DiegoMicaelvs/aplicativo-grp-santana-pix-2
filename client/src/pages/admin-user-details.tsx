import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, CreditCard, Calendar, MapPin, Building2, DollarSign, TrendingUp, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BackButton } from "@/components/ui/back-button";

export default function AdminUserDetailsPage() {
  const [, params] = useRoute("/admin/user-details/:id");
  const userId = params?.id ? parseInt(params.id) : 0;

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"]
  });

  const { data: referrals = [], isLoading: referralsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/referrals"]
  });

  const user = users.find((u: any) => u.id === userId);
  const userReferrals = referrals.filter((r: any) => r.userId === userId);

  // Calculate user statistics
  const stats = {
    totalReferrals: userReferrals.length,
    validatedReferrals: userReferrals.filter((r: any) => r.status === 'validated').length,
    convertedReferrals: userReferrals.filter((r: any) => r.status === 'converted').length,
    pendingReferrals: userReferrals.filter((r: any) => r.status === 'pending').length,
    totalEarnings: userReferrals.reduce((sum: number, r: any) => 
      sum + (parseFloat(r.commissionIndicator) || 0), 0
    )
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'validated': return 'bg-green-100 text-green-800';
      case 'converted': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'validated': return 'Validada';
      case 'converted': return 'Convertida';
      case 'pending': return 'Pendente';
      case 'rejected': return 'Rejeitada';
      case 'processing': return 'Processando';
      case 'paid': return 'Paga';
      default: return status;
    }
  };

  if (usersLoading || referralsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando detalhes do usuário...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Usuário não encontrado</h2>
          <p className="text-gray-600 mb-4">O usuário solicitado não foi encontrado no sistema.</p>
          <BackButton />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Detalhes do Usuário</h1>
            <p className="text-gray-600 mt-2">Informações completas e histórico de atividades</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Information */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Status</span>
                <Badge variant={user.isActive ? "default" : "secondary"}>
                  {user.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Perfil</span>
                <Badge variant="outline">
                  {user.role === 'indicador' ? 'Indicador' : 
                   user.role === 'promotor' ? 'Promotor' : 
                   user.role === 'admin' ? 'Administrador' : 
                   user.role === 'analista' ? 'Analista' : user.role}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{user.fullName}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{user.username}</span>
                </div>
                
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{user.phone}</span>
                  </div>
                )}
                
                {user.cpf && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{user.cpf}</span>
                  </div>
                )}
                
                {user.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{user.address}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    Cadastrado em {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Saldo Atual</span>
                  <span className="text-lg font-bold text-green-600">
                    R$ {parseFloat(user.balance || 0).toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Ganho</span>
                  <span className="text-sm">
                    R$ {parseFloat(user.totalEarnings || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics and Referrals */}
        <div className="lg:col-span-2">
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalReferrals}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Validadas</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.validatedReferrals}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Convertidas</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.convertedReferrals}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Ganho</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">R$ {stats.totalEarnings.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Referrals */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Indicações</CardTitle>
              <CardDescription>
                Últimas indicações realizadas pelo usuário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userReferrals.slice(0, 10).map((referral: any) => (
                      <TableRow key={referral.id}>
                        <TableCell className="font-medium">
                          {referral.clientName}
                        </TableCell>
                        <TableCell>{referral.phone}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(referral.status)}>
                            {getStatusLabel(referral.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          R$ {parseFloat(referral.commissionIndicator || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(referral.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {userReferrals.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Nenhuma indicação encontrada para este usuário.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}