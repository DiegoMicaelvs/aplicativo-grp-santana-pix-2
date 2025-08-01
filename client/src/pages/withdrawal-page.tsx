import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DollarSign, CreditCard, History, AlertCircle, CheckCircle, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BackButton } from "@/components/ui/back-button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { createWithdrawalRequestSchema } from "@shared/schema";
import type { WithdrawalRequest } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

export default function WithdrawalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data: withdrawalRequests = [], isLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/withdrawals"]
  });

  const form = useForm({
    resolver: zodResolver(createWithdrawalRequestSchema),
    defaultValues: {
      amount: "",
      pixKey: "",
      cpfKey: ""
    }
  });

  const createWithdrawal = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/withdrawals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar solicitação de saque");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitação criada!",
        description: "Sua solicitação de saque foi enviada para análise."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      form.reset();
      setShowForm(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: any) => {
    createWithdrawal.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'approved': return 'Aprovado';
      case 'paid': return 'Pago';
      case 'rejected': return 'Rejeitado';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <X className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const availableBalance = parseFloat(user?.balance || '0');
  const minWithdrawal = 0.01; // Permite sacar qualquer valor disponível

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <BackButton />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Saques</h1>
              <p className="text-gray-600 mt-2">Solicite o saque dos seus ganhos</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Balance and Withdrawal Form */}
          <div className="space-y-6">
            {/* Balance Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Saldo Disponível
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 mb-2">
                  R$ {availableBalance.toFixed(2)}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Você pode sacar todo o saldo disponível
                </p>
                
                {availableBalance >= minWithdrawal ? (
                  <Button 
                    onClick={() => setShowForm(!showForm)}
                    className="w-full"
                    disabled={createWithdrawal.isPending}
                  >
                    {showForm ? 'Cancelar Solicitação' : 'Solicitar Saque'}
                  </Button>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Saldo insuficiente para saque. Continue indicando clientes para aumentar seus ganhos!
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Withdrawal Form */}
            {showForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Nova Solicitação de Saque
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor do Saque</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min={minWithdrawal}
                                max={availableBalance}
                                placeholder="50.00"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Você pode sacar até R$ {availableBalance.toFixed(2)}
                            </FormDescription>
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
                              <Input
                                placeholder="Digite sua chave PIX"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Chave PIX para recebimento (CPF, telefone, e-mail ou chave aleatória)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="cpfKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF do Titular</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="000.000.000-00"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Deve ser o mesmo CPF cadastrado no seu perfil
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          O saque será processado em até 2 dias úteis após aprovação.
                          Verifique se os dados estão corretos antes de confirmar.
                        </AlertDescription>
                      </Alert>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createWithdrawal.isPending}
                      >
                        {createWithdrawal.isPending ? "Processando..." : "Confirmar Solicitação"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Withdrawal History */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Saques
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Carregando histórico...</p>
                  </div>
                ) : withdrawalRequests.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withdrawalRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              {format(new Date(request.requestedAt), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-medium">
                              R$ {parseFloat(request.amount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge className={`flex items-center gap-1 ${getStatusColor(request.status)}`}>
                                {getStatusIcon(request.status)}
                                {getStatusLabel(request.status)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhum saque solicitado ainda.</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Suas solicitações de saque aparecerão aqui.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}