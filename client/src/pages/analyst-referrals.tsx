import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Edit, CheckCircle, XCircle, Info, Clock, DollarSign, AlertCircle, Shield, RefreshCw } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Referral, User, Company, AnalystPermission } from "@shared/schema";
import { validateReferralSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

type ValidateFormValues = z.infer<typeof validateReferralSchema>;

const editSchema = z.object({
  fullName: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  licensePlate: z.string().min(1, "Placa é obrigatória"),
  hasInsurance: z.boolean(),
  notes: z.string().optional(),
  status: z.enum(["pending", "analyzing", "validated", "converted", "rejected", "paid", "false", "not_validated", "not_converted"]),
});

type EditFormValues = z.infer<typeof editSchema>;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  analyzing: "bg-blue-100 text-blue-800",
  converted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  validated: "bg-purple-100 text-purple-800",
  paid: "bg-emerald-100 text-emerald-800",
  false: "bg-orange-100 text-orange-800",
  not_validated: "bg-gray-100 text-gray-800",
  not_converted: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Em Processamento",
  analyzing: "Em Análise",
  converted: "Convertido",
  rejected: "Rejeitado",
  validated: "Validado",
  paid: "Pago",
  false: "Falso",
  not_validated: "Não Validado",
  not_converted: "Não Convertido",
};

export default function AnalystReferrals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [isValidateDialogOpen, setIsValidateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch referrals with automatic refresh for real-time updates
  const { data: referrals = [], isLoading, refetch: refetchReferrals, isFetching } = useQuery<Referral[]>({
    queryKey: ["/api/analyst/referrals"],
    refetchInterval: 15000, // Atualizar a cada 15 segundos para mudanças mais rápidas
    refetchIntervalInBackground: true, // Atualizar mesmo quando a aba não está ativa
    staleTime: 5000, // Dados são considerados obsoletos após 5 segundos
    refetchOnWindowFocus: true, // Refetch quando a janela ganha foco
    refetchOnMount: true, // Sempre refetch ao montar
  });

  // Fetch users for display - use analyst endpoint for proper permissions
  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/analyst/users"],
    refetchInterval: 30000, // Atualizar usuários a cada 30 segundos
    staleTime: 15000, // Dados de usuários podem mudar com reatribuições
    refetchOnWindowFocus: true, // Refetch quando a janela ganha foco
  });

  // Função para refresh manual
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchReferrals(),
        refetchUsers()
      ]);
      toast({ 
        title: "Dados atualizados", 
        description: "Lista de indicações foi atualizada com sucesso!" 
      });
    } catch (error) {
      toast({ 
        title: "Erro ao atualizar", 
        description: "Não foi possível atualizar os dados",
        variant: "destructive" 
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch companies for display
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const form = useForm<ValidateFormValues>({
    resolver: zodResolver(validateReferralSchema),
    defaultValues: {
      vehicleBrand: "Não informado",
      vehicleModel: "Não informado",
      vehicleYear: "2020",
      nameCorrect: true,
      plateCorrect: true,
      phoneCorrect: true,
      validationNotes: "",
    },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      licensePlate: "",
      hasInsurance: false,
      notes: "",
      status: "pending",
    },
  });

  // Validate referral mutation
  const validateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ValidateFormValues }) => {
      const response = await fetch(`/api/referrals/${id}/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao validar indicação");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas para garantir sincronização entre analistas
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      // Forçar refetch imediato
      queryClient.refetchQueries({ queryKey: ["/api/analyst/referrals"] });
      toast({ title: "Sucesso", description: "Indicação validada com sucesso!" });
      setIsValidateDialogOpen(false);
      setSelectedReferral(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Edit referral mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EditFormValues }) => {
      const response = await fetch(`/api/referrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao editar indicação");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas para garantir sincronização entre analistas
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      // Forçar refetch imediato
      queryClient.refetchQueries({ queryKey: ["/api/analyst/referrals"] });
      toast({ title: "Sucesso", description: "Indicação editada com sucesso!" });
      setIsEditDialogOpen(false);
      setSelectedReferral(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Check permissions - All analysts can edit referral status
  const canEdit = user?.role === "analista" || 
    (user?.permissions as AnalystPermission[])?.includes("edit_referral_status") || 
    user?.role === "admin";

  // Filter referrals
  const filteredReferrals = referrals.filter((referral) => {
    const user = users.find((u) => u.id === referral.userId);
    const matchesSearch =
      referral.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.phone?.includes(searchTerm) ||
      referral.licensePlate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || referral.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleValidateClick = (referral: Referral) => {
    setSelectedReferral(referral);
    form.reset({
      vehicleBrand: referral.vehicleBrand || "Não informado",
      vehicleModel: referral.vehicleModel || "Não informado", 
      vehicleYear: referral.vehicleYear || "2020",
      nameCorrect: referral.nameCorrect ?? true,
      plateCorrect: referral.plateCorrect ?? true,
      phoneCorrect: referral.phoneCorrect ?? true,
      validationNotes: "",
    });
    setIsValidateDialogOpen(true);
  };

  const handleEditClick = (referral: Referral) => {
    setSelectedReferral(referral);
    editForm.reset({
      fullName: referral.fullName,
      phone: referral.phone,
      licensePlate: referral.licensePlate,
      hasInsurance: referral.hasInsurance || false,
      notes: referral.notes || "",
      status: referral.status,
    });
    setIsEditDialogOpen(true);
  };

  const onSubmit = (data: ValidateFormValues) => {
    if (selectedReferral) {
      validateMutation.mutate({ id: selectedReferral.id, data });
    }
  };

  const onEditSubmit = (data: EditFormValues) => {
    if (selectedReferral) {
      editMutation.mutate({ id: selectedReferral.id, data });
    }
  };

  if (!user || (user.role !== "analista" && user.role !== "admin")) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Restrito</h2>
              <p className="text-gray-500">Esta página é exclusiva para analistas.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role === "analista" && !(user.permissions as AnalystPermission[])?.includes("view_referrals")) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Sem Permissão</h2>
              <p className="text-gray-500">
                Você não tem permissão para visualizar indicações. Entre em contato com um administrador.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 px-4 sm:px-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Indicações para Análise</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Visualize e valide as indicações cadastradas</p>
          {user?.analystLevel === 3 && (
            <Badge className="mt-2 bg-purple-100 text-purple-800">
              <Shield className="h-3 w-3 mr-1" />
              Mostrando apenas indicações dos usuários supervisionados
            </Badge>
          )}
          {(isFetching || isRefreshing) && (
            <Badge className="mt-2 bg-blue-100 text-blue-800">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Atualizando dados...
            </Badge>
          )}
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
            <span>📊 {referrals.length} indicações</span>
            <span>🔄 Atualização automática</span>
            <span>⏰ {new Date().toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isFetching}
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${(isRefreshing || isFetching) ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <BackButton to="/analyst" />
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Nome, telefone ou placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="processing">Em Processamento</SelectItem>
                  <SelectItem value="validated">Validado</SelectItem>
                  <SelectItem value="converted">Convertido</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Indicações ({filteredReferrals.length})</CardTitle>
          <CardDescription>
            {canEdit
              ? "Clique em uma indicação para validar ou editar o status"
              : "Você tem permissão apenas para visualizar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredReferrals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma indicação encontrada
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden space-y-4">
                {filteredReferrals.map((referral) => {
                  const indicador = users.find((u) => u.id === referral.userId);
                  const criador = users.find((u) => u.id === referral.createdBy);
                  const company = companies.find((c) => c.id === referral.companyId);
                  return (
                    <Card key={referral.id} className="shadow-sm border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-500">#{referral.id}</span>
                              <Badge className={statusColors[referral.status]}>
                                {statusLabels[referral.status]}
                              </Badge>
                            </div>
                            <h3 className="font-medium text-base">{referral.fullName}</h3>
                            <p className="text-sm text-gray-600">{referral.phone}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Placa:</span>
                            <span className="font-medium">{referral.licensePlate}</span>
                          </div>
                          
                          {(referral.vehicleBrand || referral.vehicleModel || referral.vehicleYear) && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Veículo:</span>
                              <span className="font-medium text-right">
                                {[referral.vehicleBrand, referral.vehicleModel, referral.vehicleYear]
                                  .filter(Boolean)
                                  .join(' ')}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex justify-between">
                            <span className="text-gray-500">Indicador:</span>
                            <div className="text-right">
                              <div className="font-medium">
                                {indicador?.fullName || "N/A"}
                              </div>
                              {criador && criador.id !== indicador?.id && (
                                <div className="text-xs text-gray-500">
                                  Criado por: {criador.fullName}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-500">Empresa:</span>
                            <span>{company?.name || "N/A"}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-500">Data:</span>
                            <span>{new Date(referral.createdAt).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                        
                        {canEdit && (
                          <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-3 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(referral)}
                              className="flex-1 text-xs"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleValidateClick(referral)}
                              disabled={referral.status === "paid"}
                              className="flex-1 text-xs"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Validar
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Indicador</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      {canEdit && <TableHead>Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReferrals.map((referral) => {
                      // Usar userId para mostrar o usuário ATUAL da indicação, não quem criou
                      const indicador = users.find((u) => u.id === referral.userId);
                      const criador = users.find((u) => u.id === referral.createdBy);
                      const company = companies.find((c) => c.id === referral.companyId);
                      return (
                        <TableRow key={referral.id}>
                          <TableCell>#{referral.id}</TableCell>
                          <TableCell className="font-medium">{referral.fullName}</TableCell>
                          <TableCell>{referral.phone}</TableCell>
                          <TableCell>{referral.licensePlate}</TableCell>
                          <TableCell>
                            {(referral.vehicleBrand || referral.vehicleModel || referral.vehicleYear) ? (
                              <div className="text-sm">
                                {[referral.vehicleBrand, referral.vehicleModel, referral.vehicleYear]
                                  .filter(Boolean)
                                  .join(' ')}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">
                                {indicador?.fullName || "N/A"}
                              </div>
                              {criador && criador.id !== indicador?.id && (
                                <div className="text-xs text-gray-500">
                                  Criado por: {criador.fullName}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{company?.name || "N/A"}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[referral.status]}>
                              {statusLabels[referral.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(referral.createdAt).toLocaleDateString("pt-BR")}
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditClick(referral)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleValidateClick(referral)}
                                  disabled={referral.status === "paid"}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Validar
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Validate Dialog */}
      <Dialog open={isValidateDialogOpen} onOpenChange={setIsValidateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Validar Indicação</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nome</p>
                <p className="font-medium">{selectedReferral?.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Telefone</p>
                <p className="font-medium">{selectedReferral?.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Placa</p>
                <p className="font-medium">{selectedReferral?.licensePlate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tem Seguro?</p>
                <p className="font-medium">{selectedReferral?.hasInsurance ? "Sim" : "Não"}</p>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Informações do Veículo</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="vehicleBrand">Marca</Label>
                  <Input
                    id="vehicleBrand"
                    {...form.register("vehicleBrand")}
                    placeholder="Ex: Toyota"
                  />
                  {form.formState.errors.vehicleBrand && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.vehicleBrand.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="vehicleModel">Modelo</Label>
                  <Input
                    id="vehicleModel"
                    {...form.register("vehicleModel")}
                    placeholder="Ex: Corolla"
                  />
                  {form.formState.errors.vehicleModel && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.vehicleModel.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="vehicleYear">Ano</Label>
                  <Input
                    id="vehicleYear"
                    {...form.register("vehicleYear")}
                    placeholder="Ex: 2022"
                  />
                  {form.formState.errors.vehicleYear && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.vehicleYear.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Validação dos Dados</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...form.register("nameCorrect")}
                    className="rounded"
                  />
                  <span>Nome está correto</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...form.register("plateCorrect")}
                    className="rounded"
                  />
                  <span>Placa está correta</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...form.register("phoneCorrect")}
                    className="rounded"
                  />
                  <span>Telefone está correto</span>
                </label>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div>
                <Label htmlFor="validationNotes">Observações da Validação</Label>
                <textarea
                  id="validationNotes"
                  {...form.register("validationNotes")}
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                  placeholder="Adicione observações sobre a validação..."
                />
              </div>
              
              {/* Histórico de Status com Observações */}
              {selectedReferral?.statusHistory && selectedReferral.statusHistory.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Histórico de Observações:</label>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedReferral.statusHistory
                      .filter((entry: any) => entry.notes && entry.notes.trim())
                      .sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                      .map((entry: any, index: number) => {
                        const entryUser = users.find(u => u.id === entry.changedBy);
                        const entryDate = new Date(entry.changedAt);
                        
                        return (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-200">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {statusLabels[entry.status as keyof typeof statusLabels] || entry.status}
                                </Badge>
                                <span className="text-xs text-gray-600 font-medium">
                                  {entryUser?.fullName || 'Usuário não encontrado'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {entryDate.toLocaleDateString("pt-BR")} às {entryDate.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-sm text-gray-700">
                              {entry.notes}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              
              {/* Fallback para observações simples (compatibilidade) */}
              {selectedReferral?.notes && (!selectedReferral.statusHistory || selectedReferral.statusHistory.filter((entry: any) => entry.notes && entry.notes.trim()).length === 0) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações Anteriores:</label>
                  <div className="p-2 bg-gray-50 rounded text-sm">
                    {selectedReferral.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsValidateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={validateMutation.isPending}>
                {validateMutation.isPending ? "Validando..." : "Confirmar Validação"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Indicação</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-fullName">Nome Completo</Label>
                <Input
                  id="edit-fullName"
                  {...editForm.register("fullName")}
                  placeholder="Nome completo"
                />
                {editForm.formState.errors.fullName && (
                  <p className="text-sm text-red-600 mt-1">
                    {editForm.formState.errors.fullName.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  {...editForm.register("phone")}
                  placeholder="(00) 00000-0000"
                />
                {editForm.formState.errors.phone && (
                  <p className="text-sm text-red-600 mt-1">
                    {editForm.formState.errors.phone.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-licensePlate">Placa do Veículo</Label>
                <Input
                  id="edit-licensePlate"
                  {...editForm.register("licensePlate")}
                  placeholder="ABC-1234"
                />
                {editForm.formState.errors.licensePlate && (
                  <p className="text-sm text-red-600 mt-1">
                    {editForm.formState.errors.licensePlate.message}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-hasInsurance"
                  {...editForm.register("hasInsurance")}
                  className="rounded"
                />
                <Label htmlFor="edit-hasInsurance">Tem Seguro?</Label>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div>
                <Label htmlFor="edit-status">Status da Indicação</Label>
                <Select
                  value={editForm.watch("status")}
                  onValueChange={(value: any) => editForm.setValue("status", value)}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-500" />
                        Pendente
                      </div>
                    </SelectItem>
                    <SelectItem value="analyzing">
                      <div className="flex items-center">
                        <Search className="h-4 w-4 mr-2 text-blue-500" />
                        Em Análise
                      </div>
                    </SelectItem>
                    <SelectItem value="validated">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Validado
                      </div>
                    </SelectItem>
                    <SelectItem value="converted">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-green-700" />
                        Convertido
                      </div>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 mr-2 text-red-600" />
                        Rejeitado
                      </div>
                    </SelectItem>
                    <SelectItem value="paid">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-green-800" />
                        Pago
                      </div>
                    </SelectItem>
                    <SelectItem value="false">
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-orange-600" />
                        Falso
                      </div>
                    </SelectItem>
                    <SelectItem value="not_validated">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 mr-2 text-gray-600" />
                        Não Validado
                      </div>
                    </SelectItem>
                    <SelectItem value="not_converted">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 mr-2 text-gray-700" />
                        Não Convertido
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-notes">Observações</Label>
                <textarea
                  id="edit-notes"
                  {...editForm.register("notes")}
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                  placeholder="Adicione observações sobre a indicação..."
                />
              </div>
              
              {/* Histórico de Status com Observações */}
              {selectedReferral?.statusHistory && selectedReferral.statusHistory.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Histórico de Observações:</label>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedReferral.statusHistory
                      .filter((entry: any) => entry.notes && entry.notes.trim())
                      .sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                      .map((entry: any, index: number) => {
                        const entryUser = users.find(u => u.id === entry.changedBy);
                        const entryDate = new Date(entry.changedAt);
                        
                        return (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-200">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {statusLabels[entry.status as keyof typeof statusLabels] || entry.status}
                                </Badge>
                                <span className="text-xs text-gray-600 font-medium">
                                  {entryUser?.fullName || 'Usuário não encontrado'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {entryDate.toLocaleDateString("pt-BR")} às {entryDate.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-sm text-gray-700">
                              {entry.notes}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              
              {/* Fallback para observações simples (compatibilidade) */}
              {selectedReferral?.notes && (!selectedReferral.statusHistory || selectedReferral.statusHistory.filter((entry: any) => entry.notes && entry.notes.trim()).length === 0) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações Anteriores:</label>
                  <div className="p-2 bg-gray-50 rounded text-sm">
                    {selectedReferral.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}