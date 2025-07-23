import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield, Users } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateAnalystPermissionsSchema, type UpdateAnalystPermissions, type User, type AnalystPermission } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const PERMISSION_LABELS: Record<AnalystPermission, string> = {
  view_referrals: "Visualizar Indicações",
  edit_referral_status: "Editar Status das Indicações",
  view_users: "Visualizar Usuários",
  manage_withdrawals: "Gerenciar Saques",
  view_reports: "Visualizar Relatórios",
  manage_companies: "Gerenciar Empresas",
  create_indicadores: "Criar Novos Indicadores",
  create_promotores: "Criar Novos Promotores"
};

const LEVEL_DESCRIPTIONS = {
  1: "Analista Júnior - Acesso básico ao sistema",
  2: "Analista Pleno - Acesso intermediário com algumas permissões de gestão",
  3: "Analista Sênior - Acesso avançado com permissões amplas",
};

export default function AdminAnalysts() {
  const [selectedAnalyst, setSelectedAnalyst] = useState<User | null>(null);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all analysts
  const { data: analysts = [], isLoading: isLoadingAnalysts } = useQuery({
    queryKey: ["/api/admin/analysts"],
  });

  // Update analyst permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async (data: UpdateAnalystPermissions & { userId: number }) => {
      const response = await fetch(`/api/admin/users/${data.userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analystLevel: data.analystLevel,
          permissions: data.permissions,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar permissões");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analysts"] });
      toast({
        title: "Sucesso",
        description: "Permissões do analista atualizadas com sucesso!",
      });
      setIsPermissionDialogOpen(false);
      setSelectedAnalyst(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<UpdateAnalystPermissions>({
    resolver: zodResolver(updateAnalystPermissionsSchema),
    defaultValues: {
      analystLevel: 1,
      permissions: [],
    },
  });

  const handleEditPermissions = (analyst: User) => {
    setSelectedAnalyst(analyst);
    form.reset({
      analystLevel: analyst.analystLevel || 1,
      permissions: analyst.permissions || [],
    });
    setIsPermissionDialogOpen(true);
  };

  const onSubmit = (data: UpdateAnalystPermissions) => {
    if (!selectedAnalyst) return;
    updatePermissionsMutation.mutate({
      ...data,
      userId: selectedAnalyst.id,
    });
  };

  const getAnalystLevelBadge = (level?: number) => {
    const levelNum = level || 1;
    const colors = {
      1: "bg-blue-100 text-blue-800",
      2: "bg-yellow-100 text-yellow-800", 
      3: "bg-green-100 text-green-800",
    };
    
    return (
      <Badge className={colors[levelNum as keyof typeof colors]}>
        Nível {levelNum}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciar Analistas</h1>
          <p className="text-gray-600">Configure níveis e permissões dos analistas</p>
        </div>
      </div>

      {/* Analysts List */}
      <Card>
        <CardHeader>
          <CardTitle>Analistas Cadastrados</CardTitle>
          <CardDescription>
            Gerencie as permissões e níveis de acesso dos analistas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAnalysts ? (
            <div className="text-center py-8">Carregando...</div>
          ) : analysts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum analista cadastrado ainda
            </div>
          ) : (
            <div className="space-y-4">
              {analysts.map((analyst: User) => (
                <div
                  key={analyst.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <h3 className="font-medium">{analyst.fullName}</h3>
                      <p className="text-sm text-gray-500">{analyst.email}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        {getAnalystLevelBadge(analyst.analystLevel)}
                        <Badge variant={analyst.isActive ? "default" : "secondary"}>
                          {analyst.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">
                          Permissões: {analyst.permissions?.length || 0} configuradas
                        </p>
                        {analyst.permissions && analyst.permissions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {analyst.permissions.slice(0, 3).map((permission) => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {PERMISSION_LABELS[permission as AnalystPermission]}
                              </Badge>
                            ))}
                            {analyst.permissions.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{analyst.permissions.length - 3} mais
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPermissions(analyst)}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configurar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission Configuration Dialog */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Configurar Permissões do Analista
            </DialogTitle>
            <DialogDescription>
              {selectedAnalyst && `Configure o nível e permissões de ${selectedAnalyst.fullName}`}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="analystLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível do Analista</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o nível" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Nível 1 - Júnior</SelectItem>
                        <SelectItem value="2">Nível 2 - Pleno</SelectItem>
                        <SelectItem value="3">Nível 3 - Sênior</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permissões</FormLabel>
                    <div className="space-y-4">
                      {Object.entries(PERMISSION_LABELS).map(([permission, label]) => (
                        <div key={permission} className="flex items-center space-x-2">
                          <Checkbox
                            id={permission}
                            checked={field.value?.includes(permission as AnalystPermission)}
                            onCheckedChange={(checked) => {
                              const currentPermissions = field.value || [];
                              if (checked) {
                                field.onChange([...currentPermissions, permission]);
                              } else {
                                field.onChange(
                                  currentPermissions.filter((p) => p !== permission)
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor={permission}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPermissionDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updatePermissionsMutation.isPending}
                >
                  {updatePermissionsMutation.isPending ? "Salvando..." : "Salvar Permissões"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}