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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { PrivacyPolicyDialog } from "@/components/ui/privacy-policy-dialog";

import { useAuth } from "@/hooks/use-auth";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { formatCPF } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Login schema
const loginSchema = z.object({
  username: z.string().min(1, "E-mail é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Registration schema
const registerSchema = z.object({
  username: z.string().email("E-mail inválido").min(1, "E-mail é obrigatório"),
  email: z.string().email("E-mail inválido").min(1, "E-mail é obrigatório"),
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  cpf: z.string().min(11, "CPF inválido").max(14, "CPF inválido"),
  phone: z.string().min(10, "Telefone inválido").max(15, "Telefone inválido"),
  address: z.string().min(5, "Endereço é obrigatório"),
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado é obrigatório").max(2, "Estado deve ter 2 letras"),
  zipCode: z.string().min(8, "CEP inválido").max(9, "CEP inválido"),
  shirtSize: z.string().min(1, "Tamanho da camisa é obrigatório"),
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
    message: "Você deve confirmar que é maior de 18 anos",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
}).refine((data) => data.username === data.email, {
  message: "Os emails devem ser iguais",
  path: ["email"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const [, navigate] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get referral token from URL parameters
  const [referralToken, setReferralToken] = useState<string | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refToken = urlParams.get('ref');
    if (refToken) {
      setReferralToken(refToken);
      setActiveTab("register"); // Auto-switch to register tab if coming from referral link
    }
  }, []);

  // Register with referral token mutation
  const registerWithReferralMutation = useMutation({
    mutationFn: async ({ userData, referralToken }: { userData: any; referralToken: string }) => {
      const res = await apiRequest("POST", "/api/register-with-referral", {
        userData,
        referralToken
      });
      return await res.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Cadastro realizado com sucesso!",
        description: "Você foi cadastrado através de um link de referência. Bem-vindo!",
      });
      // Refresh user data or redirect as needed
      setTimeout(() => {
        window.location.href = "/auth"; // Redirect to login
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no cadastro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Redirect if user is already logged in based on role
  useEffect(() => {
    if (user) {
      // Redirect based on user role
      switch (user.role) {
        case "admin":
          navigate("/admin");
          break;
        case "analista":
          navigate("/analyst");
          break;
        case "promotor":
          navigate("/promoter");
          break;
        case "vendedor":
          navigate("/vendedor");
          break;
        case "gerente":
          navigate("/manager");
          break;
        case "indicador_nivel_1":
          navigate("/new-referral");
          break;
        default:
          navigate("/dashboard");
      }
    }
  }, [user, navigate]);

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      fullName: "",
      cpf: "",
      phone: "",
      address: "",
      shirtSize: "",
      pixKey: "",
      role: "indicador" as const,
      password: "",
      confirmPassword: "",
      terms: false,
      over18: false,
    },
  });

  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterFormValues) => {
    // Remove confirmPassword, terms, over18 as they're not part of the API
    const { confirmPassword, terms, over18, ...registerData } = data;
    // Ensure email field is properly set to the username field since both should match
    const finalData = {
      ...registerData,
      email: data.username, // Use username as email since they should be the same
    };
    
    // Use referral registration if we have a token, otherwise use normal registration
    if (referralToken) {
      registerWithReferralMutation.mutate({ 
        userData: finalData, 
        referralToken 
      });
    } else {
      registerMutation.mutate(finalData as any);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="flex-grow flex items-center justify-center bg-gray-50 py-6 md:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl w-full flex flex-col lg:flex-row">
          {/* Left column - Auth forms */}
          <div className="flex-1 max-w-md w-full mx-auto">
            <Card className="shadow-lg">
              <CardHeader className="px-4 md:px-6">
                <CardTitle className="text-lg md:text-xl lg:text-2xl font-heading text-center">
                  {activeTab === "login" ? "Acesso de Indicadores" : "Cadastre-se como Indicador"}
                </CardTitle>
                <CardDescription className="text-xs md:text-sm text-center mt-1 md:mt-2">
                  {activeTab === "login" 
                    ? "Entre na sua conta para gerenciar suas indicações" 
                    : "Preencha seus dados para começar a indicar e ganhar"}
                </CardDescription>
                {referralToken && activeTab === "register" && (
                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-800 text-center">
                      ✨ Você foi convidado através de um link de referência especial!
                    </p>
                  </div>
                )}
              </CardHeader>
              
              <CardContent>
                <Tabs
                  defaultValue={activeTab}
                  value={activeTab}
                  onValueChange={(value) => setActiveTab(value)}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Entrar</TabsTrigger>
                    <TabsTrigger value="register">Cadastrar</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login">
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="seuemail@exemplo.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Senha</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="********" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Checkbox id="remember-me" />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                              Lembrar de mim
                            </label>
                          </div>

                          <div className="text-sm">
                            <a href="#" className="font-medium text-primary hover:text-primary-600">
                              Esqueceu a senha?
                            </a>
                          </div>
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                              Entrando...
                            </>
                          ) : (
                            "Entrar"
                          )}
                        </Button>
                        
                        {loginMutation.isError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Erro</AlertTitle>
                            <AlertDescription>
                              {loginMutation.error?.message || "Falha ao fazer login. Verifique suas credenciais."}
                            </AlertDescription>
                          </Alert>
                        )}
                      </form>
                    </Form>
                  </TabsContent>
                  
                  <TabsContent value="register">
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                        <FormField
                          control={registerForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome Completo</FormLabel>
                              <FormControl>
                                <Input placeholder="Seu nome completo" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={registerForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input placeholder="seuemail@exemplo.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirmar Email</FormLabel>
                                <FormControl>
                                  <Input placeholder="seuemail@exemplo.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={registerForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <FormControl>
                                  <Input placeholder="(xx) xxxxx-xxxx" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="cpf"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CPF</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="xxx.xxx.xxx-xx" 
                                    {...field}
                                    onChange={(e) => {
                                      const formatted = formatCPF(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={registerForm.control}
                            name="role"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo de Cadastro</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="indicador">Indicador</SelectItem>
                                    <SelectItem value="promotor">Promotor</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
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
                                    <SelectItem value="XGG">XGG</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={registerForm.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Endereço</FormLabel>
                              <FormControl>
                                <Input placeholder="Rua, número, bairro" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <FormField
                            control={registerForm.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Cidade</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nome da cidade" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={registerForm.control}
                            name="state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Estado</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="UF (ex: SP)" 
                                    maxLength={2}
                                    style={{ textTransform: 'uppercase' }}
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={registerForm.control}
                            name="zipCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CEP</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="00000-000" 
                                    maxLength={9}
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={registerForm.control}
                          name="pixKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Chave PIX</FormLabel>
                              <FormControl>
                                <Input placeholder="CPF, email ou telefone" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={registerForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Senha</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="********" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirmar Senha</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="********" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        

                        
                        <FormField
                          control={registerForm.control}
                          name="terms"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4 border">
                              <FormControl>
                                <Checkbox 
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Li e aceito os termos</FormLabel>
                                <FormDescription>
                                  Concordo com a{" "}
                                  <PrivacyPolicyDialog title="Política de Privacidade">
                                    <Button variant="link" className="text-primary hover:text-primary-600 p-0 h-auto font-normal text-sm underline">
                                      Política de Privacidade
                                    </Button>
                                  </PrivacyPolicyDialog>
                                  {" "}e os{" "}
                                  <PrivacyPolicyDialog title="Termo de Consentimento e Política de Privacidade">
                                    <Button variant="link" className="text-primary hover:text-primary-600 p-0 h-auto font-normal text-sm underline">
                                      Termos de Consentimento
                                    </Button>
                                  </PrivacyPolicyDialog>
                                  {" "}do programa "Indique e Ganhe".
                                </FormDescription>
                                <FormMessage />
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={registerForm.control}
                          name="over18"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4 border">
                              <FormControl>
                                <Checkbox 
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Confirmo que sou maior de 18 anos</FormLabel>
                                <FormMessage />
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                              Cadastrando...
                            </>
                          ) : (
                            "Cadastrar"
                          )}
                        </Button>
                        
                        {registerMutation.isError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Erro</AlertTitle>
                            <AlertDescription>
                              {registerMutation.error?.message || "Falha ao cadastrar. Verifique seus dados."}
                            </AlertDescription>
                          </Alert>
                        )}
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          {/* Right column - Hero section */}
          <div className="flex-1 hidden lg:flex">
            <div className="flex flex-col justify-center items-center px-8">
              <div className="max-w-lg">
                <h2 className="text-3xl font-extrabold text-gray-900 font-heading mb-6">
                  Junte-se ao programa Indique e Ganhe
                </h2>
                <div className="prose prose-blue">
                  <p className="text-xl text-gray-600">
                    Com o Indique e Ganhe, você pode transformar suas conexões em oportunidades lucrativas.
                  </p>
                  
                  <h3 className="text-xl font-medium text-gray-900 mt-8 mb-4">Por que participar?</h3>
                  
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-primary flex-shrink-0 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Ganhe até R$ 500 por indicação convertida</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-primary flex-shrink-0 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Horários flexíveis, indique quando quiser</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-primary flex-shrink-0 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Sem limites de indicações ou ganhos</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-primary flex-shrink-0 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Suporte dedicado em todas as etapas</span>
                    </li>
                  </ul>
                  
                  <div className="mt-10 p-6 bg-primary-50 rounded-lg border border-primary-100">
                    <h4 className="text-lg font-medium text-primary-800">Indicador destaque do mês:</h4>
                    <p className="mt-2 text-primary-700">Carlos Silva indicou 12 pessoas e ganhou R$ 4.800 em comissões!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
      
      <Footer />
    </div>
  );
}
