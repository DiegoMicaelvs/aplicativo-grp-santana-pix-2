import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { BackButton } from "@/components/ui/back-button";
import { ReferralConversationComponent } from "@/components/ui/referral-conversation";
import { Eye, FilterIcon, Loader2, Edit } from "lucide-react";
import { Link } from "wouter";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Referral, ReferralStatus, Company } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Helper function to get appropriate badge color based on status
const getStatusBadge = (status: ReferralStatus) => {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
    case 'converted':
      return <Badge variant="outline" className="bg-green-100 text-green-800">Convertido</Badge>;
    case 'analyzing':
      return <Badge variant="outline" className="bg-blue-100 text-blue-800">Em análise</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="bg-red-100 text-red-800">Não convertido</Badge>;
    case 'validated':
      return <Badge variant="outline" className="bg-purple-100 text-purple-800">Validado</Badge>;
    case 'paid':
      return <Badge variant="outline" className="bg-emerald-100 text-emerald-800">Pago</Badge>;
    default:
      return <Badge variant="outline">Desconhecido</Badge>;
  }
};

// Format date to Brazilian format
const formatDate = (dateStr: string | Date) => {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('pt-BR');
};

// Format currency to Brazilian Real
const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export default function ReferralsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReferralIds, setSelectedReferralIds] = useState<number[]>([]);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkEditCompanyId, setBulkEditCompanyId] = useState<string>("");
  
  const itemsPerPage = 10;
  
  // Fetch all referrals
  const { data: referrals, isLoading } = useQuery<Referral[]>({
    queryKey: ['/api/referrals'],
  });

  // Fetch all companies
  const { data: companies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });
  
  // Filter referrals based on status
  const filteredReferrals = referrals?.filter(referral => 
    statusFilter === "all" || referral.status === statusFilter
  ) || [];
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredReferrals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReferrals = filteredReferrals.slice(startIndex, startIndex + itemsPerPage);
  
  // Handle referral details view
  const handleViewDetails = (referral: Referral) => {
    setSelectedReferral(referral);
    setDialogOpen(true);
  };
  
  // Handle checkbox selection
  const handleSelectReferral = (referralId: number, checked: boolean) => {
    if (checked) {
      setSelectedReferralIds(prev => [...prev, referralId]);
    } else {
      setSelectedReferralIds(prev => prev.filter(id => id !== referralId));
    }
  };
  
  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReferralIds(paginatedReferrals.map(r => r.id));
    } else {
      setSelectedReferralIds([]);
    }
  };
  
  // Bulk edit mutation
  const bulkEditMutation = useMutation({
    mutationFn: async (data: { ids: number[], companyId: number }) => {
      const response = await fetch("/api/referrals/bulk-company-update", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar indicações");
      }
      
      return await response.json();
    },
    onSuccess: (data: { count: number }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/referrals'] });
      toast({
        title: "Sucesso!",
        description: `${data.count} indicação(ões) atualizada(s) com sucesso.`,
      });
      setSelectedReferralIds([]);
      setBulkEditDialogOpen(false);
      setBulkEditCompanyId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar indicações em massa.",
        variant: "destructive",
      });
    }
  });
  
  // Handle bulk edit submit
  const handleBulkEdit = () => {
    if (!bulkEditCompanyId || selectedReferralIds.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione uma empresa e pelo menos uma indicação.",
        variant: "destructive",
      });
      return;
    }
    
    bulkEditMutation.mutate({
      ids: selectedReferralIds,
      companyId: parseInt(bulkEditCompanyId)
    });
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="bg-gray-100 flex-grow py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-heading">Minhas Indicações</h1>
              <p className="mt-1 text-sm sm:text-base text-gray-600">
                {user?.role === 'indicador_nivel_1' ? 
                  'Acompanhe o status de todas as suas indicações' :
                  'Gerencie e acompanhe todas as suas indicações'
                }
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <BackButton to="/dashboard" />
              <Link href="/new-referral" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Nova Indicação</Button>
              </Link>
            </div>
          </div>
          
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Todas as Indicações</CardTitle>
                  <CardDescription>
                    {isLoading ? 'Carregando...' : `Total: ${filteredReferrals.length} indicação(ões)`}
                    {selectedReferralIds.length > 0 && ` • ${selectedReferralIds.length} selecionada(s)`}
                  </CardDescription>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {user?.role === 'admin' && selectedReferralIds.length > 0 && (
                    <Button 
                      onClick={() => setBulkEditDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      disabled={!companies || companies.length === 0}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Seguradora ({selectedReferralIds.length})
                    </Button>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <FilterIcon className="text-gray-400 h-4 w-4" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="processing">Em análise</SelectItem>
                        <SelectItem value="converted">Convertido</SelectItem>
                        <SelectItem value="rejected">Não convertido</SelectItem>
                        <SelectItem value="validated">Validado</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredReferrals.length > 0 ? (
                <>
                  {/* Mobile Card View */}
                  <div className="block md:hidden space-y-4">
                    {paginatedReferrals.map((referral) => {
                      const company = companies?.find((c) => c.id === referral.companyId);
                      return (
                        <Card key={referral.id} className="shadow-sm">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-start gap-3">
                                {user?.role === 'admin' && (
                                  <Checkbox
                                    checked={selectedReferralIds.includes(referral.id)}
                                    onCheckedChange={(checked) => handleSelectReferral(referral.id, checked as boolean)}
                                    className="mt-1 h-5 w-5 border-2"
                                  />
                                )}
                                <div>
                                  <h3 className="font-medium text-base">{referral.fullName}</h3>
                                  <p className="text-sm text-gray-600">{referral.phone}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                {getStatusBadge(referral.status)}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleViewDetails(referral)}
                                  className="text-xs"
                                >
                                  <Eye className="h-3 w-3 mr-1" /> Ver
                                </Button>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Placa:</span>
                                <span className="font-medium">{referral.licensePlate}</span>
                              </div>
                              
                              {referral.city && referral.state && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Local:</span>
                                  <span>{referral.city}/{referral.state}</span>
                                </div>
                              )}
                              
                              <div className="flex justify-between">
                                <span className="text-gray-500">Data:</span>
                                <span>{formatDate(referral.createdAt)}</span>
                              </div>
                              
                              {user?.role !== "indicador_nivel_1" && user?.role !== "indicador" && user?.role !== "promotor" && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Empresa:</span>
                                  <span className="text-blue-600 font-medium">
                                    {company?.name || `ID: ${referral.companyId}`}
                                  </span>
                                </div>
                              )}
                              
                              {user?.role !== "indicador_nivel_1" && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Comissão:</span>
                                  <span className="text-green-600 font-medium">
                                    {formatCurrency(referral.commissionIndicator)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {user?.role === 'admin' && (
                            <TableHead className="w-[70px]">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={paginatedReferrals.length > 0 && paginatedReferrals.every(r => selectedReferralIds.includes(r.id))}
                                  onCheckedChange={handleSelectAll}
                                  className="h-5 w-5 border-2"
                                />
                              </div>
                            </TableHead>
                          )}
                          <TableHead>Nome</TableHead>
                          <TableHead>Veículo</TableHead>
                          {user?.role !== "indicador_nivel_1" && user?.role !== "indicador" && user?.role !== "promotor" && <TableHead>Empresa</TableHead>}
                          <TableHead>Cidade/Estado</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          {user?.role !== "indicador_nivel_1" && <TableHead>Comissão</TableHead>}
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedReferrals.map((referral) => {
                          const company = companies?.find((c) => c.id === referral.companyId);
                          return (
                          <TableRow key={referral.id}>
                            {user?.role === 'admin' && (
                              <TableCell>
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={selectedReferralIds.includes(referral.id)}
                                    onCheckedChange={(checked) => handleSelectReferral(referral.id, checked as boolean)}
                                    className="h-5 w-5 border-2"
                                  />
                                </div>
                              </TableCell>
                            )}
                            <TableCell className="font-medium">
                              <div>
                                {referral.fullName}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {referral.phone}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>Placa: {referral.licensePlate}</div>
                            </TableCell>
                            {user?.role !== "indicador_nivel_1" && user?.role !== "indicador" && user?.role !== "promotor" && (
                              <TableCell>
                                <span className="text-sm font-medium text-blue-600">
                                  {company?.name || `ID: ${referral.companyId}`}
                                </span>
                              </TableCell>
                            )}
                            <TableCell>
                              {referral.city && referral.state ? (
                                <span className="text-sm">
                                  {referral.city}/{referral.state}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>{formatDate(referral.createdAt)}</TableCell>
                            <TableCell>{getStatusBadge(referral.status)}</TableCell>
                            {user?.role !== "indicador_nivel_1" && (
                              <TableCell>{formatCurrency(referral.commissionIndicator)}</TableCell>
                            )}
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleViewDetails(referral)}
                              >
                                <Eye className="h-4 w-4 mr-1" /> Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="mt-6">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                            // Show first page, last page, current page, and pages around current
                            if (
                              page === 1 || 
                              page === totalPages || 
                              (page >= currentPage - 1 && page <= currentPage + 1)
                            ) {
                              return (
                                <PaginationItem key={page}>
                                  <PaginationLink
                                    isActive={page === currentPage}
                                    onClick={() => setCurrentPage(page)}
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            }
                            
                            // Show ellipsis for gaps
                            if (page === currentPage - 2 || page === currentPage + 2) {
                              return (
                                <PaginationItem key={page}>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              );
                            }
                            
                            return null;
                          })}
                          
                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">Nenhuma indicação encontrada.</p>
                  <Link href="/new-referral">
                    <Button>Fazer Nova Indicação</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Referral Details Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">Detalhes da Indicação</DialogTitle>
                <DialogDescription>
                  Informações completas sobre esta indicação
                </DialogDescription>
              </DialogHeader>
              
              {selectedReferral && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Status</h4>
                      <div className="mt-1">{getStatusBadge(selectedReferral.status)}</div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Data da Indicação</h4>
                      <p className="mt-1">{formatDate(selectedReferral.createdAt)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Dados do Indicado</h4>
                      <div className="mt-1 space-y-1">
                        <p><span className="font-medium">Nome:</span> {selectedReferral.fullName}</p>
                        <p><span className="font-medium">Telefone:</span> {selectedReferral.phone}</p>
                        {selectedReferral.city && selectedReferral.state && (
                          <p><span className="font-medium">Localização:</span> {selectedReferral.city}/{selectedReferral.state}</p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Dados do Veículo</h4>
                      <div className="mt-1 space-y-1">
                        <p><span className="font-medium">Placa:</span> {selectedReferral.licensePlate}</p>
                      </div>
                    </div>
                  </div>
                  
                  {user?.role !== 'indicador_nivel_1' && (selectedReferral.status === 'converted' || selectedReferral.status === 'validated' || selectedReferral.status === 'paid') && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Comissão</h4>
                      <p className="mt-1 text-lg font-medium text-green-600">
                        {formatCurrency(selectedReferral.commissionIndicator)}
                      </p>
                    </div>
                  )}
                  
                  {user?.role !== 'indicador_nivel_1' && selectedReferral.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Notas do Sistema</h4>
                      <p className="mt-1 text-sm text-gray-600">{selectedReferral.notes}</p>
                    </div>
                  )}
                  
                  {/* Conversation Component */}
                  <ReferralConversationComponent 
                    referralId={selectedReferral.id} 
                    userRole={user?.role || "indicador"}
                  />
                </div>
              )}
              
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setDialogOpen(false)}>Fechar</Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Bulk Edit Dialog */}
          <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Editar Seguradora em Massa</DialogTitle>
                <DialogDescription>
                  Altere a seguradora de {selectedReferralIds.length} indicação(ões) selecionada(s)
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="company-select" className="text-sm font-medium">
                    Selecione a nova seguradora:
                  </label>
                  <Select value={bulkEditCompanyId} onValueChange={setBulkEditCompanyId}>
                    <SelectTrigger id="company-select">
                      <SelectValue placeholder="Escolha uma seguradora" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <p className="text-sm text-gray-600">
                  Esta ação atualizará a seguradora de todas as indicações selecionadas.
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setBulkEditDialogOpen(false);
                    setBulkEditCompanyId("");
                  }}
                  disabled={bulkEditMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleBulkEdit}
                  disabled={bulkEditMutation.isPending || !bulkEditCompanyId}
                >
                  {bulkEditMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    'Atualizar Seguradora'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
