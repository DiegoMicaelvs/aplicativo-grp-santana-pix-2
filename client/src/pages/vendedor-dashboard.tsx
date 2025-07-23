import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Target,
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  Activity,
  Eye
} from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import type { SalesLead, CreateSalesLead, UpdateSalesLead } from "@shared/schema";
import { createSalesLeadSchema, updateSalesLeadSchema } from "@shared/schema";

type SalesStats = {
  total: number;
  novo: number;
  em_negociacao: number;
  proposta_enviada: number;
  negocio_fechado: number;
  perdido: number;
  totalValue: number;
  totalCommission: number;
};

export default function VendedorDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [leadDetailsOpen, setLeadDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all_statuses");

  // Fetch sales statistics
  const { data: salesStats, isLoading: statsLoading } = useQuery<SalesStats>({
    queryKey: ["/api/sales/stats"],
  });

  // Fetch sales leads
  const { data: salesLeads, isLoading: leadsLoading } = useQuery<SalesLead[]>({
    queryKey: ["/api/sales/leads"],
  });

  // Fetch available referrals for conversion
  const { data: availableReferrals } = useQuery({
    queryKey: ["/api/sales/available-referrals"],
  });

  // Create lead form
  const createForm = useForm<CreateSalesLead>({
    resolver: zodResolver(createSalesLeadSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      licensePlate: "",
      hasInsurance: false,
      source: "manual",
      status: "novo",
      notes: ""
    }
  });

  // Update lead form
  const updateForm = useForm<UpdateSalesLead>({
    resolver: zodResolver(updateSalesLeadSchema),
    defaultValues: {}
  });

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: (data: CreateSalesLead) => fetch("/api/sales/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/stats"] });
      toast({ title: "Lead criado com sucesso!" });
      createForm.reset();
      setCreateLeadOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao criar lead", variant: "destructive" });
    }
  });

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: UpdateSalesLead }) => 
      fetch(`/api/sales/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/stats"] });
      toast({ title: "Lead atualizado com sucesso!" });
      setSelectedLead(null);
      setLeadDetailsOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar lead", variant: "destructive" });
    }
  });

  // Convert referral to lead mutation
  const convertReferralMutation = useMutation({
    mutationFn: (referralId: number) => fetch(`/api/sales/convert-referral/${referralId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/stats"] });
      toast({ title: "Indicação convertida em lead com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao converter indicação", variant: "destructive" });
    }
  });

  const onCreateSubmit = (data: CreateSalesLead) => {
    createLeadMutation.mutate(data);
  };

  const onUpdateSubmit = (data: UpdateSalesLead) => {
    if (selectedLead) {
      updateLeadMutation.mutate({ id: selectedLead.id, data });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "novo":
        return <Badge variant="secondary">Novo</Badge>;
      case "em_negociacao":
        return <Badge variant="outline">Em Negociação</Badge>;
      case "proposta_enviada":
        return <Badge variant="default">Proposta Enviada</Badge>;
      case "negocio_fechado":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Fechado</Badge>;
      case "perdido":
        return <Badge variant="destructive">Perdido</Badge>;
      case "reagendado":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Reagendado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredLeads = salesLeads?.filter(lead => 
    statusFilter === "all_statuses" || lead.status === statusFilter
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Painel de Vendas
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gerencie seus leads e acompanhe suas vendas
            </p>
          </div>
          
          <Dialog open={createLeadOpen} onOpenChange={setCreateLeadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Lead</DialogTitle>
                <DialogDescription>
                  Adicione um novo lead ao seu pipeline de vendas
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do cliente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="licensePlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa do Veículo</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC-1234" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="proposalValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor da Proposta (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Informações adicionais..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setCreateLeadOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createLeadMutation.isPending}>
                      {createLeadMutation.isPending ? "Criando..." : "Criar Lead"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(salesStats as any)?.total || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negócios Fechados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{salesStats?.negocio_fechado || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {salesStats?.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissão Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {salesStats?.totalCommission?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Referrals to Convert */}
        {availableReferrals && Array.isArray(availableReferrals) && availableReferrals.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Indicações Disponíveis para Conversão</CardTitle>
              <CardDescription>
                Indicações validadas que podem ser convertidas em leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.isArray(availableReferrals) ? availableReferrals.map((referral: any) => (
                  <Card key={referral.id} className="border-2 border-dashed">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold">{referral.fullName}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {referral.phone}
                        </p>
                        <p className="text-sm">Placa: {referral.licensePlate}</p>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => convertReferralMutation.mutate(referral.id)}
                          disabled={convertReferralMutation.isPending}
                        >
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Converter em Lead
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )) : null}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sales Pipeline */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Pipeline de Vendas</CardTitle>
                <CardDescription>Gerencie seus leads e oportunidades</CardDescription>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_statuses">Todos os Status</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="em_negociacao">Em Negociação</SelectItem>
                  <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                  <SelectItem value="negocio_fechado">Negócio Fechado</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                  <SelectItem value="reagendado">Reagendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {leadsLoading ? (
              <div className="text-center py-8">Carregando leads...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Nenhum lead encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor da Proposta</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead: SalesLead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{lead.fullName}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {lead.licensePlate}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Phone className="h-3 w-3 mr-1" />
                            {lead.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                      <TableCell>
                        {lead.proposalValue 
                          ? `R$ ${parseFloat(lead.proposalValue.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog 
                          open={leadDetailsOpen && selectedLead?.id === lead.id} 
                          onOpenChange={(open) => {
                            setLeadDetailsOpen(open);
                            if (!open) setSelectedLead(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLead(lead);
                                updateForm.reset({
                                  status: lead.status,
                                  proposalValue: lead.proposalValue ? parseFloat(lead.proposalValue.toString()) : undefined,
                                  finalValue: lead.finalValue ? parseFloat(lead.finalValue.toString()) : undefined,
                                  notes: lead.notes || ""
                                });
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Detalhes do Lead: {lead.fullName}</DialogTitle>
                            </DialogHeader>
                            
                            <div className="space-y-6">
                              {/* Lead Info */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Telefone</Label>
                                  <p className="text-sm">{lead.phone}</p>
                                </div>
                                <div>
                                  <Label>Placa</Label>
                                  <p className="text-sm">{lead.licensePlate}</p>
                                </div>
                                <div>
                                  <Label>Status Atual</Label>
                                  <div className="mt-1">{getStatusBadge(lead.status)}</div>
                                </div>
                                <div>
                                  <Label>Fonte</Label>
                                  <p className="text-sm capitalize">{lead.source}</p>
                                </div>
                              </div>

                              {/* Update Form */}
                              <Form {...updateForm}>
                                <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                      control={updateForm.control}
                                      name="status"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Atualizar Status</FormLabel>
                                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Selecione o status" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              <SelectItem value="novo">Novo</SelectItem>
                                              <SelectItem value="em_negociacao">Em Negociação</SelectItem>
                                              <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                                              <SelectItem value="negocio_fechado">Negócio Fechado</SelectItem>
                                              <SelectItem value="perdido">Perdido</SelectItem>
                                              <SelectItem value="reagendado">Reagendado</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={updateForm.control}
                                      name="proposalValue"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Valor da Proposta</FormLabel>
                                          <FormControl>
                                            <Input 
                                              type="number" 
                                              step="0.01"
                                              placeholder="0.00" 
                                              {...field}
                                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <FormField
                                    control={updateForm.control}
                                    name="notes"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Observações</FormLabel>
                                        <FormControl>
                                          <Textarea 
                                            placeholder="Adicione observações sobre este lead..."
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <div className="flex justify-end space-x-2">
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      onClick={() => setLeadDetailsOpen(false)}
                                    >
                                      Cancelar
                                    </Button>
                                    <Button type="submit" disabled={updateLeadMutation.isPending}>
                                      {updateLeadMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                                    </Button>
                                  </div>
                                </form>
                              </Form>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}