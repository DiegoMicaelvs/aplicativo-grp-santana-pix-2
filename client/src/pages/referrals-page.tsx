import { useState, useMemo, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { BackButton } from "@/components/ui/back-button";
import { ReferralConversationComponent } from "@/components/ui/referral-conversation";
import { Eye, FilterIcon, Loader2, Edit, CheckCircle, Upload, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Referral, ReferralStatus, Company } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

// Contact Status types and labels
type ContactStatus = "retornar_contato" | "sem_sucesso" | "em_negociacao" | "aguardando_pagamento" | "enviar_cotacao" | null;

const contactStatusLabels: Record<string, string> = {
  retornar_contato: "Retornar Contato",
  sem_sucesso: "Sem Sucesso",
  em_negociacao: "Em negociação",
  aguardando_pagamento: "Aguardando pagamento",
  enviar_cotacao: "Enviar cotação"
};

const contactStatusColors: Record<string, string> = {
  retornar_contato: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sem_sucesso: "bg-red-100 text-red-800 border-red-300",
  em_negociacao: "bg-blue-100 text-blue-800 border-blue-300",
  aguardando_pagamento: "bg-purple-100 text-purple-800 border-purple-300",
  enviar_cotacao: "bg-orange-100 text-orange-800 border-orange-300"
};

// Contact Status Badge Component - optimized for performance
function ContactStatusBadge({ referral, onUpdate }: { referral: any; onUpdate: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const handleStatusChange = async (status: ContactStatus) => {
    setIsPending(true);
    try {
      const response = await fetch(`/api/referrals/${referral.id}/contact-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contactStatus: status }),
      });
      if (!response.ok) throw new Error("Erro ao atualizar status de contato");
      
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      toast({ title: "Status de contato atualizado!" });
      setIsOpen(false);
      onUpdate();
    } catch (error) {
      toast({ title: "Erro ao atualizar status de contato", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const currentStatus = referral.contactStatus as ContactStatus;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-xs px-2 h-7 whitespace-nowrap bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
        >
          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
          <span>Contato</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="end" sideOffset={4}>
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-gray-500 px-2 py-1">Status do Contato</p>
          {Object.entries(contactStatusLabels).map(([value, label]) => (
            <Button
              key={value}
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start text-sm h-8",
                currentStatus === value && "bg-accent"
              )}
              onClick={() => handleStatusChange(value as ContactStatus)}
              disabled={isPending}
            >
              <div className={cn("w-2 h-2 rounded-full mr-2", contactStatusColors[value]?.split(' ')[0])} />
              {label}
            </Button>
          ))}
          {currentStatus && (
            <>
              <div className="border-t my-1" />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm text-gray-500 h-8"
                onClick={() => handleStatusChange(null)}
                disabled={isPending}
              >
                <X className="h-3 w-3 mr-2" />
                Remover
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

// Helper function to get status label text
const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending": return "Pendente";
    case "analyzing": return "Em Análise";
    case "converted": return "Convertida";
    case "rejected": return "Rejeitada";
    case "validated": return "Validada";
    case "paid": return "Paga";
    case "false": return "Falso";
    case "not_validated": return "Não validado";
    case "not_converted": return "Não convertido";
    case "contact_list": return "Lista de contato";
    case "contact_status": return "Contato";
    case "system": return "Sistema";
    default: return status;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [contactStatusFilter, setContactStatusFilter] = useState<string>("all_contact_statuses");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReferralIds, setSelectedReferralIds] = useState<number[]>([]);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkEditCompanyId, setBulkEditCompanyId] = useState<string>("");
  
  // States for indicador_nivel_1 conversion feature
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [referralToConvert, setReferralToConvert] = useState<Referral | null>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const [convertObservation, setConvertObservation] = useState<string>("");
  
  // States for indicador_nivel_1 company editing
  const [editCompanyDialogOpen, setEditCompanyDialogOpen] = useState(false);
  const [referralToEditCompany, setReferralToEditCompany] = useState<Referral | null>(null);
  const [selectedNewCompanyId, setSelectedNewCompanyId] = useState<string>("");
  
  // Debounce search query - increased to 500ms for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Fetch all referrals with search and status filter (no pagination)
  const { data: referralsResponse, isLoading } = useQuery<{
    data: Referral[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['/api/referrals', { page: 1, limit: 10000, status: statusFilter, search: debouncedSearch }],
  });

  // Fetch all companies once
  const { data: companies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });
  
  // Create companies map for O(1) lookups
  const companiesMap = useMemo(() => {
    if (!companies) return new Map<number, Company>();
    return new Map(companies.map(c => [c.id, c]));
  }, [companies]);
  
  // Apply contact status filter client-side
  const allReferrals = useMemo(() => {
    const data = referralsResponse?.data || [];
    if (contactStatusFilter === "all_contact_statuses") {
      return data;
    }
    if (contactStatusFilter === "no_contact_status") {
      return data.filter(r => !r.contactStatus);
    }
    return data.filter(r => r.contactStatus === contactStatusFilter);
  }, [referralsResponse?.data, contactStatusFilter]);
  
  // Handle referral details view - memoized to avoid re-creating on every render
  const handleViewDetails = useCallback((referral: Referral) => {
    setSelectedReferral(referral);
    setDialogOpen(true);
  }, []);
  
  // Handle checkbox selection - memoized
  const handleSelectReferral = useCallback((referralId: number, checked: boolean) => {
    if (checked) {
      setSelectedReferralIds(prev => [...prev, referralId]);
    } else {
      setSelectedReferralIds(prev => prev.filter(id => id !== referralId));
    }
  }, []);
  
  // Handle select all - memoized with allReferrals dependency
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedReferralIds(allReferrals.map(r => r.id));
    } else {
      setSelectedReferralIds([]);
    }
  }, [allReferrals]);
  
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
  
  // Handle file selection for payment proof
  const handlePaymentProofChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentProofFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPaymentProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);
  
  // Reset conversion dialog state
  const resetConvertDialog = useCallback(() => {
    setConvertDialogOpen(false);
    setReferralToConvert(null);
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
    setConvertObservation("");
  }, []);
  
  // Open conversion dialog
  const handleOpenConvertDialog = useCallback((referral: Referral) => {
    setReferralToConvert(referral);
    setConvertDialogOpen(true);
  }, []);
  
  // Convert referral mutation (for indicador_nivel_1)
  const convertMutation = useMutation({
    mutationFn: async (data: { referralId: number; paymentProof: string; observation?: string }) => {
      const response = await apiRequest("PATCH", `/api/referrals/${data.referralId}/status`, {
        status: "converted",
        paymentProof: data.paymentProof,
        observation: data.observation
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/referrals'] });
      toast({
        title: "Sucesso!",
        description: "Indicação convertida com sucesso!",
      });
      resetConvertDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao converter indicação.",
        variant: "destructive",
      });
    }
  });
  
  // Handle conversion submit
  const handleConvertSubmit = async () => {
    if (!referralToConvert || !paymentProofPreview) {
      toast({
        title: "Atenção",
        description: "Anexe o comprovante de pagamento para converter a indicação.",
        variant: "destructive",
      });
      return;
    }
    
    convertMutation.mutate({
      referralId: referralToConvert.id,
      paymentProof: paymentProofPreview,
      observation: convertObservation.trim() || undefined
    });
  };
  
  // Open company edit dialog (for indicador_nivel_1)
  const handleOpenEditCompanyDialog = useCallback((referral: Referral) => {
    setReferralToEditCompany(referral);
    setSelectedNewCompanyId(referral.companyId.toString());
    setEditCompanyDialogOpen(true);
  }, []);
  
  // Edit company mutation (for indicador_nivel_1)
  const editCompanyMutation = useMutation({
    mutationFn: async (data: { referralId: number; companyId: number }) => {
      const response = await fetch(`/api/referrals/${data.referralId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: data.companyId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar seguradora");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/referrals'] });
      toast({
        title: "Sucesso!",
        description: "Seguradora atualizada com sucesso!",
      });
      setEditCompanyDialogOpen(false);
      setReferralToEditCompany(null);
      setSelectedNewCompanyId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar seguradora.",
        variant: "destructive",
      });
    }
  });
  
  // Handle company edit submit
  const handleEditCompanySubmit = () => {
    if (!referralToEditCompany || !selectedNewCompanyId) {
      toast({
        title: "Atenção",
        description: "Selecione uma seguradora.",
        variant: "destructive",
      });
      return;
    }
    
    editCompanyMutation.mutate({
      referralId: referralToEditCompany.id,
      companyId: parseInt(selectedNewCompanyId)
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
                  <CardTitle>
                    {user?.role === 'indicador_nivel_1' ? 'Indicações Validadas' : 'Todas as Indicações'}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground mt-[10px] mb-[10px]">
                    {isLoading ? 'Carregando...' : `Total: ${referralsResponse?.total || 0} indicação(ões)`}
                    {user?.role === 'indicador_nivel_1' && ' • Clique em "Converter" para confirmar a venda'}
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
                  
                  {/* Hide status filter for indicador_nivel_1 - they only see validated */}
                  {user?.role !== 'indicador_nivel_1' && (
                    <div className="flex items-center space-x-2">
                      <FilterIcon className="text-gray-400 h-4 w-4" />
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Status</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="analyzing">Em análise</SelectItem>
                          <SelectItem value="converted">Convertido</SelectItem>
                          <SelectItem value="rejected">Não convertido</SelectItem>
                          <SelectItem value="validated">Validado</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Contact status filter - available for all roles */}
                  <div className="flex items-center space-x-2">
                    <Select value={contactStatusFilter} onValueChange={setContactStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status Contato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_contact_statuses">Todos Contatos</SelectItem>
                        <SelectItem value="no_contact_status">Sem Status</SelectItem>
                        <SelectItem value="retornar_contato">Retornar Contato</SelectItem>
                        <SelectItem value="sem_sucesso">Sem Sucesso</SelectItem>
                        <SelectItem value="em_negociacao">Em negociação</SelectItem>
                        <SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Search Input */}
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Pesquisar por nome, placa, telefone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {debouncedSearch && (
                  <p className="text-sm text-gray-500 mt-2">
                    Resultados para: <span className="font-medium">"{debouncedSearch}"</span>
                  </p>
                )}
                
                {/* Total count indicator */}
                {!isLoading && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">{referralsResponse?.total || allReferrals.length}</span> indicação(ões) encontrada(s)
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : allReferrals.length > 0 ? (
                <>
                  {/* Mobile Card View */}
                  <div className="block md:hidden space-y-4">
                    {allReferrals.map((referral) => {
                      const company = companiesMap.get(referral.companyId);
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
                                <div className="flex flex-wrap gap-1 justify-end">
                                  {getStatusBadge(referral.status)}
                                  {referral.contactStatus && (
                                    <Badge variant="outline" className={contactStatusColors[referral.contactStatus] || "bg-gray-100 text-gray-800"}>
                                      {contactStatusLabels[referral.contactStatus] || "Sem status"}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1 justify-end">
                                  <ContactStatusBadge 
                                    referral={referral} 
                                    onUpdate={() => {}} 
                                  />
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleViewDetails(referral)}
                                    className="text-xs"
                                  >
                                    <Eye className="h-3 w-3 mr-1" /> Ver
                                  </Button>
                                  {user?.role === 'indicador_nivel_1' && referral.status === 'validated' && (
                                    <Button 
                                      variant="default" 
                                      size="sm" 
                                      onClick={() => handleOpenConvertDialog(referral)}
                                      className="text-xs bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" /> Converter
                                    </Button>
                                  )}
                                </div>
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
                              
                              {user?.role !== "indicador" && user?.role !== "promotor" && (
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Seguradora:</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-blue-600 font-medium">
                                      {company?.name || `ID: ${referral.companyId}`}
                                    </span>
                                    {user?.role === "indicador_nivel_1" && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="h-6 px-1"
                                        onClick={() => handleOpenEditCompanyDialog(referral)}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
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
                                  checked={allReferrals.length > 0 && allReferrals.every(r => selectedReferralIds.includes(r.id))}
                                  onCheckedChange={handleSelectAll}
                                  className="h-5 w-5 border-2"
                                />
                              </div>
                            </TableHead>
                          )}
                          <TableHead>Nome</TableHead>
                          <TableHead>Veículo</TableHead>
                          {user?.role !== "indicador" && user?.role !== "promotor" && <TableHead>Seguradora</TableHead>}
                          <TableHead>Cidade/Estado</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Contato</TableHead>
                          {user?.role !== "indicador_nivel_1" && <TableHead>Comissão</TableHead>}
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allReferrals.map((referral) => {
                          const company = companiesMap.get(referral.companyId);
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
                            {user?.role !== "indicador" && user?.role !== "promotor" && (
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium text-blue-600">
                                    {company?.name || `ID: ${referral.companyId}`}
                                  </span>
                                  {user?.role === "indicador_nivel_1" && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-6 px-1"
                                      onClick={() => handleOpenEditCompanyDialog(referral)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
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
                            <TableCell>
                              {referral.contactStatus ? (
                                <Badge variant="outline" className={contactStatusColors[referral.contactStatus] || "bg-gray-100 text-gray-800"}>
                                  {contactStatusLabels[referral.contactStatus] || "Sem status"}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </TableCell>
                            {user?.role !== "indicador_nivel_1" && (
                              <TableCell>{formatCurrency(referral.commissionIndicator)}</TableCell>
                            )}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <ContactStatusBadge 
                                  referral={referral} 
                                  onUpdate={() => {}} 
                                />
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleViewDetails(referral)}
                                >
                                  <Eye className="h-4 w-4 mr-1" /> Detalhes
                                </Button>
                                {user?.role === 'indicador_nivel_1' && referral.status === 'validated' && (
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    onClick={() => handleOpenConvertDialog(referral)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" /> Converter
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Status</h4>
                      <div className="mt-1">{getStatusBadge(selectedReferral.status)}</div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Contato</h4>
                      <div className="mt-1">
                        {(selectedReferral as any).contactStatus ? (
                          <Badge variant="outline" className={contactStatusColors[(selectedReferral as any).contactStatus] || "bg-gray-100 text-gray-800"}>
                            {contactStatusLabels[(selectedReferral as any).contactStatus] || "Sem status"}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-400">Sem status de contato</span>
                        )}
                      </div>
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
                  
                  {/* Status History Section */}
                  {(selectedReferral as any).statusHistory && (selectedReferral as any).statusHistory.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-500">Histórico de Alterações</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(selectedReferral as any).statusHistory
                          .sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                          .map((entry: any, index: number) => {
                            const entryDate = new Date(entry.changedAt);
                            const isContactStatus = entry.status === 'contact_status';
                            
                            return (
                              <div 
                                key={index} 
                                className={`p-3 rounded-lg border-l-4 ${
                                  isContactStatus 
                                    ? 'bg-purple-50 border-purple-400' 
                                    : 'bg-gray-50 border-blue-200'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        isContactStatus 
                                          ? 'bg-purple-100 text-purple-700 border-purple-300' 
                                          : ''
                                      }`}
                                    >
                                      {getStatusLabel(entry.status)}
                                    </Badge>
                                    {entry.changedByName && (
                                      <span className="text-xs text-gray-600 font-medium">
                                        por {entry.changedByName}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {entryDate.toLocaleDateString('pt-BR')} às {entryDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                {entry.notes && (
                                  <p className="text-sm text-gray-700 mt-1">{entry.notes}</p>
                                )}
                              </div>
                            );
                          })}
                      </div>
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
                      {companies?.filter((company) => company.isActive).map((company) => (
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
          
          {/* Convert Referral Dialog (for indicador_nivel_1) */}
          <Dialog open={convertDialogOpen} onOpenChange={(open) => !open && resetConvertDialog()}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Converter Indicação</DialogTitle>
                <DialogDescription>
                  Confirme a venda anexando o comprovante de pagamento
                </DialogDescription>
              </DialogHeader>
              
              {referralToConvert && (
                <div className="space-y-4 py-4">
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                    <p className="text-sm"><strong>Cliente:</strong> {referralToConvert.fullName}</p>
                    <p className="text-sm"><strong>Telefone:</strong> {referralToConvert.phone}</p>
                    <p className="text-sm"><strong>Placa:</strong> {referralToConvert.licensePlate}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="payment-proof" className="text-sm font-medium">
                      Comprovante de Pagamento *
                    </Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                      <Input
                        id="payment-proof"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handlePaymentProofChange}
                        className="hidden"
                      />
                      <label htmlFor="payment-proof" className="cursor-pointer">
                        {paymentProofPreview ? (
                          <div className="space-y-2">
                            {paymentProofPreview.startsWith('data:image') ? (
                              <img 
                                src={paymentProofPreview} 
                                alt="Preview" 
                                className="max-h-40 mx-auto rounded"
                              />
                            ) : (
                              <div className="text-green-600 flex items-center justify-center gap-2">
                                <CheckCircle className="h-6 w-6" />
                                <span>Arquivo selecionado</span>
                              </div>
                            )}
                            <p className="text-sm text-gray-500">Clique para trocar o arquivo</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="h-8 w-8 mx-auto text-gray-400" />
                            <p className="text-sm text-gray-600">
                              Clique para selecionar o comprovante
                            </p>
                            <p className="text-xs text-gray-400">
                              Formatos aceitos: JPG, PNG, PDF
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="convert-observation" className="text-sm font-medium">
                      Observação (opcional)
                    </Label>
                    <Textarea
                      id="convert-observation"
                      placeholder="Adicione uma observação sobre esta conversão..."
                      value={convertObservation}
                      onChange={(e) => setConvertObservation(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    Ao converter, você confirma que a venda foi realizada e o cliente efetuou o pagamento.
                  </p>
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={resetConvertDialog}
                  disabled={convertMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConvertSubmit}
                  disabled={convertMutation.isPending || !paymentProofPreview}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {convertMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Convertendo...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirmar Conversão
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Edit Company Dialog (for indicador_nivel_1) */}
          <Dialog open={editCompanyDialogOpen} onOpenChange={(open) => {
            if (!open) {
              setEditCompanyDialogOpen(false);
              setReferralToEditCompany(null);
              setSelectedNewCompanyId("");
            }
          }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Alterar Seguradora</DialogTitle>
                <DialogDescription>
                  Altere a seguradora desta indicação
                </DialogDescription>
              </DialogHeader>
              
              {referralToEditCompany && (
                <div className="space-y-4 py-4">
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                    <p className="text-sm"><strong>Cliente:</strong> {referralToEditCompany.fullName}</p>
                    <p className="text-sm"><strong>Telefone:</strong> {referralToEditCompany.phone}</p>
                    <p className="text-sm"><strong>Placa:</strong> {referralToEditCompany.licensePlate}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-company-select" className="text-sm font-medium">
                      Selecione a nova seguradora:
                    </Label>
                    <Select value={selectedNewCompanyId} onValueChange={setSelectedNewCompanyId}>
                      <SelectTrigger id="edit-company-select">
                        <SelectValue placeholder="Escolha uma seguradora" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies?.filter((company) => company.isActive).map((company) => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEditCompanyDialogOpen(false);
                    setReferralToEditCompany(null);
                    setSelectedNewCompanyId("");
                  }}
                  disabled={editCompanyMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleEditCompanySubmit}
                  disabled={editCompanyMutation.isPending || !selectedNewCompanyId}
                >
                  {editCompanyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    'Salvar Seguradora'
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
