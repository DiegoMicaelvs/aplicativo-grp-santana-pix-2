import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  UsersIcon, 
  TrendingUpIcon, 
  BanknoteIcon, 
  ActivityIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  UserIcon
} from 'lucide-react';
import { format } from 'date-fns';

interface TeamStats {
  totalReferrals: number;
  convertedReferrals: number;
  totalCommissions: number;
}

interface TeamReferral {
  id: number;
  fullName: string;
  phone: string;
  licensePlate?: string;
  hasInsurance: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  commissionIndicator?: string;
  commissionPromoter?: string;
  user: {
    id: number;
    fullName: string;
    username: string;
  };
  company: {
    name: string;
  };
}

interface TeamMember {
  id: number;
  fullName: string;
  username: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  balance: string;
  totalEarnings: string;
}

export default function TeamDashboard() {
  const { data: teamStats } = useQuery<TeamStats>({
    queryKey: ['/api/team/stats']
  });

  const { data: teamReferrals = [] } = useQuery<TeamReferral[]>({
    queryKey: ['/api/team/referrals']
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/users/indicadores']
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <ClockIcon className="w-3 h-3 mr-1" />
          Pendente
        </Badge>;
      case 'validated':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <CheckCircleIcon className="w-3 h-3 mr-1" />
          Validado
        </Badge>;
      case 'converted':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <TrendingUpIcon className="w-3 h-3 mr-1" />
          Convertido
        </Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <XCircleIcon className="w-3 h-3 mr-1" />
          Rejeitado
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue || 0);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  const getConversionRate = () => {
    if (!teamStats || teamStats.totalReferrals === 0) return 0;
    return ((teamStats.convertedReferrals / teamStats.totalReferrals) * 100).toFixed(1);
  };

  const getTotalTeamEarnings = () => {
    return teamMembers.reduce((sum, member) => sum + parseFloat(member.totalEarnings || '0'), 0);
  };

  const getTotalTeamBalance = () => {
    return teamMembers.reduce((sum, member) => sum + parseFloat(member.balance || '0'), 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard da Equipe</h1>
        <p className="text-gray-600 dark:text-gray-400">Acompanhe o desempenho da sua equipe de indicadores</p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Indicadores</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {teamMembers.filter(m => m.isActive).length}
                </p>
              </div>
              <UsersIcon className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Indicações</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {teamStats?.totalReferrals || 0}
                </p>
              </div>
              <ActivityIcon className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Taxa de Conversão</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {getConversionRate()}%
                </p>
              </div>
              <TrendingUpIcon className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Comissões Ganhas</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(teamStats?.totalCommissions || 0)}
                </p>
              </div>
              <BanknoteIcon className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="referrals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="referrals">Indicações da Equipe</TabsTrigger>
          <TabsTrigger value="members">Membros da Equipe</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Indicações da Equipe</CardTitle>
            </CardHeader>
            <CardContent>
              {teamReferrals.length === 0 ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  Nenhuma indicação encontrada
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamReferrals.map((referral) => (
                        <TableRow key={referral.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <UserIcon className="w-4 h-4 text-gray-400" />
                              <div>
                                <div className="font-medium">{referral.user.fullName}</div>
                                <div className="text-sm text-gray-500">{referral.user.username}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{referral.fullName}</div>
                              <div className="text-sm text-gray-500">{referral.phone}</div>
                            </div>
                          </TableCell>
                          <TableCell>{referral.company.name}</TableCell>
                          <TableCell>{getStatusBadge(referral.status)}</TableCell>
                          <TableCell className="text-sm">{formatDate(referral.createdAt)}</TableCell>
                          <TableCell>
                            <div className="text-right">
                              {referral.commissionIndicator && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  Indicador: {formatCurrency(referral.commissionIndicator)}
                                </div>
                              )}
                              {referral.commissionPromoter && (
                                <div className="text-sm font-medium text-green-600 dark:text-green-400">
                                  Promotor: {formatCurrency(referral.commissionPromoter)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Membros da Equipe</CardTitle>
            </CardHeader>
            <CardContent>
              {teamMembers.length === 0 ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  Nenhum membro encontrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Saldo Atual</TableHead>
                        <TableHead>Total Ganho</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.fullName}</TableCell>
                          <TableCell>{member.username}</TableCell>
                          <TableCell>{member.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={member.isActive ? 'default' : 'secondary'}>
                              {member.isActive ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(member.balance)}
                          </TableCell>
                          <TableCell className="font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrency(member.totalEarnings)}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(member.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumo Financeiro da Equipe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Saldo Total da Equipe:</span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(getTotalTeamBalance())}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Total Ganho pela Equipe:</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(getTotalTeamEarnings())}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Suas Comissões:</span>
                    <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(teamStats?.totalCommissions || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estatísticas de Conversão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Total de Indicações:</span>
                    <span className="text-xl font-bold">{teamStats?.totalReferrals || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Convertidas:</span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {teamStats?.convertedReferrals || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Taxa de Conversão:</span>
                    <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {getConversionRate()}%
                    </span>
                  </div>
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-sm text-center text-gray-600 dark:text-gray-400">
                      {teamMembers.length > 0 && (
                        <>
                          Média de indicações por membro: {(teamStats?.totalReferrals || 0 / teamMembers.length).toFixed(1)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}