import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Eye, FilterIcon, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Referral, ReferralStatus } from "@shared/schema";

// Helper function to get appropriate badge color based on status
const getStatusBadge = (status: ReferralStatus) => {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
    case 'converted':
      return <Badge variant="outline" className="bg-green-100 text-green-800">Convertido</Badge>;
    case 'processing':
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
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const itemsPerPage = 10;
  
  // Fetch all referrals
  const { data: referrals, isLoading } = useQuery<Referral[]>({
    queryKey: ['/api/referrals'],
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
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="bg-gray-100 flex-grow py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-heading">Minhas Indicações</h1>
              <p className="mt-1 text-gray-600">Gerencie e acompanhe todas as suas indicações</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Link href="/new-referral">
                <Button>Nova Indicação</Button>
              </Link>
            </div>
          </div>
          
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Todas as Indicações</CardTitle>
                  <CardDescription>
                    {isLoading ? 'Carregando...' : `Total: ${filteredReferrals.length} indicação(ões)`}
                  </CardDescription>
                </div>
                
                <div className="mt-4 sm:mt-0 flex items-center space-x-2">
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
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredReferrals.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Veículo</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Comissão</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedReferrals.map((referral) => (
                          <TableRow key={referral.id}>
                            <TableCell className="font-medium">
                              <div>
                                {referral.firstName} {referral.lastName}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {referral.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>Placa: {referral.licensePlate}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                Tel: {referral.phone}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(referral.createdAt)}</TableCell>
                            <TableCell>{getStatusBadge(referral.status)}</TableCell>
                            <TableCell>{formatCurrency(referral.commission)}</TableCell>
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
                        ))}
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
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Detalhes da Indicação</DialogTitle>
                <DialogDescription>
                  Informações completas sobre esta indicação
                </DialogDescription>
              </DialogHeader>
              
              {selectedReferral && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Status</h4>
                      <div className="mt-1">{getStatusBadge(selectedReferral.status)}</div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Data da Indicação</h4>
                      <p className="mt-1">{formatDate(selectedReferral.createdAt)}</p>
                    </div>
                  </div>
                  
                  {selectedReferral.comments && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Comentários</h4>
                      <p className="mt-1">{selectedReferral.comments}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Dados do Indicado</h4>
                    <div className="mt-1 space-y-1">
                      <p><span className="font-medium">Nome:</span> {selectedReferral.firstName} {selectedReferral.lastName}</p>
                      <p><span className="font-medium">Email:</span> {selectedReferral.email}</p>
                      <p><span className="font-medium">Telefone:</span> {selectedReferral.phone}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Dados do Veículo</h4>
                    <div className="mt-1 space-y-1">
                      <p><span className="font-medium">Placa:</span> {selectedReferral.licensePlate}</p>
                    </div>
                  </div>
                  
                  {(selectedReferral.status === 'converted' || selectedReferral.status === 'validated' || selectedReferral.status === 'paid') && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Comissão</h4>
                      <p className="mt-1 text-lg font-medium text-green-600">
                        {formatCurrency(selectedReferral.commission)}
                      </p>
                      {selectedReferral.status === 'paid' && selectedReferral.paidAt && (
                        <p className="text-sm text-gray-500">
                          Pago em {formatDate(selectedReferral.paidAt)}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {selectedReferral.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Notas do Sistema</h4>
                      <p className="mt-1 text-sm text-gray-600">{selectedReferral.notes}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex justify-end">
                <Button onClick={() => setDialogOpen(false)}>Fechar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
