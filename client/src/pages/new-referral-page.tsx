import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PromotionalAlert } from "@/components/promotional-alert";
import { BackButton } from "@/components/ui/back-button";
import { CreateReferral, Company } from "@shared/schema";

// Define validation schema matching the exact fields requested
const referralSchema = z.object({
  fullName: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(10, "Número é obrigatório").max(15, "Número inválido"),
  licensePlate: z.string().min(7, "Placa do veículo é obrigatória").max(8, "Placa do veículo inválida"),
  hasInsurance: z.boolean(),
  companyId: z.string().min(1, "Selecione uma empresa").transform(val => Number(val)),
});

type ReferralFormValues = z.infer<typeof referralSchema>;

export default function NewReferralPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  
  const form = useForm<ReferralFormValues>({
    resolver: zodResolver(referralSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      licensePlate: "",
      hasInsurance: false,
      companyId: "",
    },
  });

  // Fetch available companies for selection
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Fetch today's referral stats
  const { data: todayStats } = useQuery({
    queryKey: ['/api/referrals/today-stats'],
  });

  // Mutation para verificar duplicatas
  const checkDuplicateMutation = useMutation({
    mutationFn: async (data: { phone: string, licensePlate: string }) => {
      const res = await apiRequest("POST", "/api/referrals/check-duplicate", data);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.isDuplicate) {
        setDuplicateInfo(data.existingReferrals);
      } else {
        setDuplicateInfo(null);
        // Se não há duplicatas, proceder com o cadastro
        mutation.mutate(form.getValues());
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao verificar duplicatas",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const mutation = useMutation({
    mutationFn: async (data: CreateReferral) => {
      const res = await apiRequest("POST", "/api/referrals", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/referrals'] });
      setSubmitted(true);
      toast({
        title: "Indicação enviada com sucesso!",
        description: "Você será notificado sobre o status da sua indicação.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar indicação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: ReferralFormValues) => {
    // Se já há duplicatas conhecidas, pular verificação e enviar diretamente
    if (duplicateInfo && duplicateInfo.length > 0) {
      mutation.mutate(data as CreateReferral);
    } else {
      // Primeiro verifica se há duplicatas
      checkDuplicateMutation.mutate({
        phone: data.phone,
        licensePlate: data.licensePlate
      });
    }
  };

  const handleForceSave = () => {
    // Força o salvamento mesmo com duplicatas (apenas para demonstração)
    setDuplicateInfo(null);
    toast({
      title: "Atenção",
      description: "Esta funcionalidade está restrita para evitar fraudes.",
      variant: "destructive",
    });
  };
  
  // If form was submitted, show success state
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        
        <div className="flex-grow bg-gray-50 flex items-center justify-center">
          <Card className="max-w-md w-full mx-auto">
            <CardContent className="pt-12 pb-12 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-center mb-4 font-heading">Indicação enviada com sucesso!</CardTitle>
              <CardDescription className="text-center mb-8">
                Nossa equipe entrará em contato com a pessoa indicada em breve. 
                Você será notificado sobre o status da sua indicação.
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Voltar ao Dashboard
                </Button>
                <Button onClick={() => {
                  form.reset();
                  setSubmitted(false);
                }}>
                  Fazer Nova Indicação
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="flex-grow bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <PromotionalAlert />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-heading">Nova Indicação</CardTitle>
                  <CardDescription>
                    Indique alguém que precise de seguro para seu veículo e ganhe comissão quando a indicação virar cliente.
                  </CardDescription>
                </div>
                <BackButton to="/dashboard" />
              </div>
            </CardHeader>
            <CardContent>
              {/* Sistema de Segurança - Regras e Contador */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <div className="font-semibold mb-2">🔒 Sistema de Segurança</div>
                    <div className="text-sm space-y-1">
                      <p>• <strong>Limite diário:</strong> Máximo 30 cadastros</p>
                      <p>• <strong>Sem duplicatas:</strong> Telefone e placa únicos</p>
                      <p>• <strong>Saque mínimo:</strong> R$ 10,00</p>
                      <p>• <strong>Proteção automática</strong> contra fraudes</p>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Contador de cadastros diários */}
                <Alert className={`border-2 ${todayStats?.count >= 25 ? 'border-red-200 bg-red-50' : todayStats?.count >= 20 ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
                  <Check className={`h-4 w-4 ${todayStats?.count >= 25 ? 'text-red-600' : todayStats?.count >= 20 ? 'text-yellow-600' : 'text-green-600'}`} />
                  <AlertDescription className={todayStats?.count >= 25 ? 'text-red-800' : todayStats?.count >= 20 ? 'text-yellow-800' : 'text-green-800'}>
                    <div className="font-semibold mb-2">📊 Cadastros de Hoje</div>
                    <div className="text-lg font-bold">
                      {todayStats?.count || 0} / 30
                    </div>
                    <div className="text-sm">
                      {todayStats?.remaining > 0 ? (
                        `Restam ${todayStats.remaining} cadastros`
                      ) : (
                        "Limite diário atingido"
                      )}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${todayStats?.count >= 25 ? 'bg-red-500' : todayStats?.count >= 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, ((todayStats?.count || 0) / 30) * 100)}%` }}
                      ></div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>

              {/* Alerta de duplicatas */}
              {duplicateInfo && duplicateInfo.length > 0 && (
                <Alert className="mb-6 border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <div className="font-semibold mb-2">⚠️ Cadastro já existe!</div>
                    {duplicateInfo.map((duplicate: any, index: number) => (
                      <div key={index} className="mb-2">
                        {duplicate.phone === form.getValues().phone && (
                          <p className="text-sm">
                            O telefone <strong>{duplicate.phone}</strong> já foi cadastrado por{" "}
                            <strong>{duplicate.user.firstName} {duplicate.user.lastName}</strong> 
                            ({duplicate.user.username})
                          </p>
                        )}
                        {duplicate.licensePlate === form.getValues().licensePlate && (
                          <p className="text-sm">
                            A placa <strong>{duplicate.licensePlate}</strong> já foi cadastrada por{" "}
                            <strong>{duplicate.user.firstName} {duplicate.user.lastName}</strong> 
                            ({duplicate.user.username})
                          </p>
                        )}
                      </div>
                    ))}
                    <p className="text-sm mt-3 font-medium">
                      ⚠️ Atenção: Este cadastro pode ser uma duplicata. Certifique-se que os dados estão corretos antes de prosseguir.
                    </p>
                    <p className="text-xs mt-1 text-red-600">
                      Clique em "Enviar Indicação" para prosseguir mesmo assim (sujeito à aprovação administrativa).
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Dados do Indicado</h3>
                    
                    {/* Nome completo */}
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo do indicado" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Número (telefone) */}
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input placeholder="(xx) xxxxx-xxxx" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Placa do veículo */}
                    <FormField
                      control={form.control}
                      name="licensePlate"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Placa do Veículo</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="ABC-1234" 
                              {...field} 
                              onChange={(e) => {
                                // Convert to uppercase
                                field.onChange(e.target.value.toUpperCase());
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Tem seguro? */}
                    <FormField
                      control={form.control}
                      name="hasInsurance"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Tem seguro?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={(value) => field.onChange(value === "true")}
                              value={field.value ? "true" : "false"}
                              className="flex flex-col space-y-1"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="false" id="no-insurance" />
                                <label htmlFor="no-insurance" className="text-sm font-normal cursor-pointer">
                                  Não
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="true" id="has-insurance" />
                                <label htmlFor="has-insurance" className="text-sm font-normal cursor-pointer">
                                  Sim
                                </label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Empresa */}
                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Empresa</FormLabel>
                          <Select 
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma empresa" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingCompanies ? (
                                <SelectItem value="loading" disabled>Carregando empresas...</SelectItem>
                              ) : companies && companies.length > 0 ? (
                                companies.map((company) => (
                                  <SelectItem key={company.id} value={company.id.toString()}>
                                    {company.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>Nenhuma empresa disponível</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex items-center justify-end space-x-4">
                    {duplicateInfo && duplicateInfo.length > 0 && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setDuplicateInfo(null)}
                      >
                        Editar dados
                      </Button>
                    )}
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => navigate("/dashboard")}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={mutation.isPending || checkDuplicateMutation.isPending}
                    >
                      {checkDuplicateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verificando...
                        </>
                      ) : mutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                          Enviando...
                        </>
                      ) : (
                        "Enviar Indicação"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <div className="mt-8 bg-white shadow overflow-hidden rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Dicas para boas indicações</h3>
              <div className="mt-4 text-sm text-gray-600">
                <ul className="list-disc space-y-2 pl-5">
                  <li>Informe todos os dados corretamente para agilizar o processo.</li>
                  <li>Indique apenas pessoas que realmente não possuam seguro atualmente.</li>
                  <li>Converse com a pessoa antes de indicá-la para garantir que ela tem interesse.</li>
                  <li>Veículos mais novos e bem conservados têm mais chances de aprovação.</li>
                  <li>Avise a pessoa indicada que ela receberá contato do Grupo Santana.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
