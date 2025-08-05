import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, Search, Filter, Users, DollarSign, TrendingUp, UserPlus } from "lucide-react";
import { format } from "date-fns";
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

  // Filter indicators based on search and filters
  const filteredIndicators = (users as any[]).filter((user: any) => {
    const matchesSearch = user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.cpf?.includes(searchTerm);
    const matchesRole = roleFilter === "all_roles" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all_statuses" || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    totalIndicators: (users as any[]).filter((u: any) => u.role === "indicador").length,
    activeIndicators: (users as any[]).filter((u: any) => u.role === "indicador" && u.status === "active").length,
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

  // Get analyst assignment for promoters
  const getAnalystAssignment = (userId: number) => {
    const user = (users as any[]).find((u: any) => u.id === userId);
    if (user?.role !== "promotor") return null;
    
    // Check if promoter has a supervisorId
    if (!user.supervisorId) return null;
    
    // Find the analyst with that ID
    const analyst = (users as any[]).find((u: any) => 
      u.id === user.supervisorId && u.role === "analista" && u.analystLevel === 3
    );
    
    return analyst ? analyst.fullName : null;
  };

  // Assignment mutation
  const assignIndicatorMutation = useMutation({
    mutationFn: async ({ userId, promoterId }: { userId: number; promoterId: number | null }) => {
      const response = await fetch(`/api/admin/users/${userId}/assign-promoter`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ promoterId })
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atribuir promotor');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Sucesso",
        description: "Indicador atribuído com sucesso!"
      });
      setIsAssignDialogOpen(false);
      setSelectedUser(null);
      setSelectedPromoterId("");
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
    
    const promoterId = selectedPromoterId === "unassign" ? null : parseInt(selectedPromoterId);
    assignIndicatorMutation.mutate({ 
      userId: selectedUser.id, 
      promoterId 
    });
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atribuição</TableHead>
                  <TableHead>Cadastrado por</TableHead>
                  <TableHead>Indicações</TableHead>
                  <TableHead>Ganhos Totais</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIndicators.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.cpf}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(user.status || "active")}>
                        {user.status || "active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.role === "indicador" ? (
                          <div className="flex items-center gap-2">
                            <span className={user.promoterId ? "text-green-600 font-medium" : "text-gray-500"}>
                              {getPromoterName(user.promoterId)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setSelectedPromoterId(user.promoterId?.toString() || "");
                                setIsAssignDialogOpen(true);
                              }}
                            >
                              <UserPlus className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : user.role === "promotor" ? (
                          <div>
                            {getAnalystAssignment(user.id) ? (
                              <span className="text-blue-600 font-medium">
                                Analista: {getAnalystAssignment(user.id)}
                              </span>
                            ) : (
                              <span className="text-gray-500">Sem atribuição</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getRegisteredBy(user.id)}</TableCell>
                    <TableCell className="text-center">{getReferralsCount(user.id)}</TableCell>
                    <TableCell className="text-green-600 font-semibold">
                      R$ {getTotalEarnings(user.id).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {user.createdAt ? format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`/admin/user-details/${user.id}`, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredIndicators.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum indicador encontrado com os filtros aplicados.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Indicador a Promotor</DialogTitle>
            <DialogDescription>
              Selecione um promotor para gerenciar este indicador: <strong>{selectedUser?.fullName}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
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
            </div>
            
            {selectedPromoterId && selectedPromoterId !== "unassign" && (
              <div className="p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Promotor selecionado:</strong> {(promoters as any[]).find((p: any) => p.id.toString() === selectedPromoterId)?.fullName}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  O promotor receberá comissões pelas vendas fechadas por este indicador.
                </p>
              </div>
            )}
            
            {selectedPromoterId === "unassign" && (
              <div className="p-3 bg-orange-50 rounded-md">
                <p className="text-sm text-orange-700">
                  Este indicador ficará sem promotor responsável.
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