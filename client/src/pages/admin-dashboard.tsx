import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Users, ClipboardList, DollarSign, CheckCircle, XCircle, Clock, Loader2, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Referral as BaseReferral, ReferralStatus, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Interface estendida para incluir a relação com o usuário
interface Referral extends BaseReferral {
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'username'>;
}
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Helper function to get appropriate badge color based on status
const getStatusBadge = (status: ReferralStatus) => {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
    case 'converted':
      return <Badge variant="outline" className="bg-green-100 text-green-800">Convertido</Badge>;
    case 'processing':
      return <Badge variant="outline" className="bg-blue-100 text-blue-800">Em análise</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="bg-red-100 text-red-800">Não convertido</Badge>;
    case 'validated':
      return <Badge variant="outline" className="bg-purple-100 text-purple-800">Validado</Badge>;
    case 'paid':
      return <Badge variant="outline" className="bg-emerald-100 text-emerald-800">Pago</Badge>;
    default:
      return <Badge variant="outline">Desconhecido</Badge>;
  }
};

// Format date to Brazilian format
const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "-";
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('pt-BR');
};

// Format currency to Brazilian Real
const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return '-';
  let numValue: number;
  
  try {
    numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
  } catch (e) {
    return '-';
  }
  
  return numValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

// Status update form schema
const updateReferralSchema = z.object({
  status: z.enum(["pending", "processing", "converted", "rejected", "validated", "paid"]),
  commission: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().optional()
  ),
  notes: z.string().optional(),
  paidAt: z.date().optional()
});

type UpdateReferralFormValues = z.infer<typeof updateReferralSchema>;

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("referrals");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const itemsPerPage = 10;
  
  // Fetch all referrals
  const { data: referrals, isLoading: isLoadingReferrals } = useQuery<Referral[]>({
    queryKey: ['/api/admin/referrals'],
  });
  
  // Fetch all users
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });
  
  // Filter referrals based on status
  const filteredReferrals = referrals?.filter(referral => 
    statusFilter === "all" || referral.status === statusFilter
  ) || [];
  
  // Calculate pagination for referrals
  const totalPages = Math.ceil(filteredReferrals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReferrals = filteredReferrals.slice(startIndex, startIndex + itemsPerPage);
  
  // Form for updating referral status
  const form = useForm<UpdateReferralFormValues>({
    resolver: zodResolver(updateReferralSchema),
    defaultValues: {
      status: "pending",
      commission: undefined,
      notes: ""
    }
  });
  
  // Update referral status mutation
  const updateReferralMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: UpdateReferralFormValues }) => {
      const res = await apiRequest("PATCH", `/api/admin/referrals/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/referrals'] });
      setDialogOpen(false);
      toast({
        title: "Status atualizado",
        description: "O status da indicação foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle opening the referral status dialog
  const handleOpenStatusDialog = (referral: Referral) => {
    setSelectedReferral(referral);
    form.reset({
      status: referral.status,
      commission: referral.commission ? Number(referral.commission) : undefined,
      notes: referral.notes || ""
    });
    setDialogOpen(true);
  };
  
  // Watch for status changes to apply default commission value when 'validated'
  // or to set the payment date when status is 'paid'
  const status = form.watch('status');
  useEffect(() => {
    if (status === 'validated') {
      form.setValue('commission', 3.00);
    } else if (status === 'paid') {
      form.setValue('paidAt', new Date());
    }
  }, [status, form]);
  
  // Handle updating referral status
  const onSubmitStatusUpdate = (data: UpdateReferralFormValues) => {
    if (selectedReferral) {
      updateReferralMutation.mutate({ id: selectedReferral.id, data });
    }
  };
  
  // Calculate dashboard stats
  const totalReferrers = users?.filter(u => u.role === "referrer").length || 0;
  const totalReferrals = referrals?.length || 0;
  const convertedReferrals = referrals?.filter(r => r.status === 'converted').length || 0;
  const conversionRate = totalReferrals > 0 ? (convertedReferrals / totalReferrals * 100).toFixed(1) : "0";
  const totalCommissions = referrals?.reduce((sum, r) => {
    const commission = r.commission ? (typeof r.commission === 'string' ? parseFloat(r.commission) : r.commission) : 0;
    return sum + commission;
  }, 0) || 0;
  
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Acesso Restrito</h1>
            <p className="mt-2">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="bg-gray-100 flex-grow py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 font-heading">Painel Administrativo</h1>
          <p className="mt-1 text-gray-600">Gerenciamento de indicadores e indicações</p>
          
          {/* Dashboard Cards */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Referrers Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-primary rounded-md p-3">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="text-sm font-medium text-gray-500 truncate">Total de Indicadores</div>
                    <div className="text-lg font-medium text-gray-900">{totalReferrers}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Referrals Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-secondary rounded-md p-3">
                    <ClipboardList className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="text-sm font-medium text-gray-500 truncate">Total de Indicações</div>
                    <div className="text-lg font-medium text-gray-900">{totalReferrals}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conversion Rate Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="text-sm font-medium text-gray-500 truncate">Taxa de Conversão</div>
                    <div className="text-lg font-medium text-gray-900">{conversionRate}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Commissions Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-accent rounded-md p-3">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="text-sm font-medium text-gray-500 truncate">Comissões Pagas</div>
                    <div className="text-lg font-medium text-gray-900">{formatCurrency(totalCommissions)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Main Content Tabs */}
          <div className="mt-8">
            <Tabs
              defaultValue="referrals"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="referrals">Indicações</TabsTrigger>
                <TabsTrigger value="users">Indicadores</TabsTrigger>
              </TabsList>
              
              <TabsContent value="referrals" className="mt-6">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>Gerenciar Indicações</CardTitle>
                        <CardDescription>
                          Visualize e atualize o status das indicações
                        </CardDescription>
                      </div>
                      
                      <div className="mt-4 sm:mt-0 flex items-center space-x-2">
                        <Filter className="text-gray-400 h-4 w-4" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os Status</SelectItem>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="processing">Em análise</SelectItem>
                            <SelectItem value="converted">Convertido</SelectItem>
                            <SelectItem value="rejected">Não convertido</SelectItem>
                            <SelectItem value="validated">Validado</SelectItem>
                            <SelectItem value="paid">Pago</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingReferrals ? (
                      <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : filteredReferrals.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Indicador</TableHead>
                                <TableHead>Indicação</TableHead>
                                <TableHead>Veículo</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Comissão</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedReferrals.map((referral) => (
                                <TableRow key={referral.id}>
                                  <TableCell>{referral.id}</TableCell>
                                  <TableCell>
                                    {referral.user?.firstName} {referral.user?.lastName}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {referral.firstName} {referral.lastName}
                                  </TableCell>
                                  <TableCell>
                                    Placa: {referral.licensePlate}
                                  </TableCell>
                                  <TableCell>{formatDate(referral.createdAt)}</TableCell>
                                  <TableCell>{getStatusBadge(referral.status)}</TableCell>
                                  <TableCell>{formatCurrency(referral.commission)}</TableCell>
                                  <TableCell className="text-right">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleOpenStatusDialog(referral)}
                                    >
                                      Atualizar Status
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {totalPages > 1 && (
                          <div className="mt-6">
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                                  <PaginationPrevious 
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                  />
                                </PaginationItem>
                                
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                  // Show first page, last page, current page, and pages around current
                                  if (
                                    page === 1 || 
                                    page === totalPages || 
                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                  ) {
                                    return (
                                      <PaginationItem key={page}>
                                        <PaginationLink
                                          isActive={page === currentPage}
                                          onClick={() => setCurrentPage(page)}
                                        >
                                          {page}
                                        </PaginationLink>
                                      </PaginationItem>
                                    );
                                  }
                                  
                                  // Show ellipsis for gaps
                                  if (page === currentPage - 2 || page === currentPage + 2) {
                                    return (
                                      <PaginationItem key={page}>
                                        <PaginationEllipsis />
                                      </PaginationItem>
                                    );
                                  }
                                  
                                  return null;
                                })}
                                
                                <PaginationItem>
                                  <PaginationNext 
                                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                  />
                                </PaginationItem>
                              </PaginationContent>
                            </Pagination>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-500">Nenhuma indicação encontrada com os filtros selecionados.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="users" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Gerenciar Indicadores</CardTitle>
                    <CardDescription>Lista de todos os indicadores cadastrados</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingUsers ? (
                      <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : users && users.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Telefone</TableHead>
                              <TableHead>CPF</TableHead>
                              <TableHead>Nascimento</TableHead>
                              <TableHead>Cadastro</TableHead>
                              <TableHead>Tipo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell>{user.id}</TableCell>
                                <TableCell className="font-medium">
                                  {user.firstName} {user.lastName}
                                </TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.phone}</TableCell>
                                <TableCell>{user.cpf}</TableCell>
                                <TableCell>{formatDate(user.birthdate)}</TableCell>
                                <TableCell>{formatDate(user.createdAt)}</TableCell>
                                <TableCell>
                                  <Badge variant={user.role === 'admin' ? 'secondary' : 'default'}>
                                    {user.role === 'admin' ? 'Administrador' : 'Indicador'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-500">Nenhum indicador cadastrado.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Referral Status Update Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Atualizar Status da Indicação</DialogTitle>
                <DialogDescription>
                  {selectedReferral && (
                    <span>
                      Indicação de {selectedReferral.firstName} {selectedReferral.lastName} - 
                      Placa: {selectedReferral.licensePlate}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitStatusUpdate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="processing">Em análise</SelectItem>
                            <SelectItem value="converted">Convertido</SelectItem>
                            <SelectItem value="rejected">Não convertido</SelectItem>
                            <SelectItem value="validated">Validado</SelectItem>
                            <SelectItem value="paid">Pago</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="commission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comissão (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            disabled={!['converted', 'validated', 'paid'].includes(form.watch('status'))}
                            {...field}
                            value={field.value === undefined ? '' : field.value}
                          />
                        </FormControl>
                        <FormDescription>
                          Valor da comissão a ser paga ao indicador (para status convertido, validado ou pago)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Campo de data de pagamento (apenas para status 'paid') */}
                  {form.watch('status') === 'paid' && (
                    <FormField
                      control={form.control}
                      name="paidAt"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data de Pagamento</FormLabel>
                          <FormControl>
                            <div className="grid gap-2">
                              <Input
                                type="date"
                                value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    // Garantir que a data está definida corretamente
                                    const dateString = e.target.value + 'T12:00:00Z';
                                    const date = new Date(dateString);
                                    field.onChange(date);
                                  } else {
                                    field.onChange(undefined);
                                  }
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Data em que o pagamento foi realizado
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Observações sobre esta indicação"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateReferralMutation.isPending}
                    >
                      {updateReferralMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                          Salvando...
                        </>
                      ) : (
                        "Salvar Alterações"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
