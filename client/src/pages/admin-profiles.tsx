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
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackButton } from "@/components/ui/back-button";
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
  DialogDescription,
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
import { formatCPF } from "@/lib/utils";
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
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado é obrigatório").max(2, "Estado deve ter 2 letras"),
  zipCode: z.string().min(8, "CEP inválido").max(9, "CEP inválido"),
  shirtSize: z.string().min(1, "Tamanho da camisa é obrigatório"),
  pixKey: z.string().min(3, "Chave PIX é obrigatória"),
  role: z.enum(["indicador", "promotor", "admin", "analista", "vendedor", "gerente"]),
  analystLevel: z.coerce.number().int().min(1).max(3).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean(),
  promoterId: z.coerce.number().optional(),
  analystId: z.coerce.number().optional(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
});

type ProfileFormValues = z.infer<typeof profileManagementSchema>;

// Permission groups for better organization - Updated July 25, 2025
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
  "Criação de Usuários": [
    { key: "create_indicadores", label: "Criar Indicadores" },
    { key: "create_promotores", label: "Criar Promotores" },
  ],
} as const;

// Manager permission groups
const MANAGER_PERMISSION_GROUPS = {
  "Visualização Completa": [
    { key: "view_all_referrals", label: "Ver Todas as Indicações" },
    { key: "view_all_users", label: "Ver Todos os Usuários" },
    { key: "view_all_reports", label: "Ver Todos os Relatórios" },
    { key: "view_financial_reports", label: "Ver Relatórios Financeiros" },
    { key: "audit_access", label: "Acesso aos Logs de Auditoria" },
  ],
  "Gestão": [
    { key: "edit_all_referrals", label: "Editar Todas as Indicações" },
    { key: "manage_all_users", label: "Gerenciar Todos os Usuários" },
    { key: "manage_analysts", label: "Gerenciar Analistas" },
    { key: "manage_promoters", label: "Gerenciar Promotores" },
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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [customPasswordDialogOpen, setCustomPasswordDialogOpen] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUserForDeletion, setSelectedUserForDeletion] = useState<User | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
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

  // Filter Level 3 analysts from users
  const analystLevel3 = users?.filter((user) => user.role === "analista" && user.analystLevel === 3) || [];

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
      // Ensure password is provided for new users
      if (!data.password) {
        throw new Error('Senha é obrigatória para criar usuário');
      }
      // Ensure username matches email for consistency
      if (!data.username) {
        data.username = data.email;
      }
      return apiRequest('POST', '/api/admin/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Usuário criado",
        description: "O perfil foi criado com sucesso.",
      });
      setCreateDialogOpen(false);
      form.reset({
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
        password: "",
      });
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

  // Reset password mutation with custom password
  const resetPasswordMutation = useMutation({
    mutationFn: async (userData: {userId: number, userName: string, customPassword: string}) => {
      const response = await apiRequest('POST', `/api/admin/users/${userData.userId}/reset-password`, {
        customPassword: userData.customPassword
      });
      console.log('Raw API response:', response);
      return { ...response, userName: userData.userName };
    },
    onSuccess: (data: any) => {
      console.log('Full password reset response:', data);
      
      setNewPassword(customPassword);
      setSelectedUserForPassword({ fullName: data.userName } as User);
      setPasswordDialogOpen(true);
      setCustomPasswordDialogOpen(false);
      setCustomPassword("");
      toast({
        title: "Senha redefinida",
        description: "Nova senha temporária definida com sucesso.",
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

  // Delete user mutation with master password
  const deleteUserMutation = useMutation({
    mutationFn: async (userData: {userId: number, masterPassword: string}) => {
      return apiRequest('DELETE', `/api/admin/users/${userData.userId}/delete`, {
        masterPassword: userData.masterPassword
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setDeleteDialogOpen(false);
      setMasterPassword("");
      setSelectedUserForDeletion(null);
      toast({
        title: "Usuário deletado",
        description: `${data.deletedUser} foi removido permanentemente do sistema.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar usuário",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    },
  });

  // Load user data when editing
  useEffect(() => {
    if (selectedUser) {
      // Extract city, state, and zipCode from the stored data
      const city = selectedUser.city || '';
      const state = selectedUser.state || '';
      const zipCode = selectedUser.zipCode || '';
      
      form.reset({
        fullName: selectedUser.fullName,
        username: selectedUser.username,
        email: selectedUser.email,
        cpf: selectedUser.cpf,
        phone: selectedUser.phone,
        address: selectedUser.address,
        city: city,
        state: state,
        zipCode: zipCode,
        shirtSize: selectedUser.shirtSize,
        pixKey: selectedUser.pixKey,
        role: selectedUser.role,
        analystLevel: selectedUser.analystLevel || undefined,
        permissions: selectedUser.permissions || [],
        isActive: selectedUser.isActive,
        promoterId: selectedUser.promoterId || undefined,
        analystId: selectedUser.analystId || undefined,
      });
    }
  }, [selectedUser, form]);

  // Filter users based on role, status, and search term
  const filteredUsers = users?.filter(user => {
    const roleMatch = roleFilter === "all_roles" || user.role === roleFilter;
    const statusMatch = statusFilter === "all_status" || 
      (statusFilter === "active" && user.isActive) ||
      (statusFilter === "inactive" && !user.isActive);
    
    // Search in multiple fields
    const searchLower = searchTerm.toLowerCase();
    const searchMatch = searchTerm === "" || 
      user.fullName.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      (user.cpf && user.cpf.includes(searchTerm)) ||
      (user.phone && user.phone.includes(searchTerm));
    
    return roleMatch && statusMatch && searchMatch;
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
      // Create new user - validate password is provided
      if (!data.password || data.password.length < 6) {
        toast({
          title: "Erro de validação",
          description: "Senha é obrigatória e deve ter pelo menos 6 caracteres para criar um usuário.",
          variant: "destructive",
        });
        return;
      }
      createUserMutation.mutate(data);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      case "promotor": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      case "analista": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100";
      case "vendedor": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100";
      case "gerente": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "admin": return "Administrador";
      case "promotor": return "Promotor";
      case "analista": return "Analista";
      case "indicador": return "Indicador";
      case "vendedor": return "Vendedor";
      case "gerente": return "Gerente";
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Gerenciar Perfis de Usuário
            </h1>
            <p className="text-muted-foreground">
              Configure perfis, permissões e controle de acesso para todos os usuários do sistema.
            </p>
          </div>
          <BackButton />
        </div>

        <div className="space-y-6">
          {/* Actions Bar */}
          <div className="flex justify-between items-center gap-4">
            <div className="flex flex-1 flex-wrap gap-4">
              {/* Search Input */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Pesquisar por nome, email, CPF ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

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
                  <SelectItem value="vendedor">Vendedores</SelectItem>
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

            <Dialog open={createDialogOpen} onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (open) {
                // Reset form when opening create dialog
                form.reset({
                  fullName: "",
                  username: "",
                  email: "",
                  cpf: "",
                  phone: "",
                  address: "",
                  city: "",
                  state: "",
                  zipCode: "",
                  shirtSize: "M",
                  pixKey: "",
                  role: "indicador",
                  isActive: true,
                  permissions: [],
                  password: "",
                });
                setSelectedUser(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Preencha os dados abaixo para criar um novo usuário no sistema.
                  </DialogDescription>
                </DialogHeader>
                <UserProfileForm
                  form={form}
                  onSubmit={onSubmit}
                  isLoading={createUserMutation.isPending}
                  promoters={promoters}
                  analysts={analystLevel3}
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
                                  analysts={analystLevel3}
                                  isCreate={false}
                                  onCancel={() => setDialogOpen(false)}
                                />
                              </DialogContent>
                            </Dialog>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={resetPasswordMutation.isPending}
                              onClick={() => {
                                setSelectedUserForPassword(user);
                                setCustomPasswordDialogOpen(true);
                              }}
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Redefinir Senha
                            </Button>

                            {/* Delete User Button - Only show for non-admin users */}
                            {user.role !== 'admin' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deleteUserMutation.isPending}
                                onClick={() => {
                                  setSelectedUserForDeletion(user);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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
      
      {/* Custom Password Input Dialog */}
      <Dialog open={customPasswordDialogOpen} onOpenChange={setCustomPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Definir Nova Senha Temporária</DialogTitle>
            <DialogDescription>
              Digite uma senha temporária para <strong>{selectedUserForPassword?.fullName}</strong>. 
              O usuário será obrigado a alterar esta senha no primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="customPassword">Nova Senha Temporária</Label>
              <Input
                id="customPassword"
                type="password"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder="Digite a nova senha"
                minLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                Mínimo 6 caracteres. O usuário deve trocar no primeiro acesso.
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCustomPasswordDialogOpen(false);
                  setCustomPassword("");
                  setSelectedUserForPassword(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!customPassword || customPassword.length < 6) {
                    toast({
                      title: "Erro",
                      description: "A senha deve ter pelo menos 6 caracteres.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (selectedUserForPassword) {
                    resetPasswordMutation.mutate({
                      userId: selectedUserForPassword.id,
                      userName: selectedUserForPassword.fullName,
                      customPassword: customPassword
                    });
                  }
                }}
                disabled={resetPasswordMutation.isPending || !customPassword || customPassword.length < 6}
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Settings className="h-4 w-4 mr-2 animate-spin" />
                    Definindo...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Definir Senha
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Display Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Senha Temporária Definida</DialogTitle>
            <DialogDescription>
              A nova senha temporária foi definida com sucesso. Compartilhe esta senha com o usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                A senha temporária para <strong>{selectedUserForPassword?.fullName}</strong> é:
              </p>
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <code className="text-lg font-mono font-bold text-gray-900 select-all">
                  {newPassword || 'Carregando...'}
                </code>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Clique na senha acima para selecioná-la e copiar. 
                <br />
                <strong>O usuário será obrigado a alterar esta senha no primeiro acesso.</strong>
              </p>
            </div>
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    if (!newPassword) {
                      toast({
                        title: "Erro",
                        description: "Senha não disponível para copiar.",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    await navigator.clipboard.writeText(newPassword);
                    toast({
                      title: "Senha copiada",
                      description: "A senha foi copiada para a área de transferência.",
                    });
                  } catch (error) {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = newPassword;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    toast({
                      title: "Senha copiada",
                      description: "A senha foi copiada para a área de transferência.",
                    });
                  }
                }}
                disabled={!newPassword}
              >
                <Settings className="h-4 w-4 mr-2" />
                Copiar Senha
              </Button>
              <Button onClick={() => {
                setPasswordDialogOpen(false);
                setNewPassword("");
                setSelectedUserForPassword(null);
              }}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog with Master Password */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-destructive">
              <Trash2 className="h-5 w-5 mr-2" />
              Confirmar Exclusão Permanente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>
                  Você está prestes a deletar permanentemente o usuário <strong>{selectedUserForDeletion?.fullName}</strong>.
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-sm text-red-800 font-medium">
                    ⚠️ Esta ação é irreversível e irá:
                  </div>
                  <ul className="text-sm text-red-700 mt-2 space-y-1 ml-4 list-disc">
                    <li>Deletar todos os dados do usuário</li>
                    <li>Remover todas as indicações feitas por ele</li>
                    <li>Remover histórico de tickets de suporte</li>
                    <li>Limpar registros de auditoria</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="masterPassword" className="text-sm font-medium">
                    Digite a senha mestre do desenvolvedor para confirmar:
                  </Label>
                  <Input
                    id="masterPassword"
                    type="password"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Senha mestre do desenvolvedor"
                    className="border-red-300 focus:border-red-500"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setMasterPassword("");
                setSelectedUserForDeletion(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={!masterPassword || deleteUserMutation.isPending}
              onClick={() => {
                if (selectedUserForDeletion && masterPassword) {
                  deleteUserMutation.mutate({
                    userId: selectedUserForDeletion.id,
                    masterPassword: masterPassword
                  });
                }
              }}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Settings className="h-4 w-4 mr-2 animate-spin" />
                  Deletando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Deletar Permanentemente
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Footer />
    </div>
  );

  // User Profile Form Component
  function UserProfileForm({ 
    form, 
  onSubmit, 
  isLoading, 
  promoters,
  analysts, 
  isCreate,
  onCancel 
}: {
  form: any;
  onSubmit: (data: ProfileFormValues) => void;
  isLoading: boolean;
  promoters?: User[];
  analysts?: User[];
  isCreate: boolean;
  onCancel?: () => void;
}) {
  const [activeTab, setActiveTab] = useState("basic");
  const watchedRole = form.watch("role");
  const watchedPermissions = form.watch("permissions") || [];

  const handlePermissionChange = (permission: string, checked: boolean) => {
    const currentPermissions = form.getValues("permissions") || [];
    if (checked) {
      form.setValue("permissions", [...currentPermissions, permission], { shouldValidate: false, shouldDirty: true });
    } else {
      form.setValue("permissions", currentPermissions.filter((p: string) => p !== permission), { shouldValidate: false, shouldDirty: true });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic" type="button">Dados Básicos</TabsTrigger>
          <TabsTrigger value="role" type="button">Papel e Permissões</TabsTrigger>
          <TabsTrigger value="settings" type="button">Configurações</TabsTrigger>
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
              <Label htmlFor="username">Email de Login</Label>
              <Input
                id="username"
                type="email"
                {...form.register("username")}
                placeholder="email@exemplo.com"
              />
              {form.formState.errors.username && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email de Contato</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="contato@exemplo.com"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                {...form.register("cpf", {
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    const formatted = formatCPF(e.target.value);
                    form.setValue("cpf", formatted);
                  }
                })}
                placeholder="000.000.000-00"
              />
              {form.formState.errors.cpf && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.cpf.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            
            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                {...form.register("address")}
                placeholder="Rua, número, bairro"
              />
              {form.formState.errors.address && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.address.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                {...form.register("city")}
                placeholder="Nome da cidade"
              />
              {form.formState.errors.city && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.city.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                {...form.register("state")}
                placeholder="UF (ex: SP)"
                maxLength={2}
                style={{ textTransform: 'uppercase' }}
              />
              {form.formState.errors.state && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.state.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="zipCode">CEP</Label>
              <Input
                id="zipCode"
                {...form.register("zipCode")}
                placeholder="00000-000"
                maxLength={9}
              />
              {form.formState.errors.zipCode && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.zipCode.message}
                </p>
              )}
            </div>
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
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(watchedRole === "indicador" && promoters && promoters.length > 0) && (
              <div>
                <Label htmlFor="promoterId">Promotor Responsável</Label>
                <Select
                  value={form.watch("promoterId")?.toString() || "no_promoter"}
                  onValueChange={(value) => form.setValue("promoterId", value === "no_promoter" ? undefined : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o promotor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_promoter">Nenhum promotor</SelectItem>
                    {promoters.map((promoter) => (
                      <SelectItem key={promoter.id} value={promoter.id.toString()}>
                        {promoter.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(watchedRole === "promotor" && analysts && analysts.length > 0) && (
              <div>
                <Label htmlFor="analystId">Analista Nível 3 Responsável</Label>
                <Select
                  value={form.watch("analystId")?.toString() || "no_analyst"}
                  onValueChange={(value) => form.setValue("analystId", value === "no_analyst" ? undefined : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o analista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_analyst">Nenhum analista</SelectItem>
                    {analysts.map((analyst) => (
                      <SelectItem key={analyst.id} value={analyst.id.toString()}>
                        {analyst.fullName}
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
                  value={form.watch("analystLevel")?.toString() || "no_level"}
                  onValueChange={(value) => form.setValue("analystLevel", value === "no_level" ? null : parseInt(value) as AnalystLevel)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_level">Nenhum nível</SelectItem>
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

          {watchedRole === "gerente" && (
            <div>
              <Label>Permissões do Gerente</Label>
              <div className="mt-2 space-y-4">
                {Object.entries(MANAGER_PERMISSION_GROUPS).map(([groupName, permissions]) => (
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
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
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
}