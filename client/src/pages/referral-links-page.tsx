import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Plus, 
  Copy, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Eye,
  Users,
  MousePointer,
  TrendingUp
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ReferralLink } from "@shared/schema";

interface ReferralLinkFormData {
  name: string;
  isActive: boolean;
}

export function ReferralLinksPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<ReferralLink | null>(null);
  const [formData, setFormData] = useState<ReferralLinkFormData>({
    name: "",
    isActive: true
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch referral links
  const { data: links = [], isLoading } = useQuery<ReferralLink[]>({
    queryKey: ["/api/referral-links"],
    refetchInterval: 30000, // Refresh every 30 seconds for stats
  });

  // Create link mutation
  const createMutation = useMutation({
    mutationFn: (data: ReferralLinkFormData) => 
      apiRequest("POST", "/api/referral-links", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-links"] });
      setCreateDialogOpen(false);
      setFormData({ name: "", isActive: true });
      toast({
        title: "Sucesso",
        description: "Link de referência criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar link de referência",
        variant: "destructive",
      });
    }
  });

  // Update link mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReferralLinkFormData }) => 
      apiRequest("PATCH", `/api/referral-links/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-links"] });
      setEditDialogOpen(false);
      setSelectedLink(null);
      toast({
        title: "Sucesso",
        description: "Link de referência atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar link de referência",
        variant: "destructive",
      });
    }
  });

  // Delete link mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("DELETE", `/api/referral-links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-links"] });
      toast({
        title: "Sucesso",
        description: "Link de referência excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir link de referência",
        variant: "destructive",
      });
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    createMutation.mutate(formData);
  };

  const handleEdit = (link: ReferralLink) => {
    setSelectedLink(link);
    setFormData({
      name: link.name,
      isActive: link.isActive
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLink || !formData.name.trim()) return;
    updateMutation.mutate({ id: selectedLink.id, data: formData });
  };

  const handleDelete = (link: ReferralLink) => {
    if (confirm(`Tem certeza que deseja excluir o link "${link.name}"?`)) {
      deleteMutation.mutate(link.id);
    }
  };

  const copyLinkToClipboard = (token: string) => {
    const url = `https://cadastro.souindicador.com.br/ref/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Copiado!",
        description: "Link copiado para a área de transferência",
      });
    });
  };

  const getFullLink = (token: string) => `https://cadastro.souindicador.com.br/ref/${token}`;

  const calculateConversionRate = (clicks: number, registrations: number) => {
    if (clicks === 0) return 0;
    return ((registrations / clicks) * 100).toFixed(1);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Links de Referência</h1>
          <p className="text-muted-foreground">
            Gerencie seus links de cadastro e acompanhe as estatísticas
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Link de Referência</DialogTitle>
              <DialogDescription>
                Crie um link personalizado para rastrear cadastros
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Link</Label>
                <Input
                  id="name"
                  placeholder="Ex: Campanha Instagram, Feira de Negócios..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Link ativo</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Link"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Overview */}
      {links.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Links</CardTitle>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{links.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cliques</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {links.reduce((sum, link) => sum + (link.clicks || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cadastros</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {links.reduce((sum, link) => sum + (link.registrations || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {calculateConversionRate(
                  links.reduce((sum, link) => sum + (link.clicks || 0), 0),
                  links.reduce((sum, link) => sum + (link.registrations || 0), 0)
                )}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Links Table */}
      <Card>
        <CardHeader>
          <CardTitle>Seus Links de Referência</CardTitle>
          <CardDescription>
            {links.length === 0 
              ? "Você ainda não possui links de referência" 
              : `${links.length} link${links.length > 1 ? 's' : ''} cadastrado${links.length > 1 ? 's' : ''}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="text-center py-8">
              <ExternalLink className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum link encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro link de referência para começar a rastrear cadastros
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Link
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cliques</TableHead>
                  <TableHead>Cadastros</TableHead>
                  <TableHead>Conversão</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.name}</TableCell>
                    <TableCell>
                      <Badge variant={link.isActive ? "default" : "secondary"}>
                        {link.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{link.clicks || 0}</TableCell>
                    <TableCell>{link.registrations || 0}</TableCell>
                    <TableCell>
                      {calculateConversionRate(link.clicks || 0, link.registrations || 0)}%
                    </TableCell>
                    <TableCell>
                      {new Date(link.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLinkToClipboard(link.linkToken)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(link)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(link)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Link de Referência</DialogTitle>
            <DialogDescription>
              Atualize as informações do seu link
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome do Link</Label>
              <Input
                id="edit-name"
                placeholder="Ex: Campanha Instagram, Feira de Negócios..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="edit-isActive">Link ativo</Label>
            </div>
            {selectedLink && (
              <div className="space-y-2">
                <Label>Link de Referência</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={getFullLink(selectedLink.linkToken)}
                    readOnly
                    className="bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyLinkToClipboard(selectedLink.linkToken)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}