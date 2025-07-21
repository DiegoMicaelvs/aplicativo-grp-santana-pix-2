import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { BackButton } from "@/components/ui/back-button";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Building2, Search } from "lucide-react";
import { Company } from "@shared/schema";

const companySchema = z.object({
  name: z.string().min(1, "Nome da empresa é obrigatório"),
  isActive: z.boolean().default(true),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export default function AdminCompaniesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const { toast } = useToast();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      isActive: true,
    },
  });

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data: CompanyFormValues) => apiRequest("/api/admin/companies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setDialogOpen(false);
      form.reset();
      setEditingCompany(null);
      toast({
        title: "Sucesso",
        description: "Empresa cadastrada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao cadastrar empresa",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CompanyFormValues }) => 
      apiRequest(`/api/admin/companies/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setDialogOpen(false);
      form.reset();
      setEditingCompany(null);
      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar empresa",
        variant: "destructive",
      });
    },
  });

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSubmit = (data: CompanyFormValues) => {
    if (editingCompany) {
      updateCompanyMutation.mutate({ id: editingCompany.id, data });
    } else {
      createCompanyMutation.mutate(data);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    form.setValue("name", company.name);
    form.setValue("isActive", company.isActive);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingCompany(null);
    form.reset();
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="bg-gray-100 flex-grow py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-heading flex items-center gap-2">
                <Building2 className="h-8 w-8" />
                Gerenciar Empresas
              </h1>
              <p className="mt-1 text-gray-600">Configure as empresas disponíveis para indicação</p>
            </div>
            <BackButton to="/admin" />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Empresas Cadastradas</CardTitle>
                  <CardDescription>
                    {isLoading ? 'Carregando...' : `Total: ${filteredCompanies.length} empresa(s)`}
                  </CardDescription>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                    <Input
                      placeholder="Buscar empresa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={handleNew}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Empresa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingCompany ? "Editar Empresa" : "Nova Empresa"}
                        </DialogTitle>
                        <DialogDescription>
                          {editingCompany 
                            ? "Edite as informações da empresa" 
                            : "Cadastre uma nova empresa no programa"
                          }
                        </DialogDescription>
                      </DialogHeader>
                      
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome da Empresa</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Empresa ABC Ltda" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Empresa Ativa
                                  </FormLabel>
                                  <div className="text-sm text-muted-foreground">
                                    Empresa disponível para seleção nas indicações
                                  </div>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          <div className="flex justify-end gap-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={createCompanyMutation.isPending || updateCompanyMutation.isPending}
                            >
                              {editingCompany ? "Atualizar" : "Cadastrar"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {isLoading ? (
                <div className="text-center py-6">Carregando empresas...</div>
              ) : filteredCompanies.length === 0 ? (
                <div className="text-center py-6">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Empresa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data de Cadastro</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">
                          {company.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={company.isActive ? "default" : "secondary"}>
                            {company.isActive ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(company)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}