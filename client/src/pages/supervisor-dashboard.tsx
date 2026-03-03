import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, DollarSign, UserCheck, Edit2, Check, X } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const createIndicadorSchema = z.object({
  fullName: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  cpf: z.string().min(11, "CPF inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  pixKey: z.string().min(3, "Chave PIX é obrigatória"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  commissionValidated: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Valor inválido"),
  commissionConverted: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Valor inválido"),
});

type CreateIndicadorForm = z.infer<typeof createIndicadorSchema>;

const statusLabels: Record<string, string> = {
  pending: "Pendente", analyzing: "Em Análise", validated: "Validado",
  converted: "Convertido", rejected: "Rejeitado", paid: "Pago",
  false: "Falso", not_validated: "Não Validado", not_converted: "Não Convertido",
};
const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800", analyzing: "bg-blue-100 text-blue-800",
  validated: "bg-green-100 text-green-800", converted: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800", paid: "bg-emerald-100 text-emerald-800",
  false: "bg-gray-100 text-gray-800", not_validated: "bg-orange-100 text-orange-800",
  not_converted: "bg-rose-100 text-rose-800",
};

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ commissionValidated: "", commissionConverted: "" });

  const { data: supervisorInfo } = useQuery<any>({
    queryKey: ["/api/supervisor/info"],
  });

  const { data: team = [], isLoading: isLoadingTeam } = useQuery<any[]>({
    queryKey: ["/api/supervisor/team"],
  });

  const { data: referrals = [], isLoading: isLoadingReferrals } = useQuery<any[]>({
    queryKey: ["/api/supervisor/referrals"],
  });

  const myAllocationValidated = supervisorInfo?.commissionValidated ? parseFloat(supervisorInfo.commissionValidated) : 0;
  const myAllocationConverted = supervisorInfo?.commissionConverted ? parseFloat(supervisorInfo.commissionConverted) : 0;

  const totalIndicadores = team.length;
  const totalReferrals = referrals.length;
  const validatedReferrals = referrals.filter((r: any) => r.status === 'validated' || r.status === 'converted' || r.status === 'paid').length;
  const totalEarnings = referrals.reduce((sum: number, r: any) => sum + parseFloat(r.commissionSupervisor || '0'), 0);

  const form = useForm<CreateIndicadorForm>({
    resolver: zodResolver(createIndicadorSchema),
    defaultValues: {
      fullName: "", email: "", cpf: "", phone: "", pixKey: "", password: "",
      commissionValidated: "0", commissionConverted: "0",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateIndicadorForm) => {
      const res = await apiRequest("POST", "/api/supervisor/indicators", {
        ...data,
        username: data.email,
        commissionValidated: parseFloat(data.commissionValidated),
        commissionConverted: parseFloat(data.commissionConverted),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao criar indicador");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/team"] });
      toast({ title: "Sucesso", description: "Indicador criado com sucesso!" });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const updateCommissionMutation = useMutation({
    mutationFn: async ({ userId, commissionValidated, commissionConverted }: { userId: number; commissionValidated: string; commissionConverted: string }) => {
      const res = await apiRequest("PATCH", `/api/promoter/users/${userId}/commissions`, {
        commissionValidated: parseFloat(commissionValidated),
        commissionConverted: parseFloat(commissionConverted),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao atualizar comissões");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/team"] });
      toast({ title: "Sucesso", description: "Comissões atualizadas!" });
      setEditingId(null);
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateIndicadorForm) => {
    createMutation.mutate(data);
  };

  const startEdit = (ind: any) => {
    setEditingId(ind.id);
    setEditValues({
      commissionValidated: ind.commissionValidated || "0",
      commissionConverted: ind.commissionConverted || "0",
    });
  };

  const saveEdit = (userId: number) => {
    updateCommissionMutation.mutate({ userId, ...editValues });
  };

  const formatCurrency = (val: any) => {
    const num = parseFloat(val?.toString() || "0");
    return isNaN(num) ? "R$ 0,00" : `R$ ${num.toFixed(2).replace(".", ",")}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Painel do Supervisor</h1>
          <p className="text-sm text-gray-600 mt-1">Gerencie sua equipe de indicadores</p>
          {supervisorInfo && (
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="text-gray-600">
                Sua alocação por cadastro validado: <strong className="text-green-600">{formatCurrency(myAllocationValidated)}</strong>
              </span>
              <span className="text-gray-600">
                Sua alocação por cadastro convertido: <strong className="text-purple-600">{formatCurrency(myAllocationConverted)}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-gray-500">Indicadores</span>
              </div>
              <p className="text-2xl font-bold">{totalIndicadores}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="h-4 w-4 text-green-500" />
                <span className="text-xs text-gray-500">Validados</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{validatedReferrals}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-gray-500">Total Indicações</span>
              </div>
              <p className="text-2xl font-bold">{totalReferrals}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-gray-500">Ganhos</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalEarnings)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Minha Equipe</CardTitle>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <PlusCircle className="h-4 w-4 mr-1" /> Cadastrar Indicador
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Novo Indicador</DialogTitle>
                    <DialogDescription>
                      Defina as comissões dentro da sua alocação: validado até {formatCurrency(myAllocationValidated)}, convertido até {formatCurrency(myAllocationConverted)}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="fullName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="cpf" render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl><Input {...field} placeholder="000.000.000-00" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl><Input type="email" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl><Input {...field} placeholder="(11) 99999-9999" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="pixKey" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Chave PIX</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="password" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl><Input type="password" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="border rounded-lg p-3 bg-blue-50">
                        <p className="text-xs font-semibold text-blue-800 mb-2">Comissão do Indicador</p>
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={form.control} name="commissionValidated" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Por validado (máx {formatCurrency(myAllocationValidated)})</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-2 top-2 text-xs text-gray-500">R$</span>
                                  <Input type="number" step="0.01" min="0" max={myAllocationValidated} className="pl-7" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="commissionConverted" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Por convertido (máx {formatCurrency(myAllocationConverted)})</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-2 top-2 text-xs text-gray-500">R$</span>
                                  <Input type="number" step="0.01" min="0" max={myAllocationConverted} className="pl-7" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                        {createMutation.isPending ? "Criando..." : "Criar Indicador"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingTeam ? (
                <p className="text-sm text-gray-500 text-center py-4">Carregando...</p>
              ) : team.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Nenhum indicador cadastrado ainda</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-center">Validado</TableHead>
                        <TableHead className="text-center">Convertido</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team.map((ind: any) => (
                        <TableRow key={ind.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{ind.fullName}</p>
                            <p className="text-xs text-gray-500">{ind.email}</p>
                          </TableCell>
                          {editingId === ind.id ? (
                            <>
                              <TableCell>
                                <div className="relative">
                                  <span className="absolute left-1 top-1.5 text-xs text-gray-400">R$</span>
                                  <Input
                                    type="number" step="0.01" min="0" max={myAllocationValidated}
                                    className="pl-6 h-7 text-xs w-20"
                                    value={editValues.commissionValidated}
                                    onChange={e => setEditValues(prev => ({ ...prev, commissionValidated: e.target.value }))}
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="relative">
                                  <span className="absolute left-1 top-1.5 text-xs text-gray-400">R$</span>
                                  <Input
                                    type="number" step="0.01" min="0" max={myAllocationConverted}
                                    className="pl-6 h-7 text-xs w-20"
                                    value={editValues.commissionConverted}
                                    onChange={e => setEditValues(prev => ({ ...prev, commissionConverted: e.target.value }))}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-1">
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(ind.id)}>
                                    <Check className="h-3 w-3 text-green-600" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                                    <X className="h-3 w-3 text-red-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-center text-sm">{formatCurrency(ind.commissionValidated)}</TableCell>
                              <TableCell className="text-center text-sm">{formatCurrency(ind.commissionConverted)}</TableCell>
                              <TableCell className="text-center">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(ind)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Indicações da Equipe</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingReferrals ? (
                <p className="text-sm text-gray-500 text-center py-4">Carregando...</p>
              ) : referrals.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Nenhuma indicação ainda</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Minha Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrals.slice(0, 20).map((ref: any) => (
                        <TableRow key={ref.id}>
                          <TableCell>
                            <p className="text-sm font-medium">{ref.fullName}</p>
                            <p className="text-xs text-gray-400">{ref.createdAt ? format(new Date(ref.createdAt), "dd/MM/yy", { locale: ptBR }) : ""}</p>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[ref.status] || "bg-gray-100 text-gray-700"}`}>
                              {statusLabels[ref.status] || ref.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-emerald-600">
                            {formatCurrency(ref.commissionSupervisor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {referrals.length > 20 && (
                    <p className="text-xs text-gray-500 text-center mt-2">Mostrando 20 de {referrals.length} indicações</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
