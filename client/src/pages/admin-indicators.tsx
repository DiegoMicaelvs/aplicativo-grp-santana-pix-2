import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Eye, Search, Filter, Users, DollarSign, TrendingUp, UserPlus, User, Mail, Phone, CreditCard, Calendar, MapPin, FileText, CalendarDays, ArrowUpDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, endOfDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BackButton } from "@/components/ui/back-button";
import { apiRequest } from "@/lib/queryClient";

export default function AdminIndicatorsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all_roles");
  const [statusFilter, setStatusFilter] = useState<string>("all_statuses");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedPromoterId, setSelectedPromoterId] = useState<string>("");
  const [assignmentType, setAssignmentType] = useState<"promotor" | "analista">("promotor");
  const [selectedAnalystId, setSelectedAnalystId] = useState<string>("");
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [detailsUser, setDetailsUser] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users"]
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ["/api/admin/referrals"]
  });

  const { data: promoters = [] } = useQuery({
    queryKey: ["/api/admin/promoters"]
  });

  const { data: referralLinks = [] } = useQuery({
    queryKey: ["/api/referral-links"]
  });

  // Get analysts level 3
  const analysts = (users as any[]).filter((u: any) => 
    u.role === "analista" && u.analystLevel === 3
  );

  // Filter indicators based on search and filters
  const filteredIndicators = (users as any[]).filter((user: any) => {
    const matchesSearch = user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.cpf?.includes(searchTerm);
    const matchesRole = roleFilter === "all_roles" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all_statuses" || 
                          (statusFilter === "active" && user.isActive === true) ||
                          (statusFilter === "inactive" && user.isActive === false) ||
                          (statusFilter === "suspended" && user.isActive === false);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    totalIndicators: (users as any[]).filter((u: any) => u.role === "indicador").length,
    activeIndicators: (users as any[]).filter((u: any) => u.role === "indicador" && u.isActive === true).length,
    totalReferrals: (referrals as any[]).length,
    totalCommissions: (referrals as any[]).reduce((sum: number, r: any) => sum + (parseFloat(r.commissionIndicator) || 0), 0)
  };

  // Get referrals count for each indicator
  const getReferralsCount = (userId: number) => {
    return (referrals as any[]).filter((r: any) => r.userId === userId).length;
  };

  // Get total earnings for each indicator
  const getTotalEarnings = (userId: number) => {
    return (referrals as any[])
      .filter((r: any) => r.userId === userId && r.status === "validated")
      .reduce((sum: number, r: any) => sum + (parseFloat(r.commissionIndicator) || 0), 0);
  };

  // Get who registered each indicator
  const getRegisteredBy = (userId: number) => {
    const user = (users as any[]).find((u: any) => u.id === userId);
    
    // Check if registered via referral link
    // User has promoterId but no createdBy (or createdBy is null) = registered via link
    if (user?.promoterId && !user?.createdBy) {
      const linkOwner = (users as any[]).find((u: any) => u.id === user.promoterId);
      if (linkOwner) {
        return `Link de referência - ${linkOwner.fullName}`;
      }
      return "Link de referência";
    }
    
    // Normal registration by another user
    if (user?.createdBy) {
      const creator = (users as any[]).find((u: any) => u.id === user.createdBy);
      if (creator) {
        const roleLabel = creator.role === "analista" ? " (Analista)" : 
                         creator.role === "admin" ? " (Admin)" : 
                         creator.role === "promotor" ? " (Promotor)" : "";
        return creator.fullName + roleLabel;
      }
      return "Sistema";
    }
    return "Auto-cadastro";
  };

  // Status helpers for referrals
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
      case 'analyzing': return 'Em Análise';
      case 'false': return 'Falso';
      case 'not_validated': return 'Não validado';
      case 'not_converted': return 'Não convertido';
      case 'contact_list': return 'Lista de contato';
      default: return status;
    }
  };

  // Get analyst assignment for promoters
  const getAnalystAssignment = (user: any) => {
    if (user?.role !== "promotor") return null;
    
    // Check if promoter has a supervisorId
    if (!user.supervisorId) return null;
    
    // Find the analyst with that ID
    const analyst = (users as any[]).find((u: any) => 
      u.id === user.supervisorId && u.role === "analista" && u.analystLevel === 3
    );
    
    // If not found as analyst level 3, check if it's any analyst
    if (!analyst) {
      const anyAnalyst = (users as any[]).find((u: any) => 
        u.id === user.supervisorId && u.role === "analista"
      );
      if (anyAnalyst) {
        return `${anyAnalyst.fullName} (Nível ${anyAnalyst.analystLevel || '?'})`;
      }
    }
    
    return analyst ? analyst.fullName : null;
  };

  // Get assignment for indicators (can be promoter or analyst)
  const getIndicatorAssignment = (user: any) => {
    if (user.promoterId) {
      const promoter = (users as any[]).find((u: any) => u.id === user.promoterId);
      return promoter ? { type: 'promotor', name: promoter.fullName } : null;
    } else if (user.supervisorId) {
      const analyst = (users as any[]).find((u: any) => 
        u.id === user.supervisorId && u.role === "analista" && u.analystLevel === 3
      );
      return analyst ? { type: 'analista', name: analyst.fullName } : null;
    }
    return null;
  };

  // Assignment mutation
  const assignIndicatorMutation = useMutation({
    mutationFn: async ({ userId, promoterId, supervisorId }: { userId: number; promoterId: number | null; supervisorId: number | null }) => {
      const response = await fetch(`/api/admin/users/${userId}/assign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ promoterId, supervisorId })
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atribuir');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      toast({
        title: "Sucesso",
        description: "Indicador atribuído com sucesso!"
      });
      setIsAssignDialogOpen(false);
      setSelectedUser(null);
      setSelectedPromoterId("");
      setSelectedAnalystId("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atribuir indicador. Tente novamente.",
        variant: "destructive"
      });
    }
  });

  const handleAssignIndicator = () => {
    if (!selectedUser) return;
    
    if (assignmentType === "promotor") {
      const promoterId = selectedPromoterId === "unassign" ? null : parseInt(selectedPromoterId);
      assignIndicatorMutation.mutate({ 
        userId: selectedUser.id, 
        promoterId,
        supervisorId: null 
      });
    } else {
      const supervisorId = selectedAnalystId === "unassign" ? null : parseInt(selectedAnalystId);
      assignIndicatorMutation.mutate({ 
        userId: selectedUser.id, 
        promoterId: null,
        supervisorId 
      });
    }
  };

  // Get promoter name
  const getPromoterName = (promoterId: number | null) => {
    if (!promoterId) return "Não atribuído";
    const promoter = (promoters as any[]).find((p: any) => p.id === promoterId);
    return promoter?.fullName || "Promotor não encontrado";
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "indicador": return "bg-blue-100 text-blue-800";
      case "promotor": return "bg-green-100 text-green-800";
      case "analista": return "bg-purple-100 text-purple-800";
      case "admin": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "inactive": return "bg-red-100 text-red-800";
      case "suspended": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando indicadores...</p>
          </div>
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
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Indicadores</h1>
            <p className="text-gray-600 mt-2">Visualize e gerencie todos os indicadores cadastrados no sistema</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Indicadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIndicators}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicadores Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeIndicators}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Totais</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ {stats.totalCommissions.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, email ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filtrar por função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_roles">Todas as Funções</SelectItem>
                <SelectItem value="indicador">Indicador</SelectItem>
                <SelectItem value="promotor">Promotor</SelectItem>
                <SelectItem value="analista">Analista</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_statuses">Todos os Status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Indicators Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Indicadores</CardTitle>
          <CardDescription>
            {filteredIndicators.length} de {(users as any[]).length} indicadores encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">Ações</TableHead>
                    <TableHead className="min-w-[150px]">Nome</TableHead>
                    <TableHead className="min-w-[200px]">Email</TableHead>
                    <TableHead className="min-w-[120px]">CPF</TableHead>
                    <TableHead className="min-w-[100px]">Função</TableHead>
                    <TableHead className="min-w-[80px]">Status</TableHead>
                    <TableHead className="min-w-[180px]">Atribuição</TableHead>
                    <TableHead className="min-w-[150px]">Cadastrado por</TableHead>
                    <TableHead className="min-w-[90px]">Indicações</TableHead>
                    <TableHead className="min-w-[120px]">Ganhos Totais</TableHead>
                    <TableHead className="min-w-[100px]">Data Cadastro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIndicators.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setDetailsUser(user);
                            setIsDetailsDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detalhes
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{user.fullName}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{user.username}</TableCell>
                      <TableCell className="font-mono text-sm">{user.cpf}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(user.isActive ? "active" : "inactive")}>
                        {user.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.role === "indicador" ? (
                          <div className="flex items-center gap-2">
                            {(() => {
                              const assignment = getIndicatorAssignment(user);
                              if (assignment) {
                                return (
                                  <span className={assignment.type === "promotor" ? "text-green-600 font-medium" : "text-blue-600 font-medium"}>
                                    {assignment.type === "promotor" ? "" : "Analista: "}{assignment.name}
                                  </span>
                                );
                              }
                              return <span className="text-gray-500">Não atribuído</span>;
                            })()}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setSelectedPromoterId(user.promoterId?.toString() || "");
                                setSelectedAnalystId(user.supervisorId?.toString() || "");
                                setAssignmentType(user.supervisorId ? "analista" : "promotor");
                                setIsAssignDialogOpen(true);
                              }}
                            >
                              <UserPlus className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : user.role === "promotor" ? (
                          <div className="flex items-center gap-2">
                            {getAnalystAssignment(user) ? (
                              <span className="text-blue-600 font-medium">
                                Analista: {getAnalystAssignment(user)}
                              </span>
                            ) : (
                              <span className="text-gray-500">Sem atribuição</span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setSelectedAnalystId(user.supervisorId?.toString() || "");
                                setAssignmentType("analista");
                                setIsAssignDialogOpen(true);
                              }}
                            >
                              <UserPlus className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getRegisteredBy(user.id)}</TableCell>
                    <TableCell className="text-center">{getReferralsCount(user.id)}</TableCell>
                    <TableCell className="text-green-600 font-semibold whitespace-nowrap">
                      R$ {getTotalEarnings(user.id).toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {user.createdAt ? format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            
            {filteredIndicators.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum indicador encontrado com os filtros aplicados.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
            <DialogDescription>
              Informações completas e histórico de atividades
            </DialogDescription>
          </DialogHeader>
          
          {detailsUser && (() => {
            const allUserReferrals = (referrals as any[]).filter((r: any) => r.userId === detailsUser.id);
            
            // Helper function to get validation date from statusHistory
            const getValidationDate = (referral: any): Date | null => {
              if (!referral.statusHistory || !Array.isArray(referral.statusHistory)) {
                return null;
              }
              const validatedEntry = referral.statusHistory.find((entry: any) => entry.status === 'validated');
              return validatedEntry ? new Date(validatedEntry.changedAt) : null;
            };

            // Helper function to get conversion date from statusHistory
            const getConversionDate = (referral: any): Date | null => {
              if (!referral.statusHistory || !Array.isArray(referral.statusHistory)) {
                return null;
              }
              const convertedEntry = referral.statusHistory.find((entry: any) => entry.status === 'converted');
              return convertedEntry ? new Date(convertedEntry.changedAt) : null;
            };

            // Filter referrals by date range if selected - using validation date
            let userReferrals = allUserReferrals;
            let validatedInPeriod: any[] = [];
            let convertedInPeriod: any[] = [];
            
            if (dateFrom && dateTo) {
              // For total referrals, use creation date
              userReferrals = allUserReferrals.filter((r: any) => {
                const refDate = new Date(r.createdAt);
                return isWithinInterval(refDate, { 
                  start: startOfDay(dateFrom), 
                  end: endOfDay(dateTo) 
                });
              });

              // For validated referrals, use validation date from statusHistory
              validatedInPeriod = allUserReferrals.filter((r: any) => {
                const validationDate = getValidationDate(r);
                if (!validationDate) return false;
                return isWithinInterval(validationDate, {
                  start: startOfDay(dateFrom),
                  end: endOfDay(dateTo)
                });
              });

              // For converted referrals, use conversion date from statusHistory
              convertedInPeriod = allUserReferrals.filter((r: any) => {
                const conversionDate = getConversionDate(r);
                if (!conversionDate) return false;
                return isWithinInterval(conversionDate, {
                  start: startOfDay(dateFrom),
                  end: endOfDay(dateTo)
                });
              });
            } else {
              validatedInPeriod = allUserReferrals.filter((r: any) => r.status === 'validated');
              convertedInPeriod = allUserReferrals.filter((r: any) => r.status === 'converted');
            }

            const userStats = {
              totalReferrals: userReferrals.length,
              validatedReferrals: validatedInPeriod.length,
              convertedReferrals: convertedInPeriod.length,
              pendingReferrals: userReferrals.filter((r: any) => r.status === 'pending').length,
              totalEarnings: validatedInPeriod.reduce((sum: number, r: any) => 
                sum + (parseFloat(r.commissionIndicator) || 0), 0
              )
            };

            // Monthly comparison - based on validation date
            const currentMonth = new Date();
            const previousMonth = subMonths(currentMonth, 1);

            // Filter referrals by creation date (for total count)
            const currentMonthReferrals = allUserReferrals.filter((r: any) => {
              const refDate = new Date(r.createdAt);
              return isWithinInterval(refDate, { 
                start: startOfMonth(currentMonth), 
                end: endOfMonth(currentMonth) 
              });
            });
            
            const previousMonthReferrals = allUserReferrals.filter((r: any) => {
              const refDate = new Date(r.createdAt);
              return isWithinInterval(refDate, { 
                start: startOfMonth(previousMonth), 
                end: endOfMonth(previousMonth) 
              });
            });

            // Filter referrals validated in current/previous month
            const currentMonthValidated = allUserReferrals.filter((r: any) => {
              const validationDate = getValidationDate(r);
              if (!validationDate) return false;
              return isWithinInterval(validationDate, {
                start: startOfMonth(currentMonth),
                end: endOfMonth(currentMonth)
              });
            });

            const previousMonthValidated = allUserReferrals.filter((r: any) => {
              const validationDate = getValidationDate(r);
              if (!validationDate) return false;
              return isWithinInterval(validationDate, {
                start: startOfMonth(previousMonth),
                end: endOfMonth(previousMonth)
              });
            });

            // Filter referrals converted in current/previous month
            const currentMonthConverted = allUserReferrals.filter((r: any) => {
              const conversionDate = getConversionDate(r);
              if (!conversionDate) return false;
              return isWithinInterval(conversionDate, {
                start: startOfMonth(currentMonth),
                end: endOfMonth(currentMonth)
              });
            });

            const previousMonthConverted = allUserReferrals.filter((r: any) => {
              const conversionDate = getConversionDate(r);
              if (!conversionDate) return false;
              return isWithinInterval(conversionDate, {
                start: startOfMonth(previousMonth),
                end: endOfMonth(previousMonth)
              });
            });

            const currentMonthStats = {
              total: currentMonthReferrals.length,
              validated: currentMonthValidated.length,
              converted: currentMonthConverted.length,
              earnings: currentMonthValidated.reduce((sum: number, r: any) => 
                sum + (parseFloat(r.commissionIndicator) || 0), 0
              )
            };

            const previousMonthStats = {
              total: previousMonthReferrals.length,
              validated: previousMonthValidated.length,
              converted: previousMonthConverted.length,
              earnings: previousMonthValidated.reduce((sum: number, r: any) => 
                sum + (parseFloat(r.commissionIndicator) || 0), 0
              )
            };

            const calculatePercentage = (current: number, previous: number) => {
              if (previous === 0) return current > 0 ? 100 : 0;
              return ((current - previous) / previous) * 100;
            };

            return (
              <div className="space-y-6">
                {/* User Information Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Informações Pessoais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                      {/* Status and Profile Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={detailsUser.isActive ? "default" : "secondary"}>
                          {detailsUser.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant="outline">
                          {detailsUser.role === 'indicador' ? 'Indicador' : 
                           detailsUser.role === 'promotor' ? 'Promotor' : 
                           detailsUser.role === 'admin' ? 'Administrador' : 
                           detailsUser.role === 'analista' ? 'Analista' : detailsUser.role}
                        </Badge>
                      </div>

                      {/* Personal Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-sm truncate">{detailsUser.fullName}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-sm truncate">{detailsUser.username}</span>
                        </div>
                        
                        {detailsUser.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <span className="text-sm">{detailsUser.phone}</span>
                          </div>
                        )}
                        
                        {detailsUser.cpf && (
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <span className="text-sm">{detailsUser.cpf}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 md:col-span-2">
                          <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-sm">
                            Cadastrado em {format(new Date(detailsUser.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        
                        {detailsUser.address && (
                          <div className="flex items-center gap-2 md:col-span-2">
                            <MapPin className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <span className="text-sm">{detailsUser.address}</span>
                          </div>
                        )}
                      </div>

                      {/* Financial Metrics */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-xs font-medium text-green-700 mb-1">Saldo Atual</div>
                          <div className="text-xl font-bold text-green-600">
                            R$ {parseFloat(detailsUser.balance || 0).toFixed(2)}
                          </div>
                        </div>
                        
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-xs font-medium text-blue-700 mb-1">Total Ganho</div>
                          <div className="text-xl font-bold text-blue-600">
                            R$ {parseFloat(detailsUser.totalEarnings || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                </Card>

                {/* Date Filter */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5" />
                      Filtrar por Período
                      {dateFrom && dateTo && (
                        <Badge variant="secondary" className="ml-2">
                          Filtro Ativo
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 items-end">
                      <div className="flex-1 min-w-[200px]">
                        <label className="text-sm font-medium mb-2 block">Data Inicial</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={dateFrom}
                              onSelect={setDateFrom}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="flex-1 min-w-[200px]">
                        <label className="text-sm font-medium mb-2 block">Data Final</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={dateTo}
                              onSelect={setDateTo}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setDateFrom(undefined);
                          setDateTo(undefined);
                        }}
                      >
                        Limpar Filtros
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Statistics and Referrals */}
                <div>
                  {/* Period Indicator */}
                  {dateFrom && dateTo && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-800">
                        📊 Estatísticas do período: {format(dateFrom, "dd/MM/yyyy", { locale: ptBR })} até {format(dateTo, "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                  
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userStats.totalReferrals}</div>
                        {dateFrom && dateTo && (
                          <p className="text-xs text-gray-500 mt-1">No período filtrado</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Validadas</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">{userStats.validatedReferrals}</div>
                        {dateFrom && dateTo && (
                          <p className="text-xs text-gray-500 mt-1">No período filtrado</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Convertidas</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{userStats.convertedReferrals}</div>
                        {dateFrom && dateTo && (
                          <p className="text-xs text-gray-500 mt-1">No período filtrado</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Ganho</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">R$ {userStats.totalEarnings.toFixed(2)}</div>
                        {dateFrom && dateTo && (
                          <p className="text-xs text-gray-500 mt-1">No período filtrado</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent Referrals */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Histórico de Indicações</CardTitle>
                      <CardDescription>
                        {dateFrom && dateTo 
                          ? `Indicações do período: ${format(dateFrom, "dd/MM/yyyy", { locale: ptBR })} até ${format(dateTo, "dd/MM/yyyy", { locale: ptBR })}`
                          : 'Últimas indicações realizadas pelo usuário'
                        }
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
                                  {referral.fullName}
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

                {/* Monthly Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpDown className="h-5 w-5" />
                      Comparação Mensal Detalhada
                    </CardTitle>
                    <CardDescription>
                      Comparativo de desempenho entre {format(previousMonth, "MMMM/yyyy", { locale: ptBR })} e {format(currentMonth, "MMMM/yyyy", { locale: ptBR })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Total de Indicações */}
                      <div className="border-b pb-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm">Total de Indicações</h4>
                          <div className={`flex items-center gap-1 text-sm font-medium ${calculatePercentage(currentMonthStats.total, previousMonthStats.total) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {calculatePercentage(currentMonthStats.total, previousMonthStats.total) >= 0 ? '↑' : '↓'} 
                            {Math.abs(calculatePercentage(currentMonthStats.total, previousMonthStats.total)).toFixed(1)}%
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">
                              {format(previousMonth, "MMMM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-2xl font-bold text-gray-700">{previousMonthStats.total}</div>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="text-xs text-blue-600 mb-1">
                              {format(currentMonth, "MMMM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-2xl font-bold text-blue-600">{currentMonthStats.total}</div>
                          </div>
                        </div>
                      </div>

                      {/* Indicações Validadas */}
                      <div className="border-b pb-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm">Indicações Validadas</h4>
                          <div className={`flex items-center gap-1 text-sm font-medium ${calculatePercentage(currentMonthStats.validated, previousMonthStats.validated) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {calculatePercentage(currentMonthStats.validated, previousMonthStats.validated) >= 0 ? '↑' : '↓'} 
                            {Math.abs(calculatePercentage(currentMonthStats.validated, previousMonthStats.validated)).toFixed(1)}%
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">
                              {format(previousMonth, "MMMM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-2xl font-bold text-gray-700">{previousMonthStats.validated}</div>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <div className="text-xs text-green-600 mb-1">
                              {format(currentMonth, "MMMM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-2xl font-bold text-green-600">{currentMonthStats.validated}</div>
                          </div>
                        </div>
                      </div>

                      {/* Indicações Convertidas */}
                      <div className="border-b pb-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm">Indicações Convertidas</h4>
                          <div className={`flex items-center gap-1 text-sm font-medium ${calculatePercentage(currentMonthStats.converted, previousMonthStats.converted) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {calculatePercentage(currentMonthStats.converted, previousMonthStats.converted) >= 0 ? '↑' : '↓'} 
                            {Math.abs(calculatePercentage(currentMonthStats.converted, previousMonthStats.converted)).toFixed(1)}%
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">
                              {format(previousMonth, "MMMM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-2xl font-bold text-gray-700">{previousMonthStats.converted}</div>
                          </div>
                          <div className="bg-purple-50 p-3 rounded-lg">
                            <div className="text-xs text-purple-600 mb-1">
                              {format(currentMonth, "MMMM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-2xl font-bold text-purple-600">{currentMonthStats.converted}</div>
                          </div>
                        </div>
                      </div>

                      {/* Total Ganho */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm">Total Ganho em Comissões</h4>
                          <div className={`flex items-center gap-1 text-sm font-medium ${calculatePercentage(currentMonthStats.earnings, previousMonthStats.earnings) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {calculatePercentage(currentMonthStats.earnings, previousMonthStats.earnings) >= 0 ? '↑' : '↓'} 
                            {Math.abs(calculatePercentage(currentMonthStats.earnings, previousMonthStats.earnings)).toFixed(1)}%
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">
                              {format(previousMonth, "MMMM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-2xl font-bold text-gray-700">R$ {previousMonthStats.earnings.toFixed(2)}</div>
                          </div>
                          <div className="bg-emerald-50 p-3 rounded-lg">
                            <div className="text-xs text-emerald-600 mb-1">
                              {format(currentMonth, "MMMM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-2xl font-bold text-emerald-600">R$ {currentMonthStats.earnings.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir {selectedUser?.role === "promotor" ? "Promotor" : "Indicador"}</DialogTitle>
            <DialogDescription>
              {selectedUser?.role === "promotor" ? (
                <>Atribua o promotor <strong>{selectedUser?.fullName}</strong> a um analista nível 3</>
              ) : (
                <>Atribua o indicador <strong>{selectedUser?.fullName}</strong> a um promotor ou analista nível 3</>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Assignment Type Selection - only for indicators */}
            {selectedUser?.role === "indicador" && (
              <div>
                <label className="text-sm font-medium">Tipo de Atribuição</label>
                <Select 
                  value={assignmentType} 
                  onValueChange={(value: "promotor" | "analista") => setAssignmentType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promotor">Atribuir a Promotor</SelectItem>
                    <SelectItem value="analista">Atribuir a Analista Nível 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Promoter Selection */}
            {assignmentType === "promotor" && (
              <div>
                <label className="text-sm font-medium">Promotor Responsável</label>
                <Select 
                  value={selectedPromoterId} 
                  onValueChange={setSelectedPromoterId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um promotor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassign">Remover atribuição</SelectItem>
                    {(promoters as any[]).map((promoter: any) => (
                      <SelectItem key={promoter.id} value={promoter.id.toString()}>
                        {promoter.fullName} ({promoter.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedPromoterId && selectedPromoterId !== "unassign" && (
                  <div className="p-3 bg-green-50 rounded-md mt-2">
                    <p className="text-sm text-green-700">
                      <strong>Promotor selecionado:</strong> {(promoters as any[]).find((p: any) => p.id.toString() === selectedPromoterId)?.fullName}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      O promotor receberá comissões pelas vendas fechadas por este indicador.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Analyst Selection - for indicators with analyst assignment or all promoters */}
            {(assignmentType === "analista" || selectedUser?.role === "promotor") && (
              <div>
                <label className="text-sm font-medium">Analista Nível 3 Responsável</label>
                <Select 
                  value={selectedAnalystId} 
                  onValueChange={setSelectedAnalystId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um analista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassign">Remover atribuição</SelectItem>
                    {analysts.map((analyst: any) => (
                      <SelectItem key={analyst.id} value={analyst.id.toString()}>
                        {analyst.fullName} ({analyst.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedAnalystId && selectedAnalystId !== "unassign" && (
                  <div className="p-3 bg-blue-50 rounded-md mt-2">
                    <p className="text-sm text-blue-700">
                      <strong>Analista selecionado:</strong> {analysts.find((a: any) => a.id.toString() === selectedAnalystId)?.fullName}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      O analista nível 3 supervisionará este indicador diretamente.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {((assignmentType === "promotor" && selectedPromoterId === "unassign") || 
              (assignmentType === "analista" && selectedAnalystId === "unassign")) && (
              <div className="p-3 bg-orange-50 rounded-md">
                <p className="text-sm text-orange-700">
                  Este indicador ficará sem atribuição.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAssignDialogOpen(false);
                setSelectedUser(null);
                setSelectedPromoterId("");
                setSelectedAnalystId("");
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleAssignIndicator}
              disabled={assignIndicatorMutation.isPending}
            >
              {assignIndicatorMutation.isPending ? "Salvando..." : "Confirmar Atribuição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}