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
import { Search, Edit, CheckCircle, XCircle, Info } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Referral, User, Company } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

const validateSchema = z.object({
  vehicleBrand: z.string().min(1, "Marca é obrigatória"),
  vehicleModel: z.string().min(1, "Modelo é obrigatório"),
  vehicleYear: z.string().min(4, "Ano é obrigatório"),
  nameCorrect: z.boolean(),
  plateCorrect: z.boolean(),
  phoneCorrect: z.boolean(),
  finalStatus: z.enum(["validated", "rejected"]),
  notes: z.string().optional(),
});

type ValidateFormValues = z.infer<typeof validateSchema>;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  converted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  validated: "bg-purple-100 text-purple-800",
  paid: "bg-emerald-100 text-emerald-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Em Processamento",
  converted: "Convertido",
  rejected: "Rejeitado",
  validated: "Validado",
  paid: "Pago",
};

export default function AnalystReferrals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [isValidateDialogOpen, setIsValidateDialogOpen] = useState(false);

  // Fetch referrals
  const { data: referrals = [], isLoading } = useQuery<Referral[]>({
    queryKey: ["/api/analyst/referrals"],
  });

  // Fetch users for display
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Fetch companies for display
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const form = useForm<ValidateFormValues>({
    resolver: zodResolver(validateSchema),
    defaultValues: {
      vehicleBrand: "",
      vehicleModel: "",
      vehicleYear: "",
      nameCorrect: true,
      plateCorrect: true,
      phoneCorrect: true,
      finalStatus: "validated",
      notes: "",
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
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/referrals"] });
      toast({ title: "Sucesso", description: "Indicação validada com sucesso!" });
      setIsValidateDialogOpen(false);
      setSelectedReferral(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Check permissions - Allow analysts level 1+ to edit referral status
  const canEdit = user?.permissions?.includes("edit_referral_status") || 
    (user?.role === "analista" && user?.analystLevel && user.analystLevel >= 1);

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
      vehicleBrand: referral.vehicleBrand || "",
      vehicleModel: referral.vehicleModel || "",
      vehicleYear: referral.vehicleYear || "",
      nameCorrect: referral.nameCorrect ?? true,
      plateCorrect: referral.plateCorrect ?? true,
      phoneCorrect: referral.phoneCorrect ?? true,
      finalStatus: "validated",
      notes: "",
    });
    setIsValidateDialogOpen(true);
  };

  const onSubmit = (data: ValidateFormValues) => {
    if (selectedReferral) {
      validateMutation.mutate({ id: selectedReferral.id, data });
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

  if (user.role === "analista" && !user.permissions?.includes("view_referrals")) {
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
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Indicações para Análise</h1>
          <p className="text-gray-600">Visualize e valide as indicações cadastradas</p>
        </div>
        <BackButton to="/analyst" />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Indicador</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    {canEdit && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map((referral) => {
                    const indicador = users.find((u) => u.id === referral.userId);
                    const company = companies.find((c) => c.id === referral.companyId);
                    return (
                      <TableRow key={referral.id}>
                        <TableCell>#{referral.id}</TableCell>
                        <TableCell className="font-medium">{referral.fullName}</TableCell>
                        <TableCell>{referral.phone}</TableCell>
                        <TableCell>{referral.licensePlate}</TableCell>
                        <TableCell>{indicador?.fullName || "N/A"}</TableCell>
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleValidateClick(referral)}
                              disabled={referral.status === "validated" || referral.status === "paid"}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Validar
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validate Dialog */}
      <Dialog open={isValidateDialogOpen} onOpenChange={setIsValidateDialogOpen}>
        <DialogContent className="max-w-2xl">
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
                <Label htmlFor="finalStatus">Status Final</Label>
                <Select
                  value={form.watch("finalStatus")}
                  onValueChange={(value: "validated" | "rejected") =>
                    form.setValue("finalStatus", value)
                  }
                >
                  <SelectTrigger id="finalStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="validated">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Validado
                      </div>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 mr-2 text-red-600" />
                        Rejeitado
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <textarea
                  id="notes"
                  {...form.register("notes")}
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                  placeholder="Adicione observações sobre a validação..."
                />
              </div>
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
    </div>
  );
}