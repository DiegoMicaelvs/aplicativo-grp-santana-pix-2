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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Check, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CreateReferral } from "@shared/schema";

// Define validation schema
const referralSchema = z.object({
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  email: z.string().email("E-mail inválido").min(1, "E-mail é obrigatório"),
  phone: z.string().min(10, "Telefone inválido").max(15, "Telefone inválido"),
  licensePlate: z.string().min(7, "Placa do veículo é obrigatória").max(8, "Placa do veículo inválida"),
  comments: z.string().optional(),
});

type ReferralFormValues = z.infer<typeof referralSchema>;

export default function NewReferralPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  
  const form = useForm<ReferralFormValues>({
    resolver: zodResolver(referralSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      licensePlate: "",
      comments: "",
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
    mutation.mutate(data);
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
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-heading">Nova Indicação</CardTitle>
              <CardDescription>
                Indique alguém que precise de seguro para seu veículo e ganhe comissão quando a indicação virar cliente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Dados do Indicado</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do indicado" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sobrenome</FormLabel>
                            <FormControl>
                              <Input placeholder="Sobrenome do indicado" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
                      <FormField
                        control={form.control}
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
                        control={form.control}
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
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Dados do Veículo</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={form.control}
                        name="licensePlate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Placa do Veículo</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: ABC1234" {...field} />
                            </FormControl>
                            <FormDescription>
                              Informe a placa no formato antigo (ABC1234) ou no novo formato (ABC1D23).
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comentários Adicionais</FormLabel>
                        <FormControl>
                          <Input placeholder="Observações relevantes sobre a indicação (opcional)" {...field} />
                        </FormControl>
                        <FormDescription>
                          Informações que podem ajudar na análise do seguro.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex items-center justify-end space-x-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => navigate("/dashboard")}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? (
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
