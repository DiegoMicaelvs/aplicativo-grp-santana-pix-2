import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { PrivacyPolicyDialog } from "@/components/ui/privacy-policy-dialog";
import { AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCPF } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Registration schema for signup
const signupSchema = z.object({
  email: z.string().email("E-mail inválido").min(1, "E-mail é obrigatório"),
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  cpf: z.string().min(11, "CPF inválido").max(14, "CPF inválido"),
  phone: z.string().min(10, "Telefone inválido").max(15, "Telefone inválido"),
  pixKey: z.string().min(3, "Chave PIX é obrigatória"),
  role: z.enum(["indicador", "promotor"], {
    required_error: "Selecione o tipo de cadastro",
  }),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirme sua senha"),
  terms: z.boolean().refine((val) => val === true, {
    message: "Você deve aceitar os termos e condições",
  }),
  over18: z.boolean().refine((val) => val === true, {
    message: "Você deve ser maior de 18 anos para se cadastrar",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [referralToken, setReferralToken] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  // Check for referral token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refToken = urlParams.get('ref');
    if (refToken) {
      setReferralToken(refToken);
    }
  }, []);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      fullName: "",
      cpf: "",
      phone: "",
      pixKey: "",
      role: "indicador", // Always default to indicador, especially for referral signups
      password: "",
      confirmPassword: "",
      terms: false,
      over18: false,
    },
  });

  // Handle CPF formatting
  const handleCpfChange = (value: string) => {
    const formattedCpf = formatCPF(value);
    form.setValue("cpf", formattedCpf);
  };

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      if (referralToken) {
        // Register with referral attribution
        return apiRequest("POST", "/api/register-with-referral", {
          referralToken,
          userData: {
            ...data,
            username: data.email, // Use email as username
          }
        });
      } else {
        // Regular registration
        return apiRequest("POST", "/api/register", {
          ...data,
          username: data.email, // Use email as username
        });
      }
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Cadastro realizado com sucesso!",
        description: "Aguarde a validação do seu cadastro para começar a indicar.",
      });
      // Redirect to main domain after a few seconds
      setTimeout(() => {
        window.location.href = "https://grp.souindicador.com.br/auth";
      }, 3000);
    },
    onError: (error: any) => {
      console.error("Registration error:", error);
      let errorMessage = "Erro ao realizar cadastro. Tente novamente.";
      
      // Handle specific error responses
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro no cadastro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    console.log("Form submission started with data:", data);
    console.log("Referral token:", referralToken);
    registerMutation.mutate(data);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-600 mb-2">
                  Cadastro Realizado!
                </h2>
                <p className="text-muted-foreground mb-4">
                  Seu cadastro foi enviado com sucesso. Aguarde a validação para começar a indicar.
                </p>
                <p className="text-sm text-muted-foreground">
                  Você será redirecionado para a página de login em instantes...
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-green-600">
                Cadastro Grupo Santana Pix
              </CardTitle>
              <CardDescription>
                {referralToken 
                  ? "Você foi indicado! Complete seu cadastro e comece a ganhar." 
                  : "Faça seu cadastro e comece a indicar pessoas hoje mesmo."
                }
              </CardDescription>
              {referralToken && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Parabéns!</strong> Você foi indicado por um de nossos parceiros. 
                    Complete seu cadastro para ter acesso ao programa de indicações.
                  </AlertDescription>
                </Alert>
              )}
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Informações Pessoais</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo *</FormLabel>
                            <FormControl>
                              <Input placeholder="Seu nome completo" {...field} />
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
                            <FormLabel>CPF *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="000.000.000-00"
                                {...field}
                                onChange={(e) => handleCpfChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="seu@email.com" {...field} />
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
                            <FormLabel>Telefone *</FormLabel>
                            <FormControl>
                              <Input placeholder="(00) 90000-0000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>


                  {/* Additional Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Informações Adicionais</h3>
                    
                    <FormField
                      control={form.control}
                      name="pixKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave PIX *</FormLabel>
                          <FormControl>
                            <Input placeholder="CPF, e-mail ou telefone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Only show role selection if not coming from referral link */}
                    {!referralToken && (
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Cadastro *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="indicador">Indicador - Indico pessoas (R$3 por cadastro validado)</SelectItem>
                                <SelectItem value="promotor">Promotor - Gerencio equipe de indicadores</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    {/* Show info when coming from referral link */}
                    {referralToken && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700">
                          <strong>Cadastro como Indicador:</strong> Você poderá indicar pessoas e ganhar R$3 por cada cadastro validado + R$50 de bônus na conversão.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Senha de Acesso</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha *</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar Senha *</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Digite a senha novamente" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Terms and Conditions */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="over18"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Declaro que sou maior de 18 anos *
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="terms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Aceito os{" "}
                              <PrivacyPolicyDialog>
                                <button 
                                  type="button" 
                                  className="text-blue-600 hover:underline"
                                >
                                  termos e condições
                                </button>
                              </PrivacyPolicyDialog>
                              {" "}e política de privacidade *
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={registerMutation.isPending}
                    size="lg"
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      "Criar Conta - É Grátis!"
                    )}
                  </Button>

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Já tem uma conta?{" "}
                      <Button 
                        type="button"
                        variant="link" 
                        className="p-0 h-auto text-blue-600"
                        onClick={() => setLocation("/auth")}
                      >
                        Fazer login
                      </Button>
                    </p>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}