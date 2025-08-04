import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Search, Filter, Edit, Check, X, Clock, DollarSign, Users, TrendingUp, AlertTriangle, AlertCircle, Trash2, UserCheck, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { BackButton } from "@/components/ui/back-button";
import { useAuth } from "@/hooks/use-auth";

type ReferralStatus = "pending" | "analyzing" | "converted" | "rejected" | "validated" | "paid" | "false" | "not_validated" | "not_converted";

// Componente de validação
function ValidationDialog({ referral, onValidate }: { referral: any; onValidate: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicleBrand: referral.vehicleBrand || "",
    vehicleModel: referral.vehicleModel || "",
    vehicleYear: referral.vehicleYear || "",
    nameCorrect: referral.nameCorrect ?? true,
    plateCorrect: referral.plateCorrect ?? true,
    phoneCorrect: referral.phoneCorrect ?? true,
    validationNotes: referral.validationNotes || "",
  });
  const [showObservations, setShowObservations] = useState(false);
  const { toast } = useToast();

  // Verifica se há divergências baseado nos dados salvos ou no estado atual do form
  const hasDiscrepancies = () => {
    // Se já foi validado, usar os dados salvos
    if (referral.validatedAt) {
      return referral.nameCorrect === false || referral.plateCorrect === false || referral.phoneCorrect === false;
    }
    return false; // Se não foi validado ainda, não há divergências conhecidas
  };

  // Função para determinar a cor do botão
  const getButtonStyle = () => {
    if (!referral.validatedAt) {
      // Se não foi validado ainda, usar cor padrão (azul)
      return "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200";
    }
    
    // Se foi validado, verificar se há divergências
    if (hasDiscrepancies()) {
      return "bg-red-50 hover:bg-red-100 text-red-700 border-red-200";
    } else {
      return "bg-green-50 hover:bg-green-100 text-green-700 border-green-200";
    }
  };

  const validateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/referrals/${referral.id}/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Incluir cookies de autenticação
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao validar indicação");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Indicação validada com sucesso!" });
      setIsOpen(false);
      onValidate();
    },
    onError: () => {
      toast({ title: "Erro ao validar indicação", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    // Verificar se há divergências
    const hasDivergences = !formData.nameCorrect || !formData.plateCorrect || !formData.phoneCorrect;
    setShowObservations(hasDivergences);
    
    if (hasDivergences && !formData.validationNotes.trim()) {
      toast({ 
        title: "Observações obrigatórias", 
        description: "Adicione observações sobre as divergências encontradas",
        variant: "destructive" 
      });
      return;
    }
    
    validateMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={getButtonStyle()}>
          <Check className="h-4 w-4 mr-1" />
          Validação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Validação da Indicação</DialogTitle>
          <DialogDescription>
            Valide as informações da indicação de {referral.fullName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Informações da indicação */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Dados da Indicação</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><strong>Cliente:</strong> {referral.fullName}</div>
              <div><strong>Telefone:</strong> {referral.phone}</div>
              <div><strong>Placa:</strong> {referral.licensePlate}</div>
              <div><strong>Status:</strong> {referral.status}</div>
            </div>
          </div>

          {/* 1. Campo para marca, modelo e ano */}
          <div className="space-y-3">
            <h4 className="font-medium">1. Dados do Veículo</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Marca</label>
                <Input
                  value={formData.vehicleBrand}
                  onChange={(e) => setFormData({...formData, vehicleBrand: e.target.value})}
                  placeholder="Ex: Toyota"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Modelo</label>
                <Input
                  value={formData.vehicleModel}
                  onChange={(e) => setFormData({...formData, vehicleModel: e.target.value})}
                  placeholder="Ex: Corolla"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Ano</label>
                <Input
                  value={formData.vehicleYear}
                  onChange={(e) => setFormData({...formData, vehicleYear: e.target.value})}
                  placeholder="Ex: 2020"
                  maxLength={4}
                />
              </div>
            </div>
          </div>

          {/* 2, 3, 4. Perguntas de validação */}
          <div className="space-y-3">
            <h4 className="font-medium">2. Validação dos Dados</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded">
                <span>O nome está correto?</span>
                <div className="flex gap-2">
                  <Button
                    variant={formData.nameCorrect ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, nameCorrect: true})}
                  >
                    Sim
                  </Button>
                  <Button
                    variant={!formData.nameCorrect ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, nameCorrect: false})}
                  >
                    Não
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded">
                <span>A placa do carro está correta?</span>
                <div className="flex gap-2">
                  <Button
                    variant={formData.plateCorrect ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, plateCorrect: true})}
                  >
                    Sim
                  </Button>
                  <Button
                    variant={!formData.plateCorrect ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, plateCorrect: false})}
                  >
                    Não
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded">
                <span>O número do celular está correto?</span>
                <div className="flex gap-2">
                  <Button
                    variant={formData.phoneCorrect ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, phoneCorrect: true})}
                  >
                    Sim
                  </Button>
                  <Button
                    variant={!formData.phoneCorrect ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, phoneCorrect: false})}
                  >
                    Não
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Campo de observações - aparece se houver divergências */}
          {(!formData.nameCorrect || !formData.plateCorrect || !formData.phoneCorrect || showObservations) && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-red-600">
                Observações sobre divergências *
              </label>
              <Textarea
                value={formData.validationNotes}
                onChange={(e) => setFormData({...formData, validationNotes: e.target.value})}
                placeholder="Descreva as divergências encontradas..."
                rows={3}
                className="border-red-200"
              />
            </div>
          )}

          {/* Observações opcionais */}
          {formData.nameCorrect && formData.plateCorrect && formData.phoneCorrect && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea
                value={formData.validationNotes}
                onChange={(e) => setFormData({...formData, validationNotes: e.target.value})}
                placeholder="Adicione observações adicionais se necessário..."
                rows={2}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={validateMutation.isPending || !formData.vehicleBrand || !formData.vehicleModel || !formData.vehicleYear}
            >
              {validateMutation.isPending ? "Validando..." : "Validar Indicação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminReferralsDetailedPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all_statuses");
  const [userFilter, setUserFilter] = useState<string>("all_users");
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ReferralStatus>("pending");
  const [statusNotes, setStatusNotes] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    phone: "",
    licensePlate: "",
    companyId: 0,
    userId: 0,
    commissionIndicator: "0",
    commissionPromoter: "0"
  });

  const { toast } = useToast();
  const { user } = useAuth();

  const { data: referrals = [], isLoading: referralsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/referrals"]
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"]
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"]
  });

  const { data: indicadores = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/indicadores"]
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ referralId, status, notes }: { referralId: number; status: ReferralStatus; notes: string }) => {
      console.log(`[updateStatusMutation] Iniciando atualização: referralId=${referralId}, status=${status}`);
      
      const response = await fetch(`/api/referrals/${referralId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Incluir cookies de autenticação
        body: JSON.stringify({ status, notes }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.details || errorData.error || "Erro ao atualizar status";
        console.error(`[updateStatusMutation] Erro na resposta:`, errorData);
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log(`[updateStatusMutation] Resposta bem-sucedida:`, result);
      return result;
    },
    onSuccess: (data) => {
      console.log(`[updateStatusMutation] onSuccess - dados recebidos:`, data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Status atualizado com sucesso!" });
      setIsDialogOpen(false);
      setStatusNotes("");
      setSelectedReferral(null);
    },
    onError: (error: any) => {
      console.error("[updateStatusMutation] onError - Erro ao atualizar status:", error);
      const errorMessage = error?.message || "Erro ao atualizar status";
      toast({ 
        title: "Erro ao atualizar status", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  const updateReferralMutation = useMutation({
    mutationFn: async ({ referralId, data }: { referralId: number; data: any }) => {
      const response = await fetch(`/api/referrals/${referralId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Incluir cookies de autenticação
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao atualizar indicação");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      toast({ title: "Indicação atualizada com sucesso!" });
      setIsDialogOpen(false);
      setSelectedReferral(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar indicação", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const deleteReferralMutation = useMutation({
    mutationFn: async (referralId: number) => {
      const response = await fetch(`/api/referrals/${referralId}`, {
        method: "DELETE",
        credentials: "include", // Incluir cookies de autenticação
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao deletar indicação");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      toast({ title: "Indicação deletada com sucesso!" });
      setIsDialogOpen(false);
      setIsDeleteDialogOpen(false);
      setSelectedReferral(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao deletar indicação", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  // Filter referrals
  const filteredReferrals = referrals.filter((referral: any) => {
    const user = users.find((u: any) => u.id === referral.userId);
    const matchesSearch = referral.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         referral.phone?.includes(searchTerm) ||
                         referral.licensePlate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all_statuses" || referral.status === statusFilter;
    const matchesUser = userFilter === "all_users" || referral.userId.toString() === userFilter;
    
    return matchesSearch && matchesStatus && matchesUser;
  });

  // Helper function to get company name by ID
  const getCompanyName = (companyId: number) => {
    const company = companies.find((c: any) => c.id === companyId);
    return company?.name || "N/A";
  };

  // Export to Excel function
  const handleExportExcel = async () => {
    try {
      const response = await fetch('/api/admin/export/referrals', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erro ao exportar dados');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indicacoes_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ 
        title: "Exportação concluída!",
        description: "O arquivo Excel foi baixado com sucesso."
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ 
        title: "Erro ao exportar",
        description: "Não foi possível exportar os dados para Excel.",
        variant: "destructive"
      });
    }
  };

  // Calculate statistics
  const stats = {
    totalReferrals: referrals.length,
    pendingReferrals: referrals.filter((r: any) => r.status === "pending").length,
    validatedReferrals: referrals.filter((r: any) => r.status === "validated").length,
    totalCommissions: referrals.reduce((sum: number, r: any) => sum + (parseFloat(r.commissionIndicator) || 0) + (parseFloat(r.commissionPromoter) || 0), 0)
  };

  const getStatusBadgeColor = (status: ReferralStatus) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "analyzing": return "bg-blue-100 text-blue-800";
      case "converted": return "bg-purple-100 text-purple-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "validated": return "bg-green-100 text-green-800";
      case "paid": return "bg-emerald-100 text-emerald-800";
      case "false": return "bg-gray-900 text-white";
      case "not_validated": return "bg-orange-100 text-orange-800";
      case "not_converted": return "bg-indigo-100 text-indigo-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: ReferralStatus) => {
    switch (status) {
      case "pending": return "Pendente";
      case "analyzing": return "Em Análise";
      case "converted": return "Convertida";
      case "rejected": return "Rejeitada";
      case "validated": return "Validada";
      case "paid": return "Paga";
      case "false": return "Falso";
      case "not_validated": return "Não validado";
      case "not_converted": return "Não convertido";
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
    <div className="w-full px-4 md:px-6 py-6 max-w-[100vw] overflow-hidden">
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
                <SelectItem value="analyzing">Em Análise</SelectItem>
                <SelectItem value="converted">Convertida</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
                <SelectItem value="validated">Validada</SelectItem>
                <SelectItem value="paid">Paga</SelectItem>
                <SelectItem value="false">Falso</SelectItem>
                <SelectItem value="not_validated">Não validado</SelectItem>
                <SelectItem value="not_converted">Não convertido</SelectItem>
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
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Lista Detalhada de Indicações</CardTitle>
              <CardDescription>
                {filteredReferrals.length} de {referrals.length} indicações encontradas
              </CardDescription>
            </div>
            <Button 
              onClick={handleExportExcel}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {/* Mobile View - Cards */}
          <div className="block md:hidden">
            {filteredReferrals.map((referral) => (
              <div key={referral.id} className="border-b p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{referral.fullName}</p>
                    <p className="text-sm text-gray-600">{referral.phone}</p>
                  </div>
                  <Badge className={getStatusBadgeColor(referral.status)}>
                    {getStatusLabel(referral.status)}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Placa:</span> 
                    <span className="font-mono ml-1">{referral.licensePlate}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Local:</span> 
                    {referral.city && referral.state ? (
                      <span className="ml-1">{referral.city}/{referral.state}</span>
                    ) : (
                      <span className="text-gray-400 ml-1">-</span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Seguradora:</span> 
                    <span className="ml-1">{getCompanyName(referral.companyId)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Indicador:</span>
                    <span className="ml-1">{getUserName(referral.createdBy)}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Data:</span>
                    <span className="ml-1">{format(new Date(referral.createdAt), "dd/MM/yy", { locale: ptBR })}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="text-sm">
                    <span className="text-green-600 font-semibold">
                      Ind: R$ {(parseFloat(referral.commissionIndicator) || 0).toFixed(2)}
                    </span>
                    {parseFloat(referral.commissionPromoter || '0') > 0 && (
                      <span className="text-blue-600 font-semibold ml-2">
                        Prom: R$ {parseFloat(referral.commissionPromoter).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(user?.role === 'analista' || user?.role === 'admin') && (
                      <ValidationDialog referral={referral} onValidate={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
                      }} />
                    )}
                    <Dialog open={isDialogOpen && selectedReferral?.id === referral.id} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (open) {
                        setSelectedReferral(referral);
                        setNewStatus(referral.status);
                        setEditFormData({
                          fullName: referral.fullName,
                          phone: referral.phone,
                          licensePlate: referral.licensePlate,
                          companyId: referral.companyId || 1,
                          userId: referral.userId,
                          commissionIndicator: referral.commissionIndicator || "0",
                          commissionPromoter: referral.commissionPromoter || "0"
                        });
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Editar Indicação</DialogTitle>
                          <DialogDescription>
                            Atualize os dados da indicação, altere o status ou delete o registro
                          </DialogDescription>
                        </DialogHeader>
                        
                        {selectedReferral && (
                          <div className="space-y-6">
                            {/* Seção 1: Editar Dados */}
                            <div className="space-y-4 border rounded-lg p-4">
                              <h3 className="font-semibold flex items-center gap-2">
                                <Edit className="h-4 w-4" />
                                Editar Dados da Indicação
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Nome Completo</label>
                                  <Input
                                    value={editFormData.fullName}
                                    onChange={(e) => setEditFormData({...editFormData, fullName: e.target.value})}
                                    placeholder="Nome completo do cliente"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Telefone</label>
                                  <Input
                                    value={editFormData.phone}
                                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                                    placeholder="(00) 00000-0000"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Placa do Veículo</label>
                                  <Input
                                    value={editFormData.licensePlate}
                                    onChange={(e) => setEditFormData({...editFormData, licensePlate: e.target.value})}
                                    placeholder="ABC-0000"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Seguradora</label>
                                  <Select 
                                    value={editFormData.companyId.toString()} 
                                    onValueChange={(value) => setEditFormData({...editFormData, companyId: parseInt(value)})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {companies.map((company) => (
                                        <SelectItem key={company.id} value={company.id.toString()}>
                                          {company.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-green-600" />
                                    Comissão Indicador (R$)
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.commissionIndicator}
                                    onChange={(e) => setEditFormData({...editFormData, commissionIndicator: e.target.value})}
                                    placeholder="0.00"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-blue-600" />
                                    Comissão Promotor (R$)
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.commissionPromoter}
                                    onChange={(e) => setEditFormData({...editFormData, commissionPromoter: e.target.value})}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                  <UserCheck className="h-4 w-4" />
                                  Atribuir a outro Indicador
                                </label>
                                <Select 
                                  value={editFormData.userId.toString()} 
                                  onValueChange={(value) => setEditFormData({...editFormData, userId: parseInt(value)})}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {indicadores.map((indicador) => (
                                      <SelectItem key={indicador.id} value={indicador.id.toString()}>
                                        {indicador.fullName} ({indicador.username})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <Button 
                                onClick={() => {
                                  updateReferralMutation.mutate({
                                    referralId: selectedReferral.id,
                                    data: editFormData
                                  });
                                }}
                                disabled={updateReferralMutation.isPending}
                                className="w-full"
                              >
                                {updateReferralMutation.isPending ? "Salvando..." : "Salvar Dados"}
                              </Button>
                            </div>
                            
                            {/* Seção 2: Alterar Status */}
                            <div className="space-y-4 border rounded-lg p-4">
                              <h3 className="font-semibold">Alterar Status</h3>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Status</label>
                                <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ReferralStatus)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="analyzing">Em Análise</SelectItem>
                                    <SelectItem value="converted">Convertida</SelectItem>
                                    <SelectItem value="rejected">Rejeitada</SelectItem>
                                    <SelectItem value="validated">Validada</SelectItem>
                                    <SelectItem value="paid">Paga</SelectItem>
                                    <SelectItem value="false">Falso</SelectItem>
                                    <SelectItem value="not_validated">Não validado</SelectItem>
                                    <SelectItem value="not_converted">Não convertido</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Observações</label>
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
                            
                            {/* Commission change warning */}
                            {selectedReferral && newStatus !== selectedReferral.status && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-start">
                                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                                  <div>
                                    <h4 className="text-sm font-medium text-blue-800">
                                      💰 Alteração de Comissões
                                    </h4>
                                    <div className="text-sm text-blue-700 mt-1">
                                      {(() => {
                                        try {
                                          const currentIndicator = parseFloat(selectedReferral.commissionIndicator || '0');
                                          const currentPromoter = parseFloat(selectedReferral.commissionPromoter || '0');
                                          
                                          // Calculate new commissions based on status
                                          let newIndicator = 0;
                                          let newPromoter = 0;
                                          
                                          if (newStatus === 'validated') {
                                            newIndicator = 3;
                                            newPromoter = 1;
                                          } else if (newStatus === 'converted') {
                                            if (selectedReferral.status === 'validated') {
                                              newIndicator = currentIndicator + 50; // Sum to existing
                                              newPromoter = currentPromoter + 10;
                                            } else {
                                              newIndicator = 50;
                                              newPromoter = 10;
                                            }
                                          } else if (newStatus === 'paid') {
                                            newIndicator = currentIndicator; // Keep current
                                            newPromoter = currentPromoter;
                                          }
                                          // Para outros status (pending, rejected, analyzing, false, not_validated, not_converted), as comissões são zero
                                          
                                          const diffIndicator = newIndicator - currentIndicator;
                                          const diffPromoter = newPromoter - currentPromoter;
                                          
                                          return (
                                          <>
                                            <p>Esta mudança de status irá alterar as comissões:</p>
                                            <ul className="mt-2 space-y-1">
                                              <li>• Indicador: R$ {currentIndicator.toFixed(2)} → R$ {newIndicator.toFixed(2)} 
                                                <span className={`font-medium ${diffIndicator > 0 ? 'text-green-700' : diffIndicator < 0 ? 'text-red-700' : ''}`}>
                                                  {diffIndicator !== 0 && ` (${diffIndicator > 0 ? '+' : ''}R$ ${diffIndicator.toFixed(2)})`}
                                                </span>
                                              </li>
                                              {currentPromoter > 0 || newPromoter > 0 ? (
                                                <li>• Promotor: R$ {currentPromoter.toFixed(2)} → R$ {newPromoter.toFixed(2)}
                                                  <span className={`font-medium ${diffPromoter > 0 ? 'text-green-700' : diffPromoter < 0 ? 'text-red-700' : ''}`}>
                                                    {diffPromoter !== 0 && ` (${diffPromoter > 0 ? '+' : ''}R$ ${diffPromoter.toFixed(2)})`}
                                                  </span>
                                                </li>
                                              ) : null}
                                            </ul>
                                            {selectedReferral.status === 'validated' && newStatus === 'converted' && (
                                              <p className="mt-2 text-green-700 font-medium">
                                                ✅ Comissões serão somadas (validação + conversão)
                                              </p>
                                            )}
                                          </>
                                        );
                                        } catch (error) {
                                          console.error('[Commission Calculation Error]:', error);
                                          return <p className="text-red-600">Erro ao calcular comissões</p>;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                              
                              <Button 
                                onClick={handleStatusUpdate} 
                                disabled={updateStatusMutation.isPending}
                                className="w-full"
                              >
                                {updateStatusMutation.isPending ? "Atualizando..." : "Atualizar Status"}
                              </Button>
                            </div>
                            
                            {/* Seção 3: Deletar */}
                            <div className="space-y-4 border border-red-200 rounded-lg p-4 bg-red-50">
                              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                                <Trash2 className="h-4 w-4" />
                                Zona de Perigo
                              </h3>
                              <p className="text-sm text-red-600">
                                Esta ação é irreversível. A indicação será permanentemente removida do sistema.
                              </p>
                              
                              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button variant="destructive" className="w-full">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Deletar Indicação
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Confirmar Exclusão</DialogTitle>
                                    <DialogDescription>
                                      Tem certeza que deseja deletar esta indicação? Esta ação não pode ser desfeita.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="bg-red-50 p-3 rounded-lg">
                                      <p className="text-sm">
                                        <strong>Cliente:</strong> {selectedReferral.fullName}<br />
                                        <strong>Placa:</strong> {selectedReferral.licensePlate}<br />
                                        <strong>Status:</strong> {getStatusLabel(selectedReferral.status)}
                                      </p>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button 
                                        variant="outline" 
                                        onClick={() => setIsDeleteDialogOpen(false)}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button 
                                        variant="destructive" 
                                        onClick={() => {
                                          deleteReferralMutation.mutate(selectedReferral.id);
                                          setIsDeleteDialogOpen(false);
                                        }}
                                        disabled={deleteReferralMutation.isPending}
                                      >
                                        {deleteReferralMutation.isPending ? "Deletando..." : "Deletar Indicação"}
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop View - Table */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-full">
              <Table className="w-full text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Cliente</TableHead>
                  <TableHead className="min-w-[110px]">Telefone</TableHead>
                  <TableHead className="min-w-[80px]">Placa</TableHead>
                  <TableHead className="min-w-[120px]">Seguradora</TableHead>
                  <TableHead className="min-w-[90px]">Local</TableHead>
                  <TableHead className="min-w-[110px]">Indicador</TableHead>
                  <TableHead className="min-w-[90px]">Status</TableHead>
                  <TableHead className="min-w-[100px]">Comissões</TableHead>
                  <TableHead className="min-w-[70px]">Data</TableHead>
                  <TableHead className="min-w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell className="font-medium text-sm">
                      <div className="truncate max-w-[150px]" title={referral.fullName}>
                        {referral.fullName}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{referral.phone}</TableCell>
                    <TableCell className="font-mono text-xs">{referral.licensePlate}</TableCell>
                    <TableCell className="text-xs">
                      <div className="truncate max-w-[120px]" title={getCompanyName(referral.companyId)}>
                        {getCompanyName(referral.companyId)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {referral.city && referral.state ? (
                        <span title={`${referral.city}/${referral.state}`}>
                          {referral.state}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="truncate max-w-[110px]" title={getUserName(referral.createdBy)}>
                        {getUserName(referral.createdBy).split(' ')[0]}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusBadgeColor(referral.status)} text-xs`}>
                        {getStatusLabel(referral.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>
                        <span className="text-green-600 font-semibold">
                          I: {(parseFloat(referral.commissionIndicator) || 0).toFixed(0)}
                        </span>
                        {parseFloat(referral.commissionPromoter || '0') > 0 && (
                          <span className="text-blue-600 font-semibold block">
                            P: {parseFloat(referral.commissionPromoter).toFixed(0)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(referral.createdAt), "dd/MM", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {/* Botão de Validação - apenas para analistas e admin */}
                        {(user?.role === 'analista' || user?.role === 'admin') && (
                          <ValidationDialog referral={referral} onValidate={() => {
                            // Recarregar dados após validação
                            queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
                          }} />
                        )}
                        
                        <Dialog open={isDialogOpen && selectedReferral?.id === referral.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (open) {
                            setSelectedReferral(referral);
                            setNewStatus(referral.status);
                            setEditFormData({
                              fullName: referral.fullName,
                              phone: referral.phone,
                              licensePlate: referral.licensePlate,
                              companyId: referral.companyId || 1,
                              userId: referral.userId,
                              commissionIndicator: referral.commissionIndicator || "0",
                              commissionPromoter: referral.commissionPromoter || "0"
                            });
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Editar Indicação</DialogTitle>
                              <DialogDescription>
                                Atualize os dados da indicação, altere o status ou delete o registro
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedReferral && (
                              <div className="space-y-6">
                                {/* Seção 1: Editar Dados */}
                                <div className="space-y-4 border rounded-lg p-4">
                                  <h3 className="font-semibold flex items-center gap-2">
                                    <Edit className="h-4 w-4" />
                                    Editar Dados da Indicação
                                  </h3>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Nome Completo</label>
                                      <Input
                                        value={editFormData.fullName}
                                        onChange={(e) => setEditFormData({...editFormData, fullName: e.target.value})}
                                        placeholder="Nome completo do cliente"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Telefone</label>
                                      <Input
                                        value={editFormData.phone}
                                        onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                                        placeholder="(00) 00000-0000"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Placa do Veículo</label>
                                      <Input
                                        value={editFormData.licensePlate}
                                        onChange={(e) => setEditFormData({...editFormData, licensePlate: e.target.value})}
                                        placeholder="ABC-0000"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Seguradora</label>
                                      <Select 
                                        value={editFormData.companyId.toString()} 
                                        onValueChange={(value) => setEditFormData({...editFormData, companyId: parseInt(value)})}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {companies.map((company) => (
                                            <SelectItem key={company.id} value={company.id.toString()}>
                                              {company.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-green-600" />
                                        Comissão Indicador (R$)
                                      </label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.commissionIndicator}
                                        onChange={(e) => setEditFormData({...editFormData, commissionIndicator: e.target.value})}
                                        placeholder="0.00"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-blue-600" />
                                        Comissão Promotor (R$)
                                      </label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.commissionPromoter}
                                        onChange={(e) => setEditFormData({...editFormData, commissionPromoter: e.target.value})}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                      <UserCheck className="h-4 w-4" />
                                      Atribuir a outro Indicador
                                    </label>
                                    <Select 
                                      value={editFormData.userId.toString()} 
                                      onValueChange={(value) => setEditFormData({...editFormData, userId: parseInt(value)})}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {indicadores.map((indicador) => (
                                          <SelectItem key={indicador.id} value={indicador.id.toString()}>
                                            {indicador.fullName} ({indicador.username})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <Button 
                                    onClick={() => {
                                      updateReferralMutation.mutate({
                                        referralId: selectedReferral.id,
                                        data: editFormData
                                      });
                                    }}
                                    disabled={updateReferralMutation.isPending}
                                    className="w-full"
                                  >
                                    {updateReferralMutation.isPending ? "Salvando..." : "Salvar Dados"}
                                  </Button>
                                </div>
                                
                                {/* Seção 2: Alterar Status */}
                                <div className="space-y-4 border rounded-lg p-4">
                                  <h3 className="font-semibold">Alterar Status</h3>
                                  
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Status</label>
                                    <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ReferralStatus)}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="analyzing">Em Análise</SelectItem>
                                        <SelectItem value="converted">Convertida</SelectItem>
                                        <SelectItem value="rejected">Rejeitada</SelectItem>
                                        <SelectItem value="validated">Validada</SelectItem>
                                        <SelectItem value="paid">Paga</SelectItem>
                                        <SelectItem value="false">Falso</SelectItem>
                                        <SelectItem value="not_validated">Não validado</SelectItem>
                                        <SelectItem value="not_converted">Não convertido</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Observações</label>
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
                                
                                {/* Commission change warning */}
                                {selectedReferral && newStatus !== selectedReferral.status && (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex items-start">
                                      <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                                      <div>
                                        <h4 className="text-sm font-medium text-blue-800">
                                          💰 Alteração de Comissões
                                        </h4>
                                        <div className="text-sm text-blue-700 mt-1">
                                          {(() => {
                                            try {
                                              const currentIndicator = parseFloat(selectedReferral.commissionIndicator || '0');
                                              const currentPromoter = parseFloat(selectedReferral.commissionPromoter || '0');
                                              
                                              // Calculate new commissions based on status
                                              let newIndicator = 0;
                                              let newPromoter = 0;
                                              
                                              if (newStatus === 'validated') {
                                                newIndicator = 3;
                                                newPromoter = 1;
                                              } else if (newStatus === 'converted') {
                                                if (selectedReferral.status === 'validated') {
                                                  newIndicator = currentIndicator + 50; // Sum to existing
                                                  newPromoter = currentPromoter + 10;
                                                } else {
                                                  newIndicator = 50;
                                                  newPromoter = 10;
                                                }
                                              } else if (newStatus === 'paid') {
                                                newIndicator = currentIndicator; // Keep current
                                                newPromoter = currentPromoter;
                                              }
                                              // Para outros status (pending, rejected, analyzing, false, not_validated, not_converted), as comissões são zero
                                              
                                              const diffIndicator = newIndicator - currentIndicator;
                                              const diffPromoter = newPromoter - currentPromoter;
                                              
                                              return (
                                              <>
                                                <p>Esta mudança de status irá alterar as comissões:</p>
                                                <ul className="mt-2 space-y-1">
                                                  <li>• Indicador: R$ {currentIndicator.toFixed(2)} → R$ {newIndicator.toFixed(2)} 
                                                    <span className={`font-medium ${diffIndicator > 0 ? 'text-green-700' : diffIndicator < 0 ? 'text-red-700' : ''}`}>
                                                      {diffIndicator !== 0 && ` (${diffIndicator > 0 ? '+' : ''}R$ ${diffIndicator.toFixed(2)})`}
                                                    </span>
                                                  </li>
                                                  {currentPromoter > 0 || newPromoter > 0 ? (
                                                    <li>• Promotor: R$ {currentPromoter.toFixed(2)} → R$ {newPromoter.toFixed(2)}
                                                      <span className={`font-medium ${diffPromoter > 0 ? 'text-green-700' : diffPromoter < 0 ? 'text-red-700' : ''}`}>
                                                        {diffPromoter !== 0 && ` (${diffPromoter > 0 ? '+' : ''}R$ ${diffPromoter.toFixed(2)})`}
                                                      </span>
                                                    </li>
                                                  ) : null}
                                                </ul>
                                                {selectedReferral.status === 'validated' && newStatus === 'converted' && (
                                                  <p className="mt-2 text-green-700 font-medium">
                                                    ✅ Comissões serão somadas (validação + conversão)
                                                  </p>
                                                )}
                                              </>
                                            );
                                            } catch (error) {
                                              console.error('[Commission Calculation Error]:', error);
                                              return <p className="text-red-600">Erro ao calcular comissões</p>;
                                            }
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                  
                                  <Button 
                                    onClick={handleStatusUpdate} 
                                    disabled={updateStatusMutation.isPending}
                                    className="w-full"
                                  >
                                    {updateStatusMutation.isPending ? "Atualizando..." : "Atualizar Status"}
                                  </Button>
                                </div>
                                
                                {/* Seção 3: Deletar */}
                                <div className="space-y-4 border border-red-200 rounded-lg p-4 bg-red-50">
                                  <h3 className="font-semibold text-red-700 flex items-center gap-2">
                                    <Trash2 className="h-4 w-4" />
                                    Zona de Perigo
                                  </h3>
                                  <p className="text-sm text-red-600">
                                    Esta ação é irreversível. A indicação será permanentemente removida do sistema.
                                  </p>
                                  
                                  <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                    <DialogTrigger asChild>
                                      <Button variant="destructive" className="w-full">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Deletar Indicação
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                                      <DialogHeader>
                                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                                        <DialogDescription>
                                          Tem certeza que deseja deletar esta indicação? Esta ação não pode ser desfeita.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="bg-red-50 p-3 rounded-lg">
                                          <p className="text-sm">
                                            <strong>Cliente:</strong> {selectedReferral.fullName}<br />
                                            <strong>Telefone:</strong> {selectedReferral.phone}<br />
                                            <strong>Placa:</strong> {selectedReferral.licensePlate}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                                          Cancelar
                                        </Button>
                                        <Button 
                                          variant="destructive" 
                                          onClick={() => deleteReferralMutation.mutate(selectedReferral.id)}
                                          disabled={deleteReferralMutation.isPending}
                                        >
                                          {deleteReferralMutation.isPending ? "Deletando..." : "Sim, Deletar"}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
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
            </div>
            
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