import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Clock, DollarSign, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { Referral, ReferralStatus } from "@shared/schema";
import { PromotionalAlert } from "@/components/promotional-alert";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Validation schema for indicator registration
const indicatorSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(14, "CPF inválido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  address: z.string().min(5, "Endereço deve ter pelo menos 5 caracteres"),
  shirtSize: z.enum(["PP", "P", "M", "G", "GG", "XG"], {
    required_error: "Selecione um tamanho",
  }),
  pixKey: z.string().min(5, "Chave PIX é obrigatória"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type IndicatorFormData = z.infer<typeof indicatorSchema>;

export default function DashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isIndicatorDialogOpen, setIsIndicatorDialogOpen] = useState(false);

  // Form for creating indicators
  const indicatorForm = useForm<IndicatorFormData>({
    resolver: zodResolver(indicatorSchema),
    defaultValues: {
      fullName: "",
      cpf: "",
      email: "",
      phone: "",
      address: "",
      shirtSize: "M",
      pixKey: "",
      password: "",
    },
  });

  const createIndicatorMutation = useMutation({
    mutationFn: async (data: IndicatorFormData) => {
      const payload = {
        ...data,
        username: data.email, // Use email as username
        role: "indicador" as const,
      };
      return await apiRequest('/api/admin/users', 'POST', payload);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Indicador cadastrado com sucesso.",
      });
      indicatorForm.reset();
      setIsIndicatorDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/promoter/indicators'] });
    },
    onError: (error: any) => {
      console.error('Error creating indicator:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao cadastrar indicador.",
        variant: "destructive",
      });
    },
  });

  const onSubmitIndicator = (data: IndicatorFormData) => {
    createIndicatorMutation.mutate(data);
  };

  // Redirect users to their specific dashboards based on role (but allow promotor to use main dashboard too)
  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        setLocation("/admin");
        return;
      } else if (user.role === "vendedor") {
        setLocation("/vendedor");
        return;
      }
      // promotor, indicador and analista users stay on main dashboard
    }
  }, [user, setLocation]);
  
  // Fetch referrals for the current user
  const { data: referrals, isLoading: isLoadingReferrals } = useQuery<Referral[]>({
    queryKey: ['/api/referrals'],
  });

  // Calculate statistics
  const totalReferrals = referrals?.length || 0;
  const convertedReferrals = referrals?.filter(r => r.status === 'converted').length || 0;
  const conversionRate = totalReferrals > 0 ? Math.round((convertedReferrals / totalReferrals) * 100) : 0;
  const totalEarnings = referrals?.reduce((sum, r) => {
    const commission = r.commissionIndicator ? parseFloat(r.commissionIndicator) : 0;
    return sum + commission;
  }, 0) || 0;
  
  // Get recent referrals (up to 5)
  const recentReferrals = referrals?.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  // Helper function to get appropriate badge color based on status
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
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  // Format date to Brazilian format
  const formatDate = (dateStr: string | Date) => {
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="bg-gray-100 flex-grow">
        <div className="py-10">
          <header>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold leading-tight text-gray-900 font-heading">Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Bem-vindo, {user?.fullName}! Veja o resumo da sua atividade como indicador.
              </p>
            </div>
          </header>
          
          <main>
            <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
              <div className="px-4 py-8 sm:px-0">
                <PromotionalAlert />
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
                  {/* Total Referrals Card */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-primary rounded-md p-3">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <div className="text-sm font-medium text-gray-500 truncate">Total de Indicações</div>
                          <div className="text-lg font-medium text-gray-900">{totalReferrals}</div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <Link href="/referrals">
                          <Button variant="link" className="text-primary p-0">Ver todas</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Converted Referrals Card */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                          <Clock className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <div className="text-sm font-medium text-gray-500 truncate">Indicações Convertidas</div>
                          <div className="text-lg font-medium text-gray-900">{convertedReferrals}</div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <Link href="/referrals?status=converted">
                          <Button variant="link" className="text-primary p-0">Ver detalhes</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Conversion Rate Card */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                          <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <div className="text-sm font-medium text-gray-500 truncate">Taxa de Conversão</div>
                          <div className="text-lg font-medium text-gray-900">{conversionRate}%</div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <div className="text-xs text-gray-500">
                          Percentual de indicações convertidas em vendas
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Current Balance Card */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-600 rounded-md p-3">
                          <DollarSign className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <div className="text-sm font-medium text-gray-500 truncate">Saldo Disponível</div>
                          <div className="text-lg font-medium text-gray-900">{formatCurrency(user?.balance || 0)}</div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <Link href="/withdrawals">
                          <Button variant="link" className="text-primary p-0">Solicitar saque</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Earnings Card */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-accent rounded-md p-3">
                          <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <div className="text-sm font-medium text-gray-500 truncate">Total de Ganhos</div>
                          <div className="text-lg font-medium text-gray-900">{formatCurrency(user?.totalEarnings || 0)}</div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <Link href="/earnings">
                          <Button variant="link" className="text-primary p-0">Ver histórico</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Referrals Table */}
                <div className="mt-8">
                  <h2 className="text-lg font-medium text-gray-900 font-heading">Indicações Recentes</h2>
                  <div className="mt-4 bg-white shadow overflow-hidden rounded-lg">
                    {isLoadingReferrals ? (
                      <div className="p-6 text-center">Carregando indicações...</div>
                    ) : recentReferrals && recentReferrals.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Indicado</TableHead>
                            <TableHead>Veículo</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Comissão</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentReferrals.map((referral) => (
                            <TableRow key={referral.id}>
                              <TableCell>
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold">
                                    {referral.fullName.charAt(0)}{referral.fullName.split(' ').length > 1 ? referral.fullName.split(' ')[1].charAt(0) : ''}
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{referral.fullName}</div>
                                    <div className="text-sm text-gray-500">{referral.phone}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-gray-900">Placa: {referral.licensePlate}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-gray-900">{formatDate(referral.createdAt)}</div>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(referral.status)}
                              </TableCell>
                              <TableCell>
                                {referral.commissionIndicator 
                                  ? formatCurrency(referral.commissionIndicator) 
                                  : referral.status === 'rejected' 
                                    ? '-' 
                                    : 'Pendente'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-6 text-center text-gray-500">
                        Você ainda não tem indicações. Que tal começar a indicar agora?
                      </div>
                    )}
                  </div>
                </div>

                {/* New Referral Card */}
                <div className="mt-8 bg-white shadow rounded-lg">
                  <div className="px-6 py-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 font-heading">
                      Nova Indicação
                    </h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500">
                      <p>
                        Indique alguém que precise de seguro para seu veículo e ganhe comissão.
                      </p>
                    </div>
                    <div className="mt-5 flex gap-4">
                      <Link href="/new-referral">
                        <Button>Fazer Nova Indicação</Button>
                      </Link>
                      {user?.role === "promotor" && (
                        <>
                          <Link href="/promoter-dashboard">
                            <Button variant="outline">Dashboard Promotor</Button>
                          </Link>
                          <Dialog open={isIndicatorDialogOpen} onOpenChange={setIsIndicatorDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Cadastrar Indicador
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Cadastrar Novo Indicador</DialogTitle>
                                <DialogDescription>
                                  Cadastre um novo indicador em sua rede. Você receberá R$ 1,00 por cada indicação registrada e R$ 10,00 por cada venda fechada.
                                </DialogDescription>
                              </DialogHeader>
                              
                              <Form {...indicatorForm}>
                                <form onSubmit={indicatorForm.handleSubmit(onSubmitIndicator)} className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                      control={indicatorForm.control}
                                      name="fullName"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Nome Completo</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Digite o nome completo" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={indicatorForm.control}
                                      name="cpf"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>CPF</FormLabel>
                                          <FormControl>
                                            <Input placeholder="000.000.000-00" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                      control={indicatorForm.control}
                                      name="email"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Email</FormLabel>
                                          <FormControl>
                                            <Input type="email" placeholder="email@exemplo.com" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={indicatorForm.control}
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
                                  </div>

                                  <FormField
                                    control={indicatorForm.control}
                                    name="address"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Endereço</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Rua, número, bairro, cidade" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                      control={indicatorForm.control}
                                      name="shirtSize"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Tamanho da Camisa</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
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
                                      control={indicatorForm.control}
                                      name="pixKey"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Chave PIX</FormLabel>
                                          <FormControl>
                                            <Input placeholder="CPF, email, telefone ou chave aleatória" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <FormField
                                    control={indicatorForm.control}
                                    name="password"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Senha</FormLabel>
                                        <FormControl>
                                          <Input type="password" placeholder="Senha de acesso (mín. 6 caracteres)" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <div className="flex gap-4">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setIsIndicatorDialogOpen(false)}
                                      className="flex-1"
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      type="submit"
                                      disabled={createIndicatorMutation.isPending}
                                      className="flex-1"
                                    >
                                      {createIndicatorMutation.isPending ? "Cadastrando..." : "Cadastrar Indicador"}
                                    </Button>
                                  </div>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
