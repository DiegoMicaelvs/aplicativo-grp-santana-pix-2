import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, TrendingUp, DollarSign, UserCheck, FileText, ArrowLeft, Wallet, Plus, ExternalLink, Copy, Edit, Trash2, Eye, MousePointer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { createIndicadorSchema, type CreateIndicador, type User, type Referral, type ReferralStatus, type ReferralLink } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { apiRequest } from "@/lib/queryClient";
import { invalidateRelatedQueries } from "@/lib/invalidateUtils";

interface ReferralLinkFormData {
  name: string;
  isActive: boolean;
}

export default function PromoterDashboard() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [createLinkDialogOpen, setCreateLinkDialogOpen] = useState(false);
  const [editLinkDialogOpen, setEditLinkDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<ReferralLink | null>(null);
  const [linkFormData, setLinkFormData] = useState<ReferralLinkFormData>({
    name: "",
    isActive: true
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch indicadores under this promoter
  const { data: indicadores = [], isLoading: isLoadingIndicadores } = useQuery<User[]>({
    queryKey: ["/api/users/indicadores"],
  });
  
  // Fetch all referrals from promoter's indicadores
  const { data: teamReferrals = [], isLoading: isLoadingTeamReferrals } = useQuery<Referral[]>({
    queryKey: ["/api/promoter/team-referrals"],
  });
  
  // Fetch promoter's own referrals
  const { data: myReferrals = [], isLoading: isLoadingMyReferrals } = useQuery<Referral[]>({
    queryKey: ["/api/referrals"],
  });

  // Fetch referral links
  const { data: referralLinks = [], isLoading: isLoadingLinks } = useQuery<ReferralLink[]>({
    queryKey: ["/api/referral-links"],
    staleTime: 5 * 60 * 1000, // Cache válido por 5 minutos
    refetchInterval: false,
  });

  // Fetch current user info
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  // Fetch supervisor details if assigned
  const { data: supervisor } = useQuery<User>({
    queryKey: ["/api/users", currentUser?.supervisorId],
    enabled: !!currentUser?.supervisorId,
    queryFn: async () => {
      const response = await fetch(`/api/users/${currentUser?.supervisorId}`);
      if (!response.ok) throw new Error('Failed to fetch supervisor');
      return response.json();
    }
  });

  // Create indicador mutation
  const createIndicadorMutation = useMutation({
    mutationFn: async (data: CreateIndicador) => {
      const response = await fetch("/api/users/indicador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar indicador");
      }
      return response.json();
    },
    onSuccess: () => {
      // Use comprehensive invalidation for indicator-related queries
      invalidateRelatedQueries(queryClient, 'indicator');
      toast({
        title: "Sucesso",
        description: "Indicador criado com sucesso!",
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<CreateIndicador>({
    resolver: zodResolver(createIndicadorSchema),
    defaultValues: {
      role: "indicador",
      username: "",
      email: "",
      password: "",
      fullName: "",
      cpf: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      shirtSize: "M",
      pixKey: "",
    },
  });

  const onSubmit = (data: CreateIndicador) => {
    createIndicadorMutation.mutate(data);
  };

  // Referral Links Mutations
  const createLinkMutation = useMutation({
    mutationFn: (data: ReferralLinkFormData) => 
      apiRequest("POST", "/api/referral-links", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-links"] });
      setCreateLinkDialogOpen(false);
      setLinkFormData({ name: "", isActive: true });
      toast({
        title: "Sucesso",
        description: "Link de referência criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar link de referência",
        variant: "destructive",
      });
    }
  });

  const updateLinkMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReferralLinkFormData }) => 
      apiRequest("PATCH", `/api/referral-links/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-links"] });
      setEditLinkDialogOpen(false);
      setSelectedLink(null);
      toast({
        title: "Sucesso",
        description: "Link de referência atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar link de referência",
        variant: "destructive",
      });
    }
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("DELETE", `/api/referral-links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-links"] });
      toast({
        title: "Sucesso",
        description: "Link de referência excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir link de referência",
        variant: "destructive",
      });
    }
  });

  // Referral link helper functions
  const handleCreateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkFormData.name.trim()) return;
    createLinkMutation.mutate(linkFormData);
  };

  const handleEditLink = (link: ReferralLink) => {
    setSelectedLink(link);
    setLinkFormData({
      name: link.name,
      isActive: link.isActive
    });
    setEditLinkDialogOpen(true);
  };

  const handleUpdateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLink || !linkFormData.name.trim()) return;
    updateLinkMutation.mutate({ id: selectedLink.id, data: linkFormData });
  };

  const handleDeleteLink = (link: ReferralLink) => {
    if (confirm(`Tem certeza que deseja excluir o link "${link.name}"?`)) {
      deleteLinkMutation.mutate(link.id);
    }
  };

  const copyLinkToClipboard = (token: string) => {
    // Use current domain instead of external domain that's not properly configured
    const currentDomain = window.location.origin;
    const url = `${currentDomain}/ref/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Copiado!",
        description: "Link copiado para a área de transferência",
      });
    });
  };

  const calculateConversionRate = (clicks: number, registrations: number) => {
    if (clicks === 0) return 0;
    return ((registrations / clicks) * 100).toFixed(1);
  };

  // Calculate stats
  const totalIndicadores = indicadores.length;
  const activeIndicadores = indicadores.filter((i: User) => i.isActive).length;
  
  // Calculate commissions from team
  const teamStats = teamReferrals.reduce((acc, referral) => {
    const registered = referral.status !== 'rejected' ? 1 : 0;
    const converted = referral.status === 'converted' || referral.status === 'paid' ? 1 : 0;
    const commissionRegistration = registered * 1.0; // R$ 1 per registration
    const commissionConversion = converted * 10.0; // R$ 10 per conversion
    
    return {
      totalRegistrations: acc.totalRegistrations + registered,
      totalConversions: acc.totalConversions + converted,
      totalCommissionRegistration: acc.totalCommissionRegistration + commissionRegistration,
      totalCommissionConversion: acc.totalCommissionConversion + commissionConversion,
      totalCommission: acc.totalCommission + commissionRegistration + commissionConversion
    };
  }, {
    totalRegistrations: 0,
    totalConversions: 0,
    totalCommissionRegistration: 0,
    totalCommissionConversion: 0,
    totalCommission: 0
  });
  
  // Calculate my own referral stats
  const myStats = myReferrals.reduce((acc, referral) => {
    const commission = referral.commissionIndicator ? parseFloat(referral.commissionIndicator) : 0;
    const converted = referral.status === 'converted' || referral.status === 'paid' ? 1 : 0;
    
    return {
      total: acc.total + 1,
      converted: acc.converted + converted,
      commission: acc.commission + commission
    };
  }, {
    total: 0,
    converted: 0,
    commission: 0
  });
  
  const getStatusBadge = (status: ReferralStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case 'converted':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Convertido</Badge>;
      case 'analyzing':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Em análise</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Não convertido</Badge>;
      case 'validated':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Validado</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800">Pago</Badge>;
      case 'not_validated':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Não validado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Painel do Promotor</h1>
            </div>
            <p className="text-sm sm:text-base text-gray-600">Gerencie sua rede de indicadores e acompanhe suas comissões</p>
          </div>
        
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                <span className="truncate">Cadastrar Indicador</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Cadastrar Novo Indicador</DialogTitle>
                <DialogDescription className="text-sm">
                  Crie um novo indicador em sua rede. Você receberá R$ 1,00 por cada indicação registrada e R$ 10,00 por cada venda fechada.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="000.000.000-00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(11) 99999-9999" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado (UF)</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="BA" maxLength={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="00000-000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shirtSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho da Camisa</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tamanho" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PP">PP</SelectItem>
                              <SelectItem value="P">P</SelectItem>
                              <SelectItem value="M">M</SelectItem>
                              <SelectItem value="G">G</SelectItem>
                              <SelectItem value="GG">GG</SelectItem>
                              <SelectItem value="XG">XG</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="pixKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave PIX</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email de Login</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createIndicadorMutation.isPending}
                    >
                      {createIndicadorMutation.isPending ? "Criando..." : "Criar Indicador"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex min-w-full sm:grid sm:grid-cols-5 gap-1">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-3 sm:px-4 flex-shrink-0">
                <span className="hidden sm:inline">Visão Geral</span>
                <span className="sm:hidden">Geral</span>
              </TabsTrigger>
              <TabsTrigger value="my-referrals" className="text-xs sm:text-sm px-3 sm:px-4 flex-shrink-0">
                <span className="hidden sm:inline">Minhas Indicações</span>
                <span className="sm:hidden">Minhas</span>
              </TabsTrigger>
              <TabsTrigger value="team-referrals" className="text-xs sm:text-sm px-3 sm:px-4 flex-shrink-0">
                <span className="hidden sm:inline">Indicações da Equipe</span>
                <span className="sm:hidden">Equipe</span>
              </TabsTrigger>
              <TabsTrigger value="indicadores" className="text-xs sm:text-sm px-3 sm:px-4 flex-shrink-0">
                <span className="hidden sm:inline">Meus Indicadores</span>
                <span className="sm:hidden">Indicadores</span>
              </TabsTrigger>
              <TabsTrigger value="referral-links" className="text-xs sm:text-sm px-3 sm:px-4 flex-shrink-0">
                <span className="hidden sm:inline">Links de Referência</span>
                <span className="sm:hidden">Links</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Profile Card */}
            {currentUser && currentUser.role === 'promotor' && (
              <Card>
                <CardHeader>
                  <CardTitle>Meu Perfil</CardTitle>
                  <CardDescription>Informações do seu perfil de promotor</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Nome</p>
                      <p className="font-medium">{currentUser.fullName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{currentUser.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Telefone</p>
                      <p className="font-medium">{currentUser.phone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Atribuído a</p>
                      {currentUser.supervisorId ? (
                        <p className="font-medium text-blue-600">
                          {supervisor ? supervisor.fullName : `Analista Nível 3 (ID: ${currentUser.supervisorId})`}
                        </p>
                      ) : (
                        <p className="text-gray-400">Sem atribuição</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Indicadores</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalIndicadores}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeIndicadores} ativos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Minhas Indicações</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{myStats.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {myStats.converted} convertidas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comissões da Equipe</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ {teamStats.totalCommission.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    {teamStats.totalRegistrations} cadastros | {teamStats.totalConversions} vendas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Minhas Comissões</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ {myStats.commission.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    De minhas próprias indicações
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Commission Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo de Comissões</CardTitle>
                <CardDescription>Detalhamento das suas comissões</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-blue-50 rounded-lg gap-2">
                    <div>
                      <h4 className="font-medium">Comissões da Equipe</h4>
                      <p className="text-sm text-gray-600">Ganhos com indicações dos seus indicadores</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-2xl font-bold text-blue-600">R$ {teamStats.totalCommission.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">
                        R$ {teamStats.totalCommissionRegistration.toFixed(2)} cadastros + R$ {teamStats.totalCommissionConversion.toFixed(2)} vendas
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-green-50 rounded-lg gap-2">
                    <div>
                      <h4 className="font-medium">Comissões Próprias</h4>
                      <p className="text-sm text-gray-600">Ganhos com suas próprias indicações</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-2xl font-bold text-green-600">R$ {myStats.commission.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">{myStats.converted} vendas convertidas</p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base sm:text-lg font-semibold">Total Geral</h4>
                      <p className="text-xl sm:text-2xl font-bold">
                        R$ {(teamStats.totalCommission + myStats.commission).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-referrals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Minhas Indicações Diretas</CardTitle>
                <CardDescription>
                  Indicações feitas diretamente por você
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingMyReferrals ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : myReferrals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhuma indicação própria ainda
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[120px]">Nome</TableHead>
                            <TableHead className="min-w-[100px]">Telefone</TableHead>
                            <TableHead className="min-w-[120px]">Cidade/Estado</TableHead>
                            <TableHead className="min-w-[100px]">Status</TableHead>
                            <TableHead className="min-w-[80px]">Comissão</TableHead>
                            <TableHead className="min-w-[80px]">Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {myReferrals.map((referral) => (
                            <TableRow key={referral.id}>
                              <TableCell className="font-medium">{referral.fullName}</TableCell>
                              <TableCell>{referral.phone}</TableCell>
                              <TableCell>
                                {referral.city && referral.state ? (
                                  <span className="text-sm whitespace-nowrap">
                                    {referral.city}/{referral.state}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(referral.status)}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                R$ {referral.commissionIndicator ? parseFloat(referral.commissionIndicator).toFixed(2) : '0.00'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {new Date(referral.createdAt).toLocaleDateString('pt-BR')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team-referrals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Indicações da Equipe</CardTitle>
                <CardDescription>
                  Todas as indicações feitas pelos seus indicadores
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTeamReferrals ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : teamReferrals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Sua equipe ainda não fez indicações
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[120px]">Indicador</TableHead>
                            <TableHead className="min-w-[120px]">Cliente</TableHead>
                            <TableHead className="min-w-[100px]">Telefone</TableHead>
                            <TableHead className="min-w-[120px]">Cidade/Estado</TableHead>
                            <TableHead className="min-w-[100px]">Status</TableHead>
                            <TableHead className="min-w-[120px]">Sua Comissão</TableHead>
                            <TableHead className="min-w-[80px]">Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamReferrals.map((referral) => {
                            const registered = (referral.status === 'validated' || referral.status === 'converted' || referral.status === 'paid') ? 1.0 : 0;
                            const converted = (referral.status === 'converted' || referral.status === 'paid') ? 10.0 : 0;
                            const commission = registered + converted;
                            
                            return (
                              <TableRow key={referral.id}>
                                <TableCell className="font-medium">
                                  {indicadores.find(i => i.id === referral.createdBy)?.fullName || 'Indicador'}
                                </TableCell>
                                <TableCell>{referral.fullName}</TableCell>
                                <TableCell>{referral.phone}</TableCell>
                                <TableCell>
                                  {referral.city && referral.state ? (
                                    <span className="text-sm whitespace-nowrap">
                                      {referral.city}/{referral.state}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell>{getStatusBadge(referral.status)}</TableCell>
                                <TableCell>
                                  <div className="whitespace-nowrap">
                                    <span className="font-medium">R$ {commission.toFixed(2)}</span>
                                    {commission > 0 && (
                                      <p className="text-xs text-gray-500">
                                        {registered > 0 && `R$ ${registered.toFixed(2)} cadastro`}
                                        {registered > 0 && converted > 0 && ' + '}
                                        {converted > 0 && `R$ ${converted.toFixed(2)} venda`}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {new Date(referral.createdAt).toLocaleDateString('pt-BR')}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indicadores" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Meus Indicadores</CardTitle>
                    <CardDescription>
                      Gerencie os indicadores em sua rede
                    </CardDescription>
                  </div>
                  <Link href="/register-indicator">
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Indicador
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingIndicadores ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : indicadores.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum indicador cadastrado ainda
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[150px]">Nome</TableHead>
                            <TableHead className="min-w-[180px]">Email</TableHead>
                            <TableHead className="min-w-[100px]">Telefone</TableHead>
                            <TableHead className="min-w-[80px]">Indicações</TableHead>
                            <TableHead className="min-w-[80px]">Saldo</TableHead>
                            <TableHead className="min-w-[80px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {indicadores.map((indicador) => {
                            const indicadorReferrals = teamReferrals.filter(r => r.userId === indicador.id);
                            const totalReferrals = indicadorReferrals.length;
                            
                            return (
                              <TableRow key={indicador.id}>
                                <TableCell className="font-medium">{indicador.fullName}</TableCell>
                                <TableCell className="truncate max-w-[180px]">{indicador.email}</TableCell>
                                <TableCell>{indicador.phone}</TableCell>
                                <TableCell>{totalReferrals}</TableCell>
                                <TableCell className="whitespace-nowrap">R$ {parseFloat(indicador.balance || "0").toFixed(2)}</TableCell>
                                <TableCell>
                                  <Badge variant={indicador.isActive ? "default" : "secondary"}>
                                    {indicador.isActive ? "Ativo" : "Inativo"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referral-links" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Links de Referência
                </CardTitle>
                <CardDescription>
                  Crie e gerencie links personalizados para rastrear novos cadastros através de sua rede
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Statistics Summary */}
                {referralLinks.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                    <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <MousePointer className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">Total de Cliques</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-blue-700">
                        {referralLinks.reduce((sum, link) => sum + (link.clicks || 0), 0)}
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">Cadastros</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-green-700">
                        {referralLinks.reduce((sum, link) => sum + (link.registrations || 0), 0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-600">Conversão Média</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-purple-700">
                        {referralLinks.length > 0 && referralLinks.reduce((sum, link) => sum + (link.clicks || 0), 0) > 0 
                          ? calculateConversionRate(
                              referralLinks.reduce((sum, link) => sum + (link.clicks || 0), 0),
                              referralLinks.reduce((sum, link) => sum + (link.registrations || 0), 0)
                            ) + '%'
                          : '0%'
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Create New Link Button */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
                  <h3 className="text-base sm:text-lg font-medium">Seus Links de Referência</h3>
                  <Dialog open={createLinkDialogOpen} onOpenChange={setCreateLinkDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Link
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Novo Link de Referência</DialogTitle>
                        <DialogDescription>
                          Crie um link personalizado para rastrear cadastros de sua rede
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateLink} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="link-name">Nome do Link</Label>
                          <Input
                            id="link-name"
                            placeholder="Ex: Campanha Facebook, Instagram Stories..."
                            value={linkFormData.name}
                            onChange={(e) => setLinkFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="link-active"
                            checked={linkFormData.isActive}
                            onCheckedChange={(checked) => setLinkFormData(prev => ({ ...prev, isActive: checked }))}
                          />
                          <Label htmlFor="link-active">Link ativo</Label>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setCreateLinkDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={createLinkMutation.isPending}>
                            {createLinkMutation.isPending ? "Criando..." : "Criar Link"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Links Table */}
                {isLoadingLinks ? (
                  <div className="text-center py-8">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                    </div>
                  </div>
                ) : referralLinks.length === 0 ? (
                  <div className="text-center py-8">
                    <ExternalLink className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum link criado ainda</h3>
                    <p className="text-muted-foreground mb-4">
                      Crie seu primeiro link de referência para começar a rastrear cadastros
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[180px]">Nome</TableHead>
                            <TableHead className="text-center min-w-[80px]">Cliques</TableHead>
                            <TableHead className="text-center min-w-[90px]">Cadastros</TableHead>
                            <TableHead className="text-center min-w-[90px]">Conversão</TableHead>
                            <TableHead className="text-center min-w-[80px]">Status</TableHead>
                            <TableHead className="text-center min-w-[120px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {referralLinks.map((link) => (
                            <TableRow key={link.id}>
                              <TableCell className="font-medium">
                                <div className="max-w-[200px]">
                                  <p className="font-medium truncate">{link.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {window.location.origin}/ref/{link.linkToken}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                                  <MousePointer className="h-3 w-3 text-blue-500" />
                                  {link.clicks || 0}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                                  <Users className="h-3 w-3 text-green-500" />
                                  {link.registrations || 0}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="whitespace-nowrap">
                                  {calculateConversionRate(link.clicks || 0, link.registrations || 0)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={link.isActive ? "default" : "secondary"} className="whitespace-nowrap">
                                  {link.isActive ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1 flex-nowrap">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyLinkToClipboard(link.linkToken)}
                                    title="Copiar link"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditLink(link)}
                                    title="Editar"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteLink(link)}
                                    title="Excluir"
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Edit Dialog */}
                <Dialog open={editLinkDialogOpen} onOpenChange={setEditLinkDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Link de Referência</DialogTitle>
                      <DialogDescription>
                        Modifique as informações do seu link de referência
                      </DialogDescription>
                    </DialogHeader>
                    {selectedLink && (
                      <form onSubmit={handleUpdateLink} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-link-name">Nome do Link</Label>
                          <Input
                            id="edit-link-name"
                            placeholder="Ex: Campanha Facebook, Instagram Stories..."
                            value={linkFormData.name}
                            onChange={(e) => setLinkFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="edit-link-active"
                            checked={linkFormData.isActive}
                            onCheckedChange={(checked) => setLinkFormData(prev => ({ ...prev, isActive: checked }))}
                          />
                          <Label htmlFor="edit-link-active">Link ativo</Label>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-md">
                          <Label className="text-sm font-medium">URL do Link</Label>
                          <p className="text-sm text-muted-foreground break-all">
                            {window.location.origin}/ref/{selectedLink.linkToken}
                          </p>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setEditLinkDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={updateLinkMutation.isPending}>
                            {updateLinkMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
}