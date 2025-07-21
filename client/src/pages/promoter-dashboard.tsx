import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, TrendingUp, DollarSign } from "lucide-react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createIndicadorSchema, type CreateIndicador, type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function PromoterDashboard() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch indicadores under this promoter
  const { data: indicadores = [], isLoading: isLoadingIndicadores } = useQuery({
    queryKey: ["/api/users/indicadores"],
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
  const totalCommissions = parseFloat(currentUser?.balance || "0");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Painel do Promotor</h1>
          <p className="text-gray-600">Gerencie sua rede de indicadores</p>
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
                Crie um novo indicador em sua rede. Você receberá comissões pelas indicações validadas e convertidas.
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <CardTitle className="text-sm font-medium">Comissões Acumuladas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalCommissions.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              R$1 por validação, R$10 por conversão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicadores Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeIndicadores}</div>
            <p className="text-xs text-muted-foreground">
              de {totalIndicadores} cadastrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Indicadores List */}
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
            <div className="space-y-4">
              {indicadores.map((indicador: User) => (
                <div
                  key={indicador.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <h3 className="font-medium">{indicador.fullName}</h3>
                      <p className="text-sm text-gray-500">{indicador.email}</p>
                      <p className="text-sm text-gray-500">
                        Saldo: R$ {parseFloat(indicador.balance || "0").toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={indicador.isActive ? "default" : "secondary"}>
                      {indicador.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}