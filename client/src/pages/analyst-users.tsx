import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BackButton } from "@/components/ui/back-button";
import { User } from "@shared/schema";
import { Users, Search, UserPlus, Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case "indicador": return "bg-blue-100 text-blue-700";
    case "promotor": return "bg-green-100 text-green-700";
    case "analista": return "bg-purple-100 text-purple-700";
    case "gerente": return "bg-orange-100 text-orange-700";
    case "admin": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-700";
  }
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case "indicador": return "Indicador";
    case "promotor": return "Promotor";
    case "analista": return "Analista";
    case "gerente": return "Gerente";
    case "admin": return "Administrador";
    default: return role;
  }
};

export default function AnalystUsers() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all_roles");
  const [statusFilter, setStatusFilter] = useState("all_status");

  // Fetch users - analysts can view users based on their permissions
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/analyst/users'],
    enabled: user?.permissions?.includes("view_users") || false,
  });

  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission) || false;
  };

  // Filter users based on search and filters
  const filteredUsers = (users || []).filter((user: User) => {
    const matchesSearch = 
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.cpf?.includes(searchTerm);
    
    const matchesRole = roleFilter === "all_roles" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all_status" || 
                         (statusFilter === "active" ? user.isActive : !user.isActive);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (!hasPermission("view_users")) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-yellow-600">
              <Shield className="h-5 w-5" />
              <p>Você não tem permissão para visualizar usuários.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <BackButton />
              <h1 className="text-2xl font-bold text-gray-900">Usuários do Sistema</h1>
            </div>
            <p className="text-gray-600 mt-1">Visualize os usuários cadastrados no sistema</p>
            {user?.analystLevel === 3 && (
              <Badge className="mt-2 bg-purple-100 text-purple-800">
                <Shield className="h-3 w-3 mr-1" />
                Mostrando apenas usuários sob sua supervisão
              </Badge>
            )}
          </div>
          
          <div className="flex gap-2">
            {hasPermission("create_indicadores") && (
              <Button onClick={() => setLocation("/analyst/create-indicador")} variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Indicador
              </Button>
            )}
            {hasPermission("create_promotores") && (
              <Button onClick={() => setLocation("/analyst/create-promotor")}>
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Promotor
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Usuários
            </CardTitle>
            <CardDescription>
              Gerencie e visualize todos os usuários cadastrados
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar por nome, email ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_roles">Todos os Papéis</SelectItem>
                  <SelectItem value="indicador">Indicador</SelectItem>
                  <SelectItem value="promotor">Promotor</SelectItem>
                  <SelectItem value="analista">Analista</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_status">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Users Table */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
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
                    <TableHead>Data de Cadastro</TableHead>
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
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}