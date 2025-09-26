import { useState, useRef, useEffect } from "react";
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
import { Check, Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PromotionalAlert } from "@/components/promotional-alert";
import { BackButton } from "@/components/ui/back-button";
import { CreateReferral, Company } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

// Lista de estados brasileiros em ordem alfabética
const BRAZILIAN_STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

// Define validation schema with multiple license plates support
const referralSchema = z.object({
  fullName: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(10, "Número é obrigatório").max(15, "Número inválido"),
  licensePlates: z.array(z.string().min(7, "Placa do veículo é obrigatória").max(8, "Placa do veículo inválida"))
    .min(1, "Pelo menos uma placa é obrigatória")
    .max(5, "Máximo 5 placas por indicação"),
  hasInsurance: z.boolean(),
  companyId: z.coerce.number().positive("Empresa é obrigatória"), // Company ID determined by tenant
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z.string().length(2, "Selecione um estado"),
});

type ReferralFormValues = z.infer<typeof referralSchema>;

export default function NewReferralPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [isCustomCompany, setIsCustomCompany] = useState(false);
  const [customCompanyName, setCustomCompanyName] = useState("");
  const duplicateAlertRef = useRef<HTMLDivElement>(null);
  
  // Fetch current tenant config for company identification
  const { data: tenantConfig } = useQuery<{tenant: string, companyId: number, companyName: string}>({
    queryKey: ['/api/tenant'],
  });
  
  const form = useForm<ReferralFormValues>({
    resolver: zodResolver(referralSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      licensePlates: [""], // Start with one empty plate
      hasInsurance: false,
      companyId: user?.role === "admin" ? 0 : 1, // Will be updated by useEffect for non-admin users
      city: "",
      state: "",
    },
  });

  // Update form companyId when tenantConfig loads (for non-admin users)
  useEffect(() => {
    if (tenantConfig && user?.role !== "admin") {
      form.setValue("companyId", tenantConfig.companyId);
    }
  }, [tenantConfig, user?.role, form]);

  // Scroll para o alerta de duplicata quando detectado
  useEffect(() => {
    if (duplicateInfo && duplicateInfo.length > 0 && duplicateAlertRef.current) {
      // Aguarda um momento para o DOM renderizar
      setTimeout(() => {
        duplicateAlertRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Adiciona uma animação de destaque
        duplicateAlertRef.current?.classList.add('animate-pulse');
        
        // Remove a animação após 3 segundos
        setTimeout(() => {
          duplicateAlertRef.current?.classList.remove('animate-pulse');
        }, 3000);
      }, 100);
    }
  }, [duplicateInfo]);

  // Fetch available companies for selection
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Fetch today's referral stats
  const { data: todayStats } = useQuery<any>({
    queryKey: ['/api/referrals/today-stats'],
  });

  // Mutation para verificar duplicatas (suporte a múltiplas placas)
  const checkDuplicateMutation = useMutation<any, Error, { phone: string; licensePlates: string[]; formData: ReferralFormValues }>({
    mutationFn: async ({ phone, licensePlates }) => {
      const res = await apiRequest("POST", "/api/referrals/check-duplicate", { phone, licensePlates });
      return await res.json();
    },
    onSuccess: (data, variables) => {
      if (data.isDuplicate) {
        setDuplicateInfo(data.duplicates);
      } else {
        setDuplicateInfo(null);
        // Se não há duplicatas, proceder com o cadastro usando os dados modificados
        mutation.mutate(variables.formData as any);
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
  
  // Mutation para criar nova empresa
  const createCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/companies", { name, isActive: true });
      return await res.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar empresa",
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
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
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
  
  const onSubmit = async (data: ReferralFormValues) => {
    // Company ID is automatically enforced by server based on tenant for non-admin users
    
    // Validar se é empresa customizada
    if (isCustomCompany) {
      if (!customCompanyName.trim()) {
        toast({
          title: "Nome da empresa obrigatório",
          description: "Por favor, digite o nome da nova empresa.",
          variant: "destructive",
        });
        return;
      }
      
      // Se o usuário é admin, criar a empresa
      if (user?.role === "admin") {
        try {
          const newCompany = await createCompanyMutation.mutateAsync(customCompanyName);
          // Atualizar o companyId com a nova empresa
          data.companyId = newCompany.id as any;
        } catch (error) {
          // Se falhar ao criar empresa, parar o processo
          return;
        }
      } else {
        toast({
          title: "Permissão negada",
          description: "Apenas administradores podem adicionar novas empresas.",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Validar se uma empresa foi selecionada
      if (!data.companyId || data.companyId === 0) {
        toast({
          title: "Empresa obrigatória",
          description: "Por favor, selecione uma empresa.",
          variant: "destructive",
        });
        return;
      }
    }

    // Filtrar placas vazias
    const validPlates = data.licensePlates.filter(plate => plate.trim() !== "");
    if (validPlates.length === 0) {
      toast({
        title: "Placa obrigatória",
        description: "Por favor, adicione pelo menos uma placa de veículo.",
        variant: "destructive",
      });
      return;
    }

    // Atualizar dados com placas válidas
    const finalData = { ...data, licensePlates: validPlates };

    // Se já há duplicatas conhecidas, pular verificação e enviar diretamente
    if (duplicateInfo && duplicateInfo.length > 0) {
      mutation.mutate(finalData as any);
    } else {
      // Primeiro verifica se há duplicatas, passando os dados modificados
      checkDuplicateMutation.mutate({
        phone: finalData.phone,
        licensePlates: finalData.licensePlates,
        formData: finalData
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
              <div className="space-y-4 mb-6">
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <div className="font-semibold mb-2">🔒 Sistema de Segurança</div>
                    <div className="text-sm space-y-1">
                      {user?.role === 'indicador_nivel_1' ? (
                        <p>• <strong>Limite diário:</strong> Ilimitado ⭐</p>
                      ) : (
                        <p>• <strong>Limite diário:</strong> Máximo 50 cadastros</p>
                      )}
                      <p>• <strong>Sem duplicatas:</strong> Telefone e placa únicos</p>
                      <p>• <strong>Proteção automática</strong> contra fraudes</p>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Contador de cadastros diários */}
                {user?.role === 'indicador_nivel_1' ? (
                  <Alert className="border-2 border-purple-200 bg-purple-50">
                    <Check className="h-4 w-4 text-purple-600" />
                    <AlertDescription className="text-purple-800">
                      <div className="font-semibold mb-2">📊 Suas Indicações Hoje</div>
                      <div className="text-lg font-bold">
                        {todayStats?.count || 0} indicações
                      </div>
                      <div className="text-sm">
                        Perfil Indicador Nível 1 - Sem limites! ⭐
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div className="h-2 rounded-full bg-purple-500 w-full"></div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className={`border-2 ${todayStats?.count >= 45 ? 'border-red-200 bg-red-50' : todayStats?.count >= 40 ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
                    <Check className={`h-4 w-4 ${todayStats?.count >= 45 ? 'text-red-600' : todayStats?.count >= 40 ? 'text-yellow-600' : 'text-green-600'}`} />
                    <AlertDescription className={todayStats?.count >= 45 ? 'text-red-800' : todayStats?.count >= 40 ? 'text-yellow-800' : 'text-green-800'}>
                      <div className="font-semibold mb-2">📊 Cadastros de Hoje</div>
                      <div className="text-lg font-bold">
                        {todayStats?.count || 0} / 50
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
                          className={`h-2 rounded-full transition-all ${todayStats?.count >= 45 ? 'bg-red-500' : todayStats?.count >= 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, ((todayStats?.count || 0) / 50) * 100)}%` }}
                        ></div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Alerta de duplicatas */}
              {duplicateInfo && duplicateInfo.length > 0 && (
                <div ref={duplicateAlertRef}>
                  <Alert className="mb-6 border-red-200 bg-red-50 shadow-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                    <div className="font-semibold mb-2">⚠️ Cadastro já existe!</div>
                    {duplicateInfo.map((duplicate: any, index: number) => {
                      const currentPlates = form.getValues().licensePlates || [];
                      return (
                        <div key={index} className="mb-2">
                          {duplicate.phone === form.getValues().phone && (
                            <p className="text-sm">
                              O telefone <strong>{duplicate.phone}</strong> já foi cadastrado por{" "}
                              <strong>{duplicate.ownerFirstName}</strong>
                              {duplicate.ownerState && <span> ({duplicate.ownerState})</span>}
                            </p>
                          )}
                          {duplicate.licensePlate && currentPlates.includes(duplicate.licensePlate) && (
                            <p className="text-sm">
                              A placa <strong>{duplicate.licensePlate}</strong> já foi cadastrada por{" "}
                              <strong>{duplicate.ownerFirstName}</strong>
                              {duplicate.ownerState && <span> ({duplicate.ownerState})</span>}
                            </p>
                          )}
                          <p className="text-xs text-gray-600 mt-1">
                            Data do primeiro cadastro: {new Date(duplicate.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      );
                    })}
                    <p className="text-sm mt-3 font-medium">
                      ⚠️ Atenção: Este cadastro pode ser uma duplicata. Certifique-se que os dados estão corretos antes de prosseguir.
                    </p>
                    <p className="text-xs mt-1 text-red-600">
                      Clique em "Enviar Indicação" para prosseguir mesmo assim (sujeito à aprovação administrativa).
                    </p>
                  </AlertDescription>
                </Alert>
                </div>
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

                    {/* Placas dos veículos (múltiplas) */}
                    <FormField
                      control={form.control}
                      name="licensePlates"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Placas dos Veículos</FormLabel>
                          <div className="space-y-3">
                            {(Array.isArray(field.value) ? field.value : [""]).map((plate, index) => (
                              <div key={index} className="flex gap-2 items-center">
                                <FormControl>
                                  <Input 
                                    placeholder="ABC-1234" 
                                    value={plate}
                                    onChange={(e) => {
                                      const newPlates = [...field.value];
                                      newPlates[index] = e.target.value.toUpperCase();
                                      field.onChange(newPlates);
                                    }}
                                    className="flex-1"
                                  />
                                </FormControl>
                                {field.value.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const newPlates = field.value.filter((_, i) => i !== index);
                                      field.onChange(newPlates);
                                    }}
                                    className="px-3"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            {field.value.length < 5 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newPlates = [...field.value, ""];
                                  field.onChange(newPlates);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" />
                                Adicionar outra placa
                              </Button>
                            )}
                          </div>
                          <FormDescription>
                            Adicione as placas de todos os veículos que o cliente possui (máximo 5)
                          </FormDescription>
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
                          {user?.role === "admin" ? (
                            <>
                              <Select 
                                onValueChange={(value) => {
                                  if (value === "custom") {
                                    setIsCustomCompany(true);
                                    field.onChange(""); // Clear the company ID when selecting custom
                                  } else {
                                    setIsCustomCompany(false);
                                    setCustomCompanyName("");
                                    field.onChange(parseInt(value));
                                  }
                                }}
                                value={isCustomCompany ? "custom" : field.value?.toString() || ""}
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
                                    <>
                                      {companies.map((company) => (
                                        <SelectItem key={company.id} value={company.id.toString()}>
                                          {company.name}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="custom">
                                        + Adicionar nova empresa
                                      </SelectItem>
                                    </>
                                  ) : (
                                    <>
                                      <SelectItem value="none" disabled>Nenhuma empresa disponível</SelectItem>
                                      <SelectItem value="custom">
                                        + Adicionar nova empresa
                                      </SelectItem>
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                              {isCustomCompany && (
                                <div className="mt-2">
                                  <Input
                                    placeholder="Digite o nome da nova empresa"
                                    value={customCompanyName}
                                    onChange={(e) => setCustomCompanyName(e.target.value)}
                                  />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="mt-2">
                              <Input 
                                value={tenantConfig?.companyName || "Grupo Santana"} 
                                disabled 
                                className="bg-gray-50"
                              />
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Seção de Localização */}
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Localização da Indicação</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Informe a cidade e o estado onde foi feita esta indicação. 
                        Essas informações nos ajudam a entender melhor a distribuição geográfica das indicações.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Cidade */}
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cidade</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: São Paulo" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Estado */}
                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estado</FormLabel>
                              <Select 
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o estado" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {BRAZILIAN_STATES.map((state) => (
                                    <SelectItem key={state.value} value={state.value}>
                                      {state.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
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
