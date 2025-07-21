import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Edit,
  Shield,
  Users,
  Eye,
  Settings,
  UserCheck,
  UserX,
  Save,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  User,
  UserRole,
  AnalystPermission,
  AnalystLevel,
  insertUserSchema,
  updateAnalystPermissionsSchema,
} from "@shared/schema";

// Schema for creating/editing users with profile management
const profileManagementSchema = z.object({
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  username: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  email: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  cpf: z.string().min(11, "CPF inválido").max(14, "CPF inválido"),
  phone: z.string().min(10, "Telefone inválido").max(15, "Telefone inválido"),
  address: z.string().min(5, "Endereço é obrigatório"),
  shirtSize: z.string().min(1, "Tamanho da camisa é obrigatório"),
  pixKey: z.string().min(3, "Chave PIX é obrigatória"),
  role: z.enum(["indicador", "promotor", "admin", "analista"]),
  analystLevel: z.coerce.number().int().min(1).max(3).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean(),
  promoterId: z.coerce.number().optional(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
});

type ProfileFormValues = z.infer<typeof profileManagementSchema>;

// Permission groups for better organization
const PERMISSION_GROUPS = {
  "Visualização": [
    { key: "view_referrals", label: "Ver Indicações" },
    { key: "view_users", label: "Ver Usuários" },
    { key: "view_reports", label: "Ver Relatórios" },
  ],
  "Edição": [
    { key: "edit_referral_status", label: "Editar Status de Indicações" },
    { key: "manage_withdrawals", label: "Gerenciar Saques" },
    { key: "manage_companies", label: "Gerenciar Empresas" },
  ],
} as const;

export default function AdminProfiles() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [roleFilter, setRoleFilter] = useState<string>("all_roles");
  const [statusFilter, setStatusFilter] = useState<string>("all_status");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  // Fetch promoters for dropdown
  const { data: promoters } = useQuery<User[]>({
    queryKey: ['/api/admin/promoters'],
  });

  // Form for editing user profiles
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileManagementSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      cpf: "",
      phone: "",
      address: "",
      shirtSize: "M",
      pixKey: "",
      role: "indicador",
      isActive: true,
      permissions: [],
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      return apiRequest('POST', '/api/admin/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Usuário criado",
        description: "O perfil foi criado com sucesso.",
      });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<ProfileFormValues> }) => {
      return apiRequest('PATCH', `/api/admin/users/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Usuário atualizado",
        description: "O perfil foi atualizado com sucesso.",
      });
      setDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    },
  });

  // Toggle user status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async (data: { id: number; isActive: boolean }) => {
      return apiRequest('PATCH', `/api/admin/users/${data.id}/status`, { isActive: data.isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Status atualizado",
        description: "O status do usuário foi alterado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao alterar status",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest('POST', `/api/admin/users/${userId}/reset-password`);
    },
    onSuccess: () => {
      toast({
        title: "Senha redefinida",
        description: "Uma nova senha foi enviada para o email do usuário.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    },
  });

  // Load user data when editing
  useEffect(() => {
    if (selectedUser) {
      form.reset({
        fullName: selectedUser.fullName,
        username: selectedUser.username,
        email: selectedUser.email,
        cpf: selectedUser.cpf,
        phone: selectedUser.phone,
        address: selectedUser.address,
        shirtSize: selectedUser.shirtSize,
        pixKey: selectedUser.pixKey,
        role: selectedUser.role,
        analystLevel: selectedUser.analystLevel || undefined,
        permissions: selectedUser.permissions || [],
        isActive: selectedUser.isActive,
        promoterId: selectedUser.promoterId || undefined,
      });
    }
  }, [selectedUser, form]);

  // Filter users based on role and status
  const filteredUsers = users?.filter(user => {
    const roleMatch = roleFilter === "all_roles" || user.role === roleFilter;
    const statusMatch = statusFilter === "all_status" || 
      (statusFilter === "active" && user.isActive) ||
      (statusFilter === "inactive" && !user.isActive);
    return roleMatch && statusMatch;
  }) || [];

  const onSubmit = (data: ProfileFormValues) => {
    if (selectedUser) {
      // Update existing user
      const updates = { ...data };
      if (!updates.password) {
        delete updates.password;
      }
      updateUserMutation.mutate({ id: selectedUser.id, updates });
    } else {
      // Create new user
      createUserMutation.mutate(data);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      case "promotor": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      case "analista": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "admin": return "Administrador";
      case "promotor": return "Promotor";
      case "analista": return "Analista";
      case "indicador": return "Indicador";
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gerenciar Perfis de Usuário
          </h1>
          <p className="text-muted-foreground">
            Configure perfis, permissões e controle de acesso para todos os usuários do sistema.
          </p>
        </div>

        <div className="space-y-6">
          {/* Actions Bar */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              {/* Role Filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_roles">Todos os Papéis</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="promotor">Promotores</SelectItem>
                  <SelectItem value="analista">Analistas</SelectItem>
                  <SelectItem value="indicador">Indicadores</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_status">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                </DialogHeader>
                <UserProfileForm
                  form={form}
                  onSubmit={onSubmit}
                  isLoading={createUserMutation.isPending}
                  promoters={promoters}
                  isCreate={true}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Usuários ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="text-center py-8">Carregando usuários...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado com os filtros aplicados.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.fullName}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {getRoleLabel(user.role)}
                          </Badge>
                          {user.role === "analista" && user.analystLevel && (
                            <Badge variant="outline" className="ml-1">
                              Nível {user.analystLevel}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={(checked) =>
                                toggleUserStatusMutation.mutate({
                                  id: user.id,
                                  isActive: checked,
                                })
                              }
                            />
                            <span className="text-sm">
                              {user.isActive ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Dialog open={dialogOpen && selectedUser?.id === user.id} 
                                   onOpenChange={(open) => {
                                     setDialogOpen(open);
                                     if (!open) setSelectedUser(null);
                                   }}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedUser(user)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Editar Usuário: {user.fullName}</DialogTitle>
                                </DialogHeader>
                                <UserProfileForm
                                  form={form}
                                  onSubmit={onSubmit}
                                  isLoading={updateUserMutation.isPending}
                                  promoters={promoters}
                                  isCreate={false}
                                />
                              </DialogContent>
                            </Dialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={resetPasswordMutation.isPending}
                                >
                                  <Shield className="h-4 w-4 mr-1" />
                                  Redefinir Senha
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Redefinir Senha do Usuário</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza de que deseja redefinir a senha do usuário <strong>{user.fullName}</strong>?
                                    <br /><br />
                                    Uma nova senha temporária será gerada automaticamente e enviada para o usuário.
                                    O usuário deverá alterar a senha no primeiro acesso.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => resetPasswordMutation.mutate(user.id)}
                                    disabled={resetPasswordMutation.isPending}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    {resetPasswordMutation.isPending ? (
                                      <>
                                        <Settings className="h-4 w-4 mr-2 animate-spin" />
                                        Redefinindo...
                                      </>
                                    ) : (
                                      <>
                                        <Shield className="h-4 w-4 mr-2" />
                                        Redefinir Senha
                                      </>
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

// User Profile Form Component
function UserProfileForm({ 
  form, 
  onSubmit, 
  isLoading, 
  promoters, 
  isCreate 
}: {
  form: any;
  onSubmit: (data: ProfileFormValues) => void;
  isLoading: boolean;
  promoters?: User[];
  isCreate: boolean;
}) {
  const watchedRole = form.watch("role");
  const watchedPermissions = form.watch("permissions") || [];

  const handlePermissionChange = (permission: string, checked: boolean) => {
    const currentPermissions = form.getValues("permissions") || [];
    if (checked) {
      form.setValue("permissions", [...currentPermissions, permission]);
    } else {
      form.setValue("permissions", currentPermissions.filter((p: string) => p !== permission));
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
          <TabsTrigger value="role">Papel e Permissões</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                {...form.register("fullName")}
                placeholder="Nome completo do usuário"
              />
              {form.formState.errors.fullName && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.fullName.message}
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="email@exemplo.com"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                {...form.register("cpf")}
                placeholder="000.000.000-00"
              />
              {form.formState.errors.cpf && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.cpf.message}
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                {...form.register("phone")}
                placeholder="(11) 99999-9999"
              />
              {form.formState.errors.phone && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              {...form.register("address")}
              placeholder="Endereço completo"
            />
            {form.formState.errors.address && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.address.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shirtSize">Tamanho da Camisa</Label>
              <Select
                value={form.watch("shirtSize")}
                onValueChange={(value) => form.setValue("shirtSize", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tamanho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PP">PP</SelectItem>
                  <SelectItem value="P">P</SelectItem>
                  <SelectItem value="M">M</SelectItem>
                  <SelectItem value="G">G</SelectItem>
                  <SelectItem value="GG">GG</SelectItem>
                  <SelectItem value="XGG">XGG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pixKey">Chave PIX</Label>
              <Input
                id="pixKey"
                {...form.register("pixKey")}
                placeholder="Chave PIX para pagamentos"
              />
              {form.formState.errors.pixKey && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.pixKey.message}
                </p>
              )}
            </div>
          </div>

          {isCreate && (
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                {...form.register("password")}
                placeholder="Senha para o usuário"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="role" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role">Papel do Usuário</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(value) => form.setValue("role", value as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicador">Indicador</SelectItem>
                  <SelectItem value="promotor">Promotor</SelectItem>
                  <SelectItem value="analista">Analista</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(watchedRole === "indicador" && promoters && promoters.length > 0) && (
              <div>
                <Label htmlFor="promoterId">Promotor Responsável</Label>
                <Select
                  value={form.watch("promoterId")?.toString() || ""}
                  onValueChange={(value) => form.setValue("promoterId", value ? parseInt(value) : undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o promotor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum promotor</SelectItem>
                    {promoters.map((promoter) => (
                      <SelectItem key={promoter.id} value={promoter.id.toString()}>
                        {promoter.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {watchedRole === "analista" && (
              <div>
                <Label htmlFor="analystLevel">Nível do Analista</Label>
                <Select
                  value={form.watch("analystLevel")?.toString() || ""}
                  onValueChange={(value) => form.setValue("analystLevel", parseInt(value) as AnalystLevel)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Nível 1</SelectItem>
                    <SelectItem value="2">Nível 2</SelectItem>
                    <SelectItem value="3">Nível 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {watchedRole === "analista" && (
            <div>
              <Label>Permissões do Analista</Label>
              <div className="mt-2 space-y-4">
                {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => (
                  <div key={groupName}>
                    <h4 className="font-medium text-sm mb-2">{groupName}</h4>
                    <div className="space-y-2 ml-4">
                      {permissions.map(({ key, label }) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={key}
                            checked={watchedPermissions.includes(key)}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(key, !!checked)
                            }
                          />
                          <label htmlFor={key} className="text-sm">
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={form.watch("isActive")}
              onCheckedChange={(checked) => form.setValue("isActive", checked)}
            />
            <Label>Usuário Ativo</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Desative usuários para impedir o acesso sem excluir os dados.
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Settings className="h-4 w-4 mr-2 animate-spin" />
              {isCreate ? "Criando..." : "Salvando..."}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isCreate ? "Criar Usuário" : "Salvar Alterações"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}