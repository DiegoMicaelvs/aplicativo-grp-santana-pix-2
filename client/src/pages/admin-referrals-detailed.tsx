import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Search, Filter, Edit, Check, X, Clock, DollarSign, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { BackButton } from "@/components/ui/back-button";

type ReferralStatus = "pending" | "processing" | "converted" | "rejected" | "validated" | "paid";

export default function AdminReferralsDetailedPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all_statuses");
  const [userFilter, setUserFilter] = useState<string>("all_users");
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ReferralStatus>("pending");
  const [statusNotes, setStatusNotes] = useState("");

  const { toast } = useToast();

  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ["/api/admin/referrals"]
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"]
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ referralId, status, notes }: { referralId: number; status: ReferralStatus; notes: string }) => {
      const response = await fetch(`/api/referrals/${referralId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (!response.ok) throw new Error("Erro ao atualizar status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      toast({ title: "Status atualizado com sucesso!" });
      setIsDialogOpen(false);
      setStatusNotes("");
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  // Filter referrals
  const filteredReferrals = referrals.filter(referral => {
    const user = users.find(u => u.id === referral.userId);
    const matchesSearch = referral.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         referral.customerPhone?.includes(searchTerm) ||
                         referral.vehiclePlate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all_statuses" || referral.status === statusFilter;
    const matchesUser = userFilter === "all_users" || referral.userId.toString() === userFilter;
    
    return matchesSearch && matchesStatus && matchesUser;
  });

  // Calculate statistics
  const stats = {
    totalReferrals: referrals.length,
    pendingReferrals: referrals.filter(r => r.status === "pending").length,
    validatedReferrals: referrals.filter(r => r.status === "validated").length,
    totalCommissions: referrals.reduce((sum, r) => sum + (parseFloat(r.commissionIndicator) || 0) + (parseFloat(r.commissionPromoter) || 0), 0)
  };

  const getStatusBadgeColor = (status: ReferralStatus) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "processing": return "bg-blue-100 text-blue-800";
      case "converted": return "bg-purple-100 text-purple-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "validated": return "bg-green-100 text-green-800";
      case "paid": return "bg-emerald-100 text-emerald-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: ReferralStatus) => {
    switch (status) {
      case "pending": return "Pendente";
      case "processing": return "Em Análise";
      case "converted": return "Convertida";
      case "rejected": return "Rejeitada";
      case "validated": return "Validada";
      case "paid": return "Paga";
      default: return status;
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user?.fullName || "Usuário não encontrado";
  };

  const handleStatusUpdate = () => {
    if (selectedReferral && newStatus !== selectedReferral.status) {
      updateStatusMutation.mutate({
        referralId: selectedReferral.id,
        status: newStatus,
        notes: statusNotes
      });
    }
  };

  if (referralsLoading || usersLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando indicações...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Gestão Detalhada de Indicações</h1>
            <p className="text-gray-600 mt-2">Visualize, analise e gerencie todas as indicações do sistema</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingReferrals}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validadas</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.validatedReferrals}</div>
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
            Filtros Avançados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Buscar por cliente, telefone, placa ou indicador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_statuses">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Em Análise</SelectItem>
                <SelectItem value="converted">Convertida</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
                <SelectItem value="validated">Validada</SelectItem>
                <SelectItem value="paid">Paga</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full md:w-60">
                <SelectValue placeholder="Indicador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_users">Todos os Indicadores</SelectItem>
                {users.filter(u => u.role === "indicador").map(user => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista Detalhada de Indicações</CardTitle>
          <CardDescription>
            {filteredReferrals.length} de {referrals.length} indicações encontradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Indicador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comissão Indicador</TableHead>
                  <TableHead>Comissão Promotor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell className="font-medium">{referral.fullName}</TableCell>
                    <TableCell>{referral.phone}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell className="font-mono">{referral.licensePlate}</TableCell>
                    <TableCell>{getUserName(referral.userId)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(referral.status)}>
                        {getStatusLabel(referral.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600 font-semibold">
                      R$ {(parseFloat(referral.commissionIndicator) || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-blue-600 font-semibold">
                      R$ {(parseFloat(referral.commissionPromoter) || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(referral.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog open={isDialogOpen && selectedReferral?.id === referral.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (open) {
                            setSelectedReferral(referral);
                            setNewStatus(referral.status);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Editar Indicação</DialogTitle>
                              <DialogDescription>
                                Atualize o status e adicione observações sobre a indicação
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedReferral && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <strong>Cliente:</strong> {selectedReferral.fullName}
                                  </div>
                                  <div>
                                    <strong>Telefone:</strong> {selectedReferral.phone}
                                  </div>
                                  <div>
                                    <strong>Veículo:</strong> -
                                  </div>
                                  <div>
                                    <strong>Placa:</strong> {selectedReferral.licensePlate}
                                  </div>
                                  <div>
                                    <strong>Indicador:</strong> {getUserName(selectedReferral.userId)}
                                  </div>
                                  <div>
                                    <strong>Status Atual:</strong> {getStatusLabel(selectedReferral.status)}
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Novo Status:</label>
                                  <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ReferralStatus)}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pendente</SelectItem>
                                      <SelectItem value="processing">Em Análise</SelectItem>
                                      <SelectItem value="converted">Convertida</SelectItem>
                                      <SelectItem value="rejected">Rejeitada</SelectItem>
                                      <SelectItem value="validated">Validada</SelectItem>
                                      <SelectItem value="paid">Paga</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Observações:</label>
                                  <Textarea
                                    value={statusNotes}
                                    onChange={(e) => setStatusNotes(e.target.value)}
                                    placeholder="Adicione observações sobre a mudança de status..."
                                    rows={3}
                                  />
                                </div>
                                
                                {selectedReferral.notes && (
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Observações Anteriores:</label>
                                    <div className="p-2 bg-gray-50 rounded text-sm">
                                      {selectedReferral.notes}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancelar
                                  </Button>
                                  <Button onClick={handleStatusUpdate} disabled={updateStatusMutation.isPending}>
                                    {updateStatusMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredReferrals.length === 0 && (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma indicação encontrada com os filtros aplicados.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}