import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, TrendingUp, DollarSign, UserCheck, FileText, ArrowLeft, Wallet } from "lucide-react";
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
import { createIndicadorSchema, type CreateIndicador, type User, type Referral, type ReferralStatus } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { apiRequest } from "@/lib/queryClient";

export default function PromoterDashboard() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
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

  // Fetch current user info
  const { data: currentUser } = useQuery({
    queryKey: ["/api/user"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/users/indicadores"] });
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
      shirtSize: "M",
      pixKey: "",
    },
  });

  const onSubmit = (data: CreateIndicador) => {
    createIndicadorMutation.mutate(data);
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
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Painel do Promotor</h1>
            </div>
            <p className="text-gray-600">Gerencie sua rede de indicadores e acompanhe suas comissões</p>
          </div>
        
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Cadastrar Indicador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Indicador</DialogTitle>
                <DialogDescription>
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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shirtSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho da Camisa</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Button type="submit" disabled={createIndicadorMutation.isPending}>
                      {createIndicadorMutation.isPending ? "Criando..." : "Criar Indicador"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="my-referrals">Minhas Indicações</TabsTrigger>
            <TabsTrigger value="team-referrals">Indicações da Equipe</TabsTrigger>
            <TabsTrigger value="indicadores">Meus Indicadores</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">Comissões da Equipe</h4>
                      <p className="text-sm text-gray-600">Ganhos com indicações dos seus indicadores</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">R$ {teamStats.totalCommission.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">
                        R$ {teamStats.totalCommissionRegistration.toFixed(2)} cadastros + R$ {teamStats.totalCommissionConversion.toFixed(2)} vendas
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">Comissões Próprias</h4>
                      <p className="text-sm text-gray-600">Ganhos com suas próprias indicações</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">R$ {myStats.commission.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">{myStats.converted} vendas convertidas</p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold">Total Geral</h4>
                      <p className="text-2xl font-bold">
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Comissão</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myReferrals.map((referral) => (
                        <TableRow key={referral.id}>
                          <TableCell>{referral.fullName}</TableCell>
                          <TableCell>{referral.phone}</TableCell>
                          <TableCell>{getStatusBadge(referral.status)}</TableCell>
                          <TableCell>
                            R$ {referral.commissionIndicator ? parseFloat(referral.commissionIndicator).toFixed(2) : '0.00'}
                          </TableCell>
                          <TableCell>
                            {new Date(referral.createdAt).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sua Comissão</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamReferrals.map((referral) => {
                        const registered = referral.status !== 'rejected' ? 1.0 : 0;
                        const converted = referral.status === 'converted' || referral.status === 'paid' ? 10.0 : 0;
                        const commission = registered + converted;
                        
                        return (
                          <TableRow key={referral.id}>
                            <TableCell>
                              {indicadores.find(i => i.id === referral.userId)?.fullName || 'Indicador'}
                            </TableCell>
                            <TableCell>{referral.fullName}</TableCell>
                            <TableCell>{referral.phone}</TableCell>
                            <TableCell>{getStatusBadge(referral.status)}</TableCell>
                            <TableCell>
                              <div>
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
                            <TableCell>
                              {new Date(referral.createdAt).toLocaleDateString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indicadores" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Meus Indicadores</CardTitle>
                <CardDescription>
                  Gerencie os indicadores em sua rede
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingIndicadores ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : indicadores.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum indicador cadastrado ainda
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Indicações</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {indicadores.map((indicador) => {
                        const indicadorReferrals = teamReferrals.filter(r => r.userId === indicador.id);
                        const totalReferrals = indicadorReferrals.length;
                        
                        return (
                          <TableRow key={indicador.id}>
                            <TableCell className="font-medium">{indicador.fullName}</TableCell>
                            <TableCell>{indicador.email}</TableCell>
                            <TableCell>{indicador.phone}</TableCell>
                            <TableCell>{totalReferrals}</TableCell>
                            <TableCell>R$ {parseFloat(indicador.balance || "0").toFixed(2)}</TableCell>
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
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
}