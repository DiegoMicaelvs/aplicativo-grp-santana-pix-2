import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Edit, CheckCircle, XCircle, Info, Clock, DollarSign, AlertCircle, Shield, RefreshCw, Download, Phone, ChevronDown, FileBarChart } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Referral, User, Company, AnalystPermission } from "@shared/schema";
import { validateReferralSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import XLSX from 'xlsx-js-style';

type ValidateFormValues = z.infer<typeof validateReferralSchema>;

const editSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(["pending", "analyzing", "validated", "converted", "rejected", "paid", "false", "not_validated", "not_converted", "contact_list"]),
  paymentProof: z.string().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  licensePlate: z.string().optional(),
  companyId: z.number().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  analyzing: "bg-blue-100 text-blue-800",
  converted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  validated: "bg-purple-100 text-purple-800",
  paid: "bg-emerald-100 text-emerald-800",
  false: "bg-orange-100 text-orange-800",
  not_validated: "bg-gray-100 text-gray-800",
  not_converted: "bg-gray-100 text-gray-800",
  contact_list: "bg-cyan-100 text-cyan-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Em Processamento",
  analyzing: "Em Análise",
  converted: "Convertido",
  rejected: "Rejeitado",
  validated: "Validado",
  paid: "Pago",
  false: "Falso",
  not_validated: "Não Validado",
  not_converted: "Não Convertido",
  contact_list: "Lista de contato",
};

type ContactStatus = "retornar_contato" | "sem_sucesso" | "em_negociacao" | "aguardando_pagamento" | null;

const contactStatusLabels: Record<string, string> = {
  retornar_contato: "Retornar Contato",
  sem_sucesso: "Sem Sucesso",
  em_negociacao: "Em negociação",
  aguardando_pagamento: "Aguardando pagamento",
};

const contactStatusColors: Record<string, string> = {
  retornar_contato: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sem_sucesso: "bg-red-100 text-red-800 border-red-300",
  em_negociacao: "bg-blue-100 text-blue-800 border-blue-300",
  aguardando_pagamento: "bg-purple-100 text-purple-800 border-purple-300",
};

// Component to show status badge with popover showing who last updated it
// Uses Popover for click support on mobile devices
// Only shows referral status changes, NOT contact status changes
function StatusBadgeWithTooltip({ 
  referral, 
  usersMap 
}: { 
  referral: Referral; 
  usersMap: Map<number, User>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Get the latest REFERRAL status change from history (excluding contact_status and system)
  const lastStatusChange = useMemo(() => {
    if (!referral.statusHistory || referral.statusHistory.length === 0) {
      return null;
    }
    // Filter only referral status changes (exclude 'contact_status' and 'system' entries)
    const referralStatusChanges = referral.statusHistory.filter(
      (entry: any) => entry.status !== 'contact_status' && entry.status !== 'system'
    );
    
    if (referralStatusChanges.length === 0) {
      return null;
    }
    
    // Sort by date descending and get the latest
    const sorted = [...referralStatusChanges].sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
    return sorted[0];
  }, [referral.statusHistory]);

  const lastUpdatedBy = lastStatusChange ? usersMap.get(lastStatusChange.changedBy) : null;
  const lastUpdatedAt = lastStatusChange ? new Date(lastStatusChange.changedAt) : null;

  if (!lastStatusChange) {
    return (
      <Badge className={`${statusColors[referral.status]} text-xs`}>
        {statusLabels[referral.status]}
      </Badge>
    );
  }

  // Also check for changedByName in the history entry as a fallback
  const lastUpdaterName = lastUpdatedBy?.fullName || (lastStatusChange as any).changedByName || 'Usuário não encontrado';
  const statusChangedTo = statusLabels[lastStatusChange.status as keyof typeof statusLabels] || lastStatusChange.status;

  const statusInfoContent = (
    <div className="text-xs space-y-1">
      <p className="font-semibold text-yellow-400">Status alterado para: {statusChangedTo}</p>
      <p>Por: <span className="font-medium">{lastUpdaterName}</span></p>
      {lastUpdatedAt && (
        <p>Em: {lastUpdatedAt.toLocaleDateString("pt-BR")} às {lastUpdatedAt.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</p>
      )}
      {lastStatusChange.notes && lastStatusChange.notes.trim() && lastStatusChange.notes !== 'Indicação criada' && (
        <p className="text-gray-300 italic mt-1 border-t border-gray-700 pt-1">"{lastStatusChange.notes}"</p>
      )}
    </div>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <span className="inline-block cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <Badge className={`${statusColors[referral.status]} text-xs`}>
            {statusLabels[referral.status]}
          </Badge>
        </span>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs bg-gray-900 text-white p-3 shadow-lg z-50 border-gray-700" side="top" sideOffset={4}>
        {statusInfoContent}
      </PopoverContent>
    </Popover>
  );
}

function ContactStatusDialog({ referral, onUpdate }: { referral: any; onUpdate: () => void }) {
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
      
      const updatedReferral = await response.json();
      
      // Surgical cache update - avoid slow refetch of 2900+ referrals
      queryClient.setQueryData<any[]>(["/api/analyst/referrals"], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((ref) => 
          ref.id === updatedReferral.id ? updatedReferral : ref
        );
      });
      
      toast({ title: "Status de contato atualizado!" });
      setIsOpen(false);
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
          className="text-xs"
          disabled={isPending}
        >
          <Phone className="h-3 w-3 mr-1" />
          <span>Contato</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <p className="text-xs font-medium text-gray-500 px-2 py-1">Status do Contato</p>
        {Object.entries(contactStatusLabels).map(([value, label]) => (
          <button
            key={value}
            className={cn(
              "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex items-center",
              currentStatus === value && "bg-gray-100 font-medium"
            )}
            onClick={() => handleStatusChange(value as ContactStatus)}
            disabled={isPending}
          >
            <div className={cn("w-2 h-2 rounded-full mr-2", contactStatusColors[value]?.split(' ')[0])} />
            {label}
          </button>
        ))}
        {currentStatus && (
          <button
            className="w-full text-left px-2 py-1.5 text-sm text-red-600 rounded hover:bg-gray-100 mt-1 border-t"
            onClick={() => handleStatusChange(null)}
            disabled={isPending}
          >
            Limpar status
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

const ITEMS_PER_PAGE = 50; // Número de itens por página para performance

export default function AnalystReferrals() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Enable real-time updates via WebSocket
  useRealtimeUpdates();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contactStatusFilter, setContactStatusFilter] = useState("all_contact_statuses");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [isValidateDialogOpen, setIsValidateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [paymentProof, setPaymentProof] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Fetch referrals with reduced refresh for better performance
  const { data: referrals = [], isLoading, refetch: refetchReferrals, isFetching } = useQuery<Referral[]>({
    queryKey: ["/api/analyst/referrals"],
    refetchInterval: false, // Desabilitado para melhorar performance
    refetchIntervalInBackground: false,
    staleTime: 5 * 60 * 1000, // Cache válido por 5 minutos
    refetchOnWindowFocus: false, // Desabilitado para reduzir carga
    refetchOnMount: true,
  });

  // Fetch users for display - use analyst endpoint for proper permissions
  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/analyst/users"],
    refetchInterval: false, // Desabilitado para melhorar performance
    staleTime: 5 * 60 * 1000, // Cache válido por 5 minutos
    refetchOnWindowFocus: false,
  });

  // Coletar IDs únicos de usuários do histórico de status (memoizado para performance)
  const statusHistoryUserIds = useMemo(() => {
    const ids = new Set<number>();
    referrals.forEach(referral => {
      if (referral.statusHistory) {
        referral.statusHistory.forEach((entry: any) => {
          if (entry.changedBy) ids.add(entry.changedBy);
        });
      }
    });
    return Array.from(ids);
  }, [referrals]);

  // Fetch specific users from status history if not in current user list (memoizado)
  const missingUserIds = useMemo(() => 
    statusHistoryUserIds.filter(id => !users.find(u => u.id === id)),
    [statusHistoryUserIds, users]
  );
  const { data: historyUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users/by-ids", missingUserIds],
    queryFn: async () => {
      if (missingUserIds.length === 0) return [];
      const response = await fetch('/api/users/by-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: missingUserIds })
      });
      if (!response.ok) throw new Error('Failed to fetch history users');
      return response.json();
    },
    enabled: missingUserIds.length > 0,
    staleTime: 60000, // Cache por 1 minuto
  });

  // Combinar lista de usuários normais com usuários do histórico (memoizado)
  const allUsers = useMemo(() => [...users, ...historyUsers], [users, historyUsers]);

  // Função para refresh manual
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchReferrals(),
        refetchUsers()
      ]);
      toast({ 
        title: "Dados atualizados", 
        description: "Lista de indicações foi atualizada com sucesso!" 
      });
    } catch (error) {
      toast({ 
        title: "Erro ao atualizar", 
        description: "Não foi possível atualizar os dados",
        variant: "destructive" 
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch companies for display
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const form = useForm<ValidateFormValues>({
    resolver: zodResolver(validateReferralSchema),
    defaultValues: {
      vehicleBrand: "Não informado",
      vehicleModel: "Não informado",
      vehicleYear: "2020",
      nameCorrect: true,
      plateCorrect: true,
      phoneCorrect: true,
      validationNotes: "",
    },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      notes: "",
      status: "pending",
    },
  });

  // Validate referral mutation
  const validateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ValidateFormValues }) => {
      const response = await fetch(`/api/referrals/${id}/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao validar indicação");
      }
      return response.json();
    },
    onSuccess: (updatedReferral: Referral) => {
      // Surgical cache update: update only the affected referral in the base list
      // No invalidation needed - surgical update is sufficient and avoids slow refetch of 2900+ referrals
      queryClient.setQueryData<Referral[]>(["/api/analyst/referrals"], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((ref) => 
          ref.id === updatedReferral.id ? updatedReferral : ref
        );
      });
      
      // Only invalidate stats (lightweight) - referrals are already updated via surgical cache update
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/stats"] });
      
      toast({ title: "Sucesso", description: "Indicação validada com sucesso!" });
      setIsValidateDialogOpen(false);
      setSelectedReferral(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Edit referral mutation - uses main referral endpoint for field edits
  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EditFormValues }) => {
      // Prepare update data - separate status update from field edits
      const updatePayload: any = {};
      
      // Field edits go to main referral endpoint
      if (data.fullName) updatePayload.fullName = data.fullName;
      if (data.phone) updatePayload.phone = data.phone;
      if (data.licensePlate) updatePayload.licensePlate = data.licensePlate?.toUpperCase();
      if (data.companyId) updatePayload.companyId = data.companyId;
      
      // If we have field edits, update them first
      if (Object.keys(updatePayload).length > 0) {
        const fieldResponse = await fetch(`/api/referrals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });
        if (!fieldResponse.ok) {
          const error = await fieldResponse.json();
          throw new Error(error.message || error.error || "Erro ao editar campos da indicação");
        }
      }
      
      // Then update status via status endpoint (preserves statusHistory)
      const response = await fetch(`/api/referrals/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: data.status,
          notes: data.notes,
          paymentProof: data.paymentProof
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Erro ao editar indicação");
      }
      return response.json();
    },
    onSuccess: async (updatedReferral) => {
      // Surgical cache update - no full refetch needed for 2900+ referrals
      queryClient.setQueryData(["/api/analyst/referrals"], (old: any[] = []) =>
        old.map(ref => ref.id === updatedReferral.id ? updatedReferral : ref)
      );
      
      // Only invalidate stats (lightweight) - referrals are already updated via surgical cache update
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/stats"] });
      
      toast({ title: "Sucesso", description: "Indicação editada com sucesso!" });
      setIsEditDialogOpen(false);
      setSelectedReferral(null);
      setPaymentProof(""); // Reset payment proof
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Check permissions - All analysts can edit referral status
  const canEdit = user?.role === "analista" || 
    (user?.permissions as AnalystPermission[])?.includes("edit_referral_status") || 
    user?.role === "admin";

  // Criar lookup map de usuários para busca O(1) (memoizado)
  const usersMap = useMemo(() => {
    const map = new Map<number, User>();
    allUsers.forEach(u => map.set(u.id, u));
    return map;
  }, [allUsers]);

  // Criar lookup map de empresas para busca O(1) (memoizado)
  const companiesMap = useMemo(() => {
    const map = new Map<number, Company>();
    companies.forEach(c => map.set(c.id, c));
    return map;
  }, [companies]);

  // Filter referrals (memoizado para evitar recálculos)
  const filteredReferrals = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return referrals.filter((referral) => {
      const referralUser = usersMap.get(referral.userId);
      const matchesSearch = !searchTerm || 
        referral.fullName?.toLowerCase().includes(searchLower) ||
        referral.phone?.includes(searchTerm) ||
        referral.licensePlate?.toLowerCase().includes(searchLower) ||
        referralUser?.fullName?.toLowerCase().includes(searchLower);
      const matchesStatus = statusFilter === "all" || referral.status === statusFilter;
      
      // Contact status filter
      let matchesContactStatus = true;
      if (contactStatusFilter !== "all_contact_statuses") {
        if (contactStatusFilter === "no_contact_status") {
          matchesContactStatus = !referral.contactStatus;
        } else {
          matchesContactStatus = referral.contactStatus === contactStatusFilter;
        }
      }
      
      return matchesSearch && matchesStatus && matchesContactStatus;
    });
  }, [referrals, searchTerm, statusFilter, contactStatusFilter, usersMap]);

  // Referências visíveis com paginação virtual (memoizado)
  const visibleReferrals = useMemo(() => 
    filteredReferrals.slice(0, visibleCount),
    [filteredReferrals, visibleCount]
  );

  // Reset visibleCount quando filtros mudam
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchTerm, statusFilter, contactStatusFilter]);

  // Carregar mais itens
  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredReferrals.length));
  }, [filteredReferrals.length]);

  // Function to convert file to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem (JPG, PNG, etc.)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "O arquivo deve ter no máximo 5MB",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      console.log('[handleFileChange] Comprovante carregado, tamanho:', result.length);
      setPaymentProof(result);
      // Also update the form value so it's included in the submit
      editForm.setValue("paymentProof", result);
    };
    reader.readAsDataURL(file);
  };

  // Function to download base64 image
  const downloadPaymentProof = (base64Data: string, referralId: number) => {
    try {
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = `comprovante-pagamento-${referralId}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Download iniciado",
        description: "O comprovante está sendo baixado"
      });
    } catch (error) {
      console.error('Error downloading payment proof:', error);
      toast({
        title: "Erro ao baixar",
        description: "Não foi possível baixar o comprovante",
        variant: "destructive"
      });
    }
  };

  const handleValidateClick = (referral: Referral) => {
    setSelectedReferral(referral);
    form.reset({
      vehicleBrand: referral.vehicleBrand || "Não informado",
      vehicleModel: referral.vehicleModel || "Não informado", 
      vehicleYear: referral.vehicleYear || "2020",
      nameCorrect: referral.nameCorrect ?? true,
      plateCorrect: referral.plateCorrect ?? true,
      phoneCorrect: referral.phoneCorrect ?? true,
      validationNotes: "",
    });
    setIsValidateDialogOpen(true);
  };

  const handleEditClick = (referral: Referral) => {
    setSelectedReferral(referral);
    setPaymentProof(""); // Reset payment proof when opening edit dialog
    editForm.reset({
      notes: "", // Start with empty notes field to encourage new observations
      status: referral.status,
      fullName: referral.fullName,
      phone: referral.phone,
      licensePlate: referral.licensePlate,
      companyId: referral.companyId,
    });
    setIsEditDialogOpen(true);
  };

  const onSubmit = (data: ValidateFormValues) => {
    if (selectedReferral) {
      validateMutation.mutate({ id: selectedReferral.id, data });
    }
  };

  const onEditSubmit = (data: EditFormValues) => {
    if (!selectedReferral) return;

    // Use form value or local state (form value takes precedence since we're updating it now)
    const finalPaymentProof = data.paymentProof || paymentProof || undefined;
    
    console.log('[onEditSubmit] Data being sent:', {
      ...data,
      paymentProof: finalPaymentProof ? `base64 string (${finalPaymentProof.length} chars)` : 'none'
    });

    // Validate payment proof is required for converted status
    if (data.status === "converted" && !selectedReferral.paymentProof && !finalPaymentProof) {
      toast({
        title: "Comprovante Obrigatório",
        description: "Para converter uma indicação, é obrigatório anexar o comprovante de pagamento.",
        variant: "destructive"
      });
      return;
    }

    editMutation.mutate({ 
      id: selectedReferral.id, 
      data: {
        ...data,
        paymentProof: finalPaymentProof
      }
    });
  };

  // Export to Excel function
  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredReferrals.map((referral) => {
        const indicador = users.find((u) => u.id === referral.userId);
        const company = companies.find((c) => c.id === referral.companyId);
        
        return {
          'ID': referral.id,
          'Nome': referral.fullName,
          'Telefone': referral.phone,
          'Placa': referral.licensePlate,
          'Marca': referral.vehicleBrand || '',
          'Modelo': referral.vehicleModel || '',
          'Ano': referral.vehicleYear || '',
          'Tem Seguro': referral.hasInsurance ? 'Sim' : 'Não',
          'Indicador': indicador?.fullName || 'N/A',
          'Empresa': company?.name || 'N/A',
          'Status': statusLabels[referral.status] || referral.status,
          'Cidade': referral.city || '',
          'Estado': referral.state || '',
          'Data de Criação': new Date(referral.createdAt).toLocaleDateString('pt-BR'),
          'Observações': referral.notes || ''
        };
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Indicações');
      
      // Generate filename with current date and filter info
      let filename = `indicacoes_analista_${new Date().toISOString().split('T')[0]}`;
      if (statusFilter !== "all") {
        filename += `_${statusLabels[statusFilter] || statusFilter}`;
      }
      filename += '.xlsx';
      
      // Download file
      XLSX.writeFile(workbook, filename);
      
      toast({ 
        title: "Exportação concluída!",
        description: `${filteredReferrals.length} indicações exportadas com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ 
        title: "Erro ao exportar",
        description: "Não foi possível exportar os dados para Excel.",
        variant: "destructive"
      });
    }
  };

  // Generate and export report based on type (weekly, monthly, daily_general)
  const handleExportReport = (type: 'weekly' | 'monthly' | 'daily_general') => {
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      let periodLabel: string;
      
      switch (type) {
        case 'weekly':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          periodLabel = 'Semanal';
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          periodLabel = 'Mensal';
          break;
        case 'daily_general':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = now;
          periodLabel = 'Geral Diário';
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          periodLabel = 'Mensal';
      }
      
      // Helper function to get date from status - prioritize the stored date fields
      const getStatusDate = (referral: any, status: string): Date | null => {
        // For validated: use validatedAt first (most recent validation date)
        if (status === 'validated' && referral.validatedAt) {
          return new Date(referral.validatedAt);
        }
        
        // For converted: use convertedAt first (most recent conversion date)
        if (status === 'converted' && referral.convertedAt) {
          return new Date(referral.convertedAt);
        }
        
        // Fallback to statusHistory - use findLast to get the MOST RECENT entry
        if (referral.statusHistory && Array.isArray(referral.statusHistory)) {
          // Find the last (most recent) entry with this status
          const entries = referral.statusHistory.filter((e: any) => e.status === status);
          if (entries.length > 0) {
            const lastEntry = entries[entries.length - 1];
            if (lastEntry.changedAt) {
              return new Date(lastEntry.changedAt);
            }
          }
        }
        
        return null;
      };
      
      // Group data by day
      const dailyData: Record<string, {
        cadastros: number;
        validados: number;
        convertidos: number;
        empresas: Set<string>;
        vendedores: Set<string>;
      }> = {};
      
      // Initialize all days in the range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = format(currentDate, 'dd/MM', { locale: ptBR });
        dailyData[dateKey] = {
          cadastros: 0,
          validados: 0,
          convertidos: 0,
          empresas: new Set(),
          vendedores: new Set()
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Process all referrals
      filteredReferrals.forEach((referral: any) => {
        // Count cadastros by creation date
        const createdDate = new Date(referral.createdAt);
        if (createdDate >= startDate && createdDate <= endDate) {
          const createdKey = format(createdDate, 'dd/MM', { locale: ptBR });
          if (dailyData[createdKey]) {
            dailyData[createdKey].cadastros++;
          }
        }
        
        // Track validados by VALIDATION date - ONLY count referrals with CURRENT status = 'validated'
        // This matches what the referrals page shows when filtered by status = 'validated'
        if (referral.status === 'validated') {
          const validationDate = getStatusDate(referral, 'validated');
          if (validationDate && validationDate >= startDate && validationDate <= endDate) {
            const validatedKey = format(validationDate, 'dd/MM', { locale: ptBR });
            if (dailyData[validatedKey]) {
              dailyData[validatedKey].validados++;
              
              // Track empresa (associação) for validated referrals too
              const company = companies.find((c: any) => c.id === referral.companyId);
              if (company?.name) {
                dailyData[validatedKey].empresas.add(company.name);
              }
            }
          }
        }
        
        // Track convertidos by updatedAt - this matches what the referrals page shows
        // The referrals page displays updatedAt for converted/paid status
        if (referral.status === 'converted' || referral.status === 'paid') {
          // Use updatedAt to match the referrals page display
          const conversionDate = referral.updatedAt ? new Date(referral.updatedAt) : null;
          if (conversionDate && conversionDate >= startDate && conversionDate <= endDate) {
            const convertedKey = format(conversionDate, 'dd/MM', { locale: ptBR });
            if (dailyData[convertedKey]) {
              dailyData[convertedKey].convertidos++;
              
              // Track empresa (associação)
              const company = companies.find((c: any) => c.id === referral.companyId);
              if (company?.name) {
                dailyData[convertedKey].empresas.add(company.name);
              }
              
              // Track vendedor - use the LAST (most recent) converted entry
              if (referral.statusHistory && Array.isArray(referral.statusHistory)) {
                const convertedEntries = referral.statusHistory.filter((entry: any) => 
                  entry.status === 'converted'
                );
                if (convertedEntries.length > 0) {
                  const lastConvertedEntry = convertedEntries[convertedEntries.length - 1];
                  const vendedor = users.find(u => u.id === lastConvertedEntry.changedBy);
                  const vendedorName = lastConvertedEntry.changedByName || vendedor?.fullName;
                  if (vendedorName) {
                    dailyData[convertedKey].vendedores.add(vendedorName);
                  }
                }
              }
            }
          }
        }
      });
      
      // Check if there's any data
      const hasData = Object.values(dailyData).some(day => 
        day.cadastros > 0 || day.validados > 0 || day.convertidos > 0
      );
      
      if (!hasData) {
        toast({
          title: "Nenhuma indicação encontrada",
          description: "Não há indicações no período selecionado com os filtros aplicados.",
          variant: "destructive"
        });
        return;
      }
      
      // Sort dates
      const sortedDates = Object.keys(dailyData).sort((a, b) => {
        const [dayA, monthA] = a.split('/').map(Number);
        const [dayB, monthB] = b.split('/').map(Number);
        if (monthA !== monthB) return monthA - monthB;
        return dayA - dayB;
      });
      
      // Calculate totals
      const totals = Object.values(dailyData).reduce((acc, day) => ({
        cadastros: acc.cadastros + day.cadastros,
        validados: acc.validados + day.validados,
        convertidos: acc.convertidos + day.convertidos
      }), { cadastros: 0, validados: 0, convertidos: 0 });
      
      // Define styles with wrapText for automatic text wrapping
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
        fill: { fgColor: { rgb: "2563EB" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "1E40AF" } },
          bottom: { style: "thin", color: { rgb: "1E40AF" } },
          left: { style: "thin", color: { rgb: "1E40AF" } },
          right: { style: "thin", color: { rgb: "1E40AF" } }
        }
      };
      
      const labelStyle = {
        font: { bold: true, sz: 11 },
        fill: { fgColor: { rgb: "F3F4F6" } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "D1D5DB" } },
          bottom: { style: "thin", color: { rgb: "D1D5DB" } },
          left: { style: "thin", color: { rgb: "D1D5DB" } },
          right: { style: "thin", color: { rgb: "D1D5DB" } }
        }
      };
      
      const dataStyle = {
        font: { sz: 11 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } }
        }
      };
      
      const totalStyle = {
        font: { bold: true, sz: 11 },
        fill: { fgColor: { rgb: "DBEAFE" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "93C5FD" } },
          bottom: { style: "thin", color: { rgb: "93C5FD" } },
          left: { style: "thin", color: { rgb: "93C5FD" } },
          right: { style: "thin", color: { rgb: "93C5FD" } }
        }
      };
      
      const successStyle = {
        font: { bold: true, sz: 11, color: { rgb: "166534" } },
        fill: { fgColor: { rgb: "DCFCE7" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "86EFAC" } },
          bottom: { style: "thin", color: { rgb: "86EFAC" } },
          left: { style: "thin", color: { rgb: "86EFAC" } },
          right: { style: "thin", color: { rgb: "86EFAC" } }
        }
      };
      
      // Build data with styles
      const numCols = sortedDates.length + 2; // label + dates + total
      
      // Create worksheet data
      const wsData: any[][] = [];
      
      // Row 1: Header with indicator name + dates + TOTAL (matching admin layout)
      const headerRow = [
        { v: 'Todas as Indicações', s: headerStyle },
        ...sortedDates.map(date => ({ v: date, s: headerStyle })),
        { v: 'TOTAL', s: headerStyle }
      ];
      wsData.push(headerRow);
      
      // Row 2: Cadastros
      const cadastrosRow = [
        { v: 'Cadastros', s: labelStyle },
        ...sortedDates.map(date => ({ 
          v: dailyData[date].cadastros || 0, 
          s: dailyData[date].cadastros > 0 ? dataStyle : { ...dataStyle, font: { ...dataStyle.font, color: { rgb: "9CA3AF" } } }
        })),
        { v: totals.cadastros, s: totalStyle }
      ];
      wsData.push(cadastrosRow);
      
      // Row 3: Validados
      const validadosRow = [
        { v: 'Validados', s: labelStyle },
        ...sortedDates.map(date => ({ 
          v: dailyData[date].validados || 0, 
          s: dailyData[date].validados > 0 ? successStyle : { ...dataStyle, font: { ...dataStyle.font, color: { rgb: "9CA3AF" } } }
        })),
        { v: totals.validados, s: { ...totalStyle, font: { ...totalStyle.font, color: { rgb: "166534" } } } }
      ];
      wsData.push(validadosRow);
      
      // Row 4: Convertidos
      const convertidosRow = [
        { v: 'Convertidos', s: labelStyle },
        ...sortedDates.map(date => ({ 
          v: dailyData[date].convertidos || 0, 
          s: dailyData[date].convertidos > 0 ? { ...successStyle, fill: { fgColor: { rgb: "F3E8FF" } }, font: { ...successStyle.font, color: { rgb: "7C3AED" } } } : { ...dataStyle, font: { ...dataStyle.font, color: { rgb: "9CA3AF" } } }
        })),
        { v: totals.convertidos, s: { ...totalStyle, font: { ...totalStyle.font, color: { rgb: "7C3AED" } } } }
      ];
      wsData.push(convertidosRow);
      
      // Row 5: Associação
      const associacaoRow = [
        { v: 'Associação', s: labelStyle },
        ...sortedDates.map(date => {
          const empresas = Array.from(dailyData[date].empresas);
          return { 
            v: empresas.length > 0 ? empresas.join(', ') : '-', 
            s: empresas.length > 0 ? dataStyle : { ...dataStyle, font: { ...dataStyle.font, color: { rgb: "9CA3AF" } } }
          };
        }),
        { v: '-', s: totalStyle }
      ];
      wsData.push(associacaoRow);
      
      // Row 6: Vendedor
      const vendedorRow = [
        { v: 'Vendedor', s: labelStyle },
        ...sortedDates.map(date => {
          const vendedores = Array.from(dailyData[date].vendedores);
          return { 
            v: vendedores.length > 0 ? vendedores.join(', ') : '-', 
            s: vendedores.length > 0 ? { ...dataStyle, font: { ...dataStyle.font, color: { rgb: "2563EB" } } } : { ...dataStyle, font: { ...dataStyle.font, color: { rgb: "9CA3AF" } } }
          };
        }),
        { v: '-', s: totalStyle }
      ];
      wsData.push(vendedorRow);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths - wider columns for text content
      const colWidths = [{ wch: 20 }]; // First column for labels
      sortedDates.forEach(() => colWidths.push({ wch: 22 })); // Wider date columns for names
      colWidths.push({ wch: 10 }); // Total column
      sheet['!cols'] = colWidths;
      
      // Set row heights - taller rows for wrapped text
      sheet['!rows'] = [
        { hpt: 35 }, // Header row (indicator name)
        { hpt: 24 }, // Cadastros
        { hpt: 24 }, // Validados
        { hpt: 24 }, // Convertidos
        { hpt: 40 }, // Associação (company names can be long)
        { hpt: 40 }  // Vendedor (seller names can be long)
      ];
      
      XLSX.utils.book_append_sheet(workbook, sheet, 'Relatório');
      
      // Generate filename
      const startFormatted = format(startDate, 'dd-MM-yyyy', { locale: ptBR });
      const endFormatted = format(endDate, 'dd-MM-yyyy', { locale: ptBR });
      const filename = `relatorio_${periodLabel.toLowerCase().replace(' ', '_')}_${startFormatted}_a_${endFormatted}.xlsx`;
      
      XLSX.writeFile(workbook, filename);
      
      toast({
        title: "Relatório gerado com sucesso!",
        description: `Relatório ${periodLabel} exportado.`
      });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Não foi possível gerar o relatório. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  if (!user || (user.role !== "analista" && user.role !== "admin")) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Restrito</h2>
              <p className="text-gray-500">Esta página é exclusiva para analistas.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role === "analista" && !(user.permissions as AnalystPermission[])?.includes("view_referrals")) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Sem Permissão</h2>
              <p className="text-gray-500">
                Você não tem permissão para visualizar indicações. Entre em contato com um administrador.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full py-4 sm:py-6 space-y-4 sm:space-y-6 px-3 sm:px-4 lg:px-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Indicações para Análise</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Visualize e valide as indicações cadastradas</p>
          {user?.analystLevel === 3 && (
            <Badge className="mt-2 bg-purple-100 text-purple-800">
              <Shield className="h-3 w-3 mr-1" />
              Mostrando apenas indicações dos usuários supervisionados
            </Badge>
          )}
          {(isFetching || isRefreshing) && (
            <Badge className="mt-2 bg-blue-100 text-blue-800">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Atualizando dados...
            </Badge>
          )}
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
            <span>📊 {referrals.length} indicações</span>
            <span>🔄 Atualização automática</span>
            <span>⏰ {new Date().toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isFetching}
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${(isRefreshing || isFetching) ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <BackButton to="/analyst" />
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="space-y-3">
            {/* Search - full width */}
            <div>
              <Label htmlFor="search" className="text-xs text-gray-500">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Nome, telefone ou placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {/* Filters - side by side on mobile */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="status" className="text-xs text-gray-500">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="analyzing">Em Análise</SelectItem>
                    <SelectItem value="validated">Validado</SelectItem>
                    <SelectItem value="converted">Convertido</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="false">Falso</SelectItem>
                    <SelectItem value="not_validated">Não Validado</SelectItem>
                    <SelectItem value="not_converted">Não Convertido</SelectItem>
                    <SelectItem value="contact_list">Lista contato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="contact-status" className="text-xs text-gray-500">Contato</Label>
                <Select value={contactStatusFilter} onValueChange={setContactStatusFilter}>
                  <SelectTrigger id="contact-status" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_contact_statuses">Todos</SelectItem>
                    <SelectItem value="no_contact_status">Sem Status</SelectItem>
                    <SelectItem value="retornar_contato">Retornar</SelectItem>
                    <SelectItem value="sem_sucesso">Sem Sucesso</SelectItem>
                    <SelectItem value="em_negociacao">Negociação</SelectItem>
                    <SelectItem value="aguardando_pagamento">Aguardando</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Indicações ({filteredReferrals.length})</CardTitle>
              <CardDescription>
                {canEdit
                  ? "Clique em uma indicação para validar ou editar o status"
                  : "Você tem permissão apenas para visualizar"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                onClick={exportToExcel} 
                variant="outline"
                size="sm"
                disabled={filteredReferrals.length === 0}
                className="flex-1 sm:flex-none"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Exportar</span> Excel
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={filteredReferrals.length === 0} className="flex-1 sm:flex-none">
                    <FileBarChart className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Exportar</span> Relatório
                    <ChevronDown className="h-4 w-4 ml-1 sm:ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExportReport('weekly')}>
                    Relatório Semanal
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportReport('monthly')}>
                    Relatório Mensal
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportReport('daily_general')}>
                    Relatório Geral Diário
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredReferrals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma indicação encontrada
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {visibleReferrals.map((referral) => {
                  const indicador = usersMap.get(referral.userId);
                  const criador = usersMap.get(referral.createdBy || 0);
                  const company = companiesMap.get(referral.companyId || 0);
                  return (
                    <Card key={referral.id} className="shadow-sm border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        {/* Header with ID, date and status badges */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="font-mono font-semibold">#{referral.id}</span>
                            <span>•</span>
                            <span>{new Date(referral.createdAt).toLocaleDateString("pt-BR")}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 justify-end">
                            <StatusBadgeWithTooltip referral={referral} usersMap={usersMap} />
                            {referral.contactStatus && (
                              <Badge variant="outline" className={`${contactStatusColors[referral.contactStatus] || "bg-gray-100 text-gray-800"} text-xs px-2 py-0.5`}>
                                {contactStatusLabels[referral.contactStatus] || "Sem status"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Client name and phone */}
                        <div className="mb-3">
                          <h3 className="font-semibold text-base text-gray-900">{referral.fullName}</h3>
                          <p className="text-sm text-gray-600">{referral.phone}</p>
                        </div>
                        
                        {/* Key info grid - full information */}
                        <div className="space-y-2 text-sm bg-gray-50 rounded-lg p-3 mb-3">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div>
                              <span className="text-gray-500 block text-xs">Placa</span>
                              <span className="font-mono font-medium">{referral.licensePlate}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Tem Seguro</span>
                              <span className={`font-medium ${referral.hasInsurance ? 'text-green-600' : 'text-red-600'}`}>
                                {referral.hasInsurance ? 'Sim' : 'Não'}
                              </span>
                            </div>
                          </div>
                          
                          <div>
                            <span className="text-gray-500 block text-xs">Seguradora</span>
                            <span className="font-medium">{company?.name || "N/A"}</span>
                          </div>
                          
                          <div>
                            <span className="text-gray-500 block text-xs">Indicador</span>
                            <span className="font-medium">{indicador?.fullName || "N/A"}</span>
                            {criador && criador.id !== indicador?.id && (
                              <span className="text-gray-400 text-xs block">(criado por {criador.fullName})</span>
                            )}
                          </div>
                          
                          {(referral.city || referral.state) && (
                            <div>
                              <span className="text-gray-500 block text-xs">Localização</span>
                              <span className="font-medium">
                                {[referral.city, referral.state].filter(Boolean).join(' / ')}
                              </span>
                            </div>
                          )}
                          
                          {(referral.vehicleBrand || referral.vehicleModel || referral.vehicleYear) && (
                            <div>
                              <span className="text-gray-500 block text-xs">Veículo</span>
                              <span className="font-medium">
                                {[referral.vehicleBrand, referral.vehicleModel, referral.vehicleYear]
                                  .filter(Boolean)
                                  .join(' ')}
                              </span>
                            </div>
                          )}
                          
                          {referral.notes && (
                            <div>
                              <span className="text-gray-500 block text-xs">Observações</span>
                              <span className="text-gray-700">{referral.notes}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Action buttons */}
                        {canEdit && (
                          <div className="grid grid-cols-3 gap-2">
                            <ContactStatusDialog 
                              referral={referral} 
                              onUpdate={() => {}} 
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(referral)}
                              className="text-xs h-9"
                            >
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleValidateClick(referral)}
                              disabled={referral.status === "paid"}
                              className="text-xs h-9"
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Validar
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs font-semibold whitespace-nowrap">ID</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[140px]">Cliente</TableHead>
                      <TableHead className="text-xs font-semibold whitespace-nowrap">Telefone</TableHead>
                      <TableHead className="text-xs font-semibold whitespace-nowrap">Placa</TableHead>
                      <TableHead className="text-xs font-semibold whitespace-nowrap">Seguro</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[100px]">Seguradora</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[120px]">Indicador</TableHead>
                      <TableHead className="text-xs font-semibold whitespace-nowrap">Local</TableHead>
                      <TableHead className="text-xs font-semibold whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-xs font-semibold whitespace-nowrap">Contato</TableHead>
                      <TableHead className="text-xs font-semibold whitespace-nowrap">Data</TableHead>
                      {canEdit && <TableHead className="text-xs font-semibold whitespace-nowrap">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleReferrals.map((referral) => {
                      const indicador = usersMap.get(referral.userId);
                      const criador = usersMap.get(referral.createdBy || 0);
                      const company = companiesMap.get(referral.companyId || 0);
                      return (
                        <TableRow key={referral.id} className="hover:bg-gray-50">
                          <TableCell className="text-xs font-mono font-semibold text-blue-600 whitespace-nowrap">#{referral.id}</TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium max-w-[180px] truncate" title={referral.fullName}>{referral.fullName}</div>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{referral.phone}</TableCell>
                          <TableCell className="text-xs font-mono font-medium whitespace-nowrap">{referral.licensePlate}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className={`text-xs font-medium ${referral.hasInsurance ? 'text-green-600' : 'text-red-600'}`}>
                              {referral.hasInsurance ? 'Sim' : 'Não'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{company?.name || "N/A"}</TableCell>
                          <TableCell className="text-xs">
                            <div className="max-w-[150px]">
                              <div className="font-medium truncate" title={indicador?.fullName}>{indicador?.fullName || "N/A"}</div>
                              {criador && criador.id !== indicador?.id && (
                                <div className="text-gray-500 truncate text-[10px]">por {criador.fullName}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {(referral.city || referral.state) ? (
                              <span>{[referral.city, referral.state].filter(Boolean).join('/')}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <StatusBadgeWithTooltip referral={referral} usersMap={usersMap} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {referral.contactStatus ? (
                              <Badge variant="outline" className={`${contactStatusColors[referral.contactStatus] || "bg-gray-100 text-gray-800"} text-xs`}>
                                {contactStatusLabels[referral.contactStatus] || "Sem status"}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                            {new Date(referral.createdAt).toLocaleDateString("pt-BR")}
                          </TableCell>
                          {canEdit && (
                            <TableCell className="whitespace-nowrap">
                              <div className="flex gap-1 flex-nowrap">
                                <ContactStatusDialog 
                                  referral={referral} 
                                  onUpdate={() => {}} 
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditClick(referral)}
                                  className="px-2 h-7 text-xs"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleValidateClick(referral)}
                                  disabled={referral.status === "paid"}
                                  className="px-2 h-7 text-xs"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Validar
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Load More Button */}
              {visibleCount < filteredReferrals.length && (
                <div className="flex justify-center mt-4 pb-2">
                  <Button 
                    variant="outline" 
                    onClick={handleLoadMore}
                    className="w-full max-w-xs"
                  >
                    Carregar mais ({visibleCount} de {filteredReferrals.length})
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Validate Dialog */}
      <Dialog open={isValidateDialogOpen} onOpenChange={setIsValidateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Validar Indicação</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nome</p>
                <p className="font-medium">{selectedReferral?.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Telefone</p>
                <p className="font-medium">{selectedReferral?.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Placa</p>
                <p className="font-medium">{selectedReferral?.licensePlate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tem Seguro?</p>
                <p className="font-medium">{selectedReferral?.hasInsurance ? "Sim" : "Não"}</p>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Informações do Veículo</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="vehicleBrand">Marca</Label>
                  <Input
                    id="vehicleBrand"
                    {...form.register("vehicleBrand")}
                    placeholder="Ex: Toyota"
                  />
                  {form.formState.errors.vehicleBrand && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.vehicleBrand.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="vehicleModel">Modelo</Label>
                  <Input
                    id="vehicleModel"
                    {...form.register("vehicleModel")}
                    placeholder="Ex: Corolla"
                  />
                  {form.formState.errors.vehicleModel && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.vehicleModel.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="vehicleYear">Ano</Label>
                  <Input
                    id="vehicleYear"
                    {...form.register("vehicleYear")}
                    placeholder="Ex: 2022"
                  />
                  {form.formState.errors.vehicleYear && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.vehicleYear.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Validação dos Dados</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...form.register("nameCorrect")}
                    className="rounded"
                  />
                  <span>Nome está correto</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...form.register("plateCorrect")}
                    className="rounded"
                  />
                  <span>Placa está correta</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...form.register("phoneCorrect")}
                    className="rounded"
                  />
                  <span>Telefone está correto</span>
                </label>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div>
                <Label htmlFor="validationNotes">Observações da Validação</Label>
                <textarea
                  id="validationNotes"
                  {...form.register("validationNotes")}
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                  placeholder="Adicione observações sobre a validação..."
                />
              </div>
              
              {/* Histórico de Status */}
              {selectedReferral?.statusHistory && selectedReferral.statusHistory.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Histórico de Status:</label>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedReferral.statusHistory

                      .sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                      .map((entry: any, index: number) => {
                        const entryUser = allUsers.find(u => u.id === entry.changedBy);
                        const entryDate = new Date(entry.changedAt);
                        
                        return (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-200">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {statusLabels[entry.status as keyof typeof statusLabels] || entry.status}
                                </Badge>
                                <span className="text-xs text-gray-600 font-medium">
                                  {entryUser?.fullName || 'Usuário não encontrado'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {entryDate.toLocaleDateString("pt-BR")} às {entryDate.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {entry.notes && (
                              <div className="text-sm text-gray-700">
                                {entry.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              
              {/* Fallback para observações simples (compatibilidade) */}
              {selectedReferral?.notes && (!selectedReferral.statusHistory || selectedReferral.statusHistory.filter((entry: any) => entry.notes && entry.notes.trim()).length === 0) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações Anteriores:</label>
                  <div className="p-2 bg-gray-50 rounded text-sm">
                    {selectedReferral.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsValidateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={validateMutation.isPending}>
                {validateMutation.isPending ? "Validando..." : "Confirmar Validação"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setPaymentProof(""); // Reset payment proof when closing dialog
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Indicação</DialogTitle>
            <p className="text-sm text-gray-500 mt-2">
              ID: <strong>#{selectedReferral?.id}</strong>
            </p>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="space-y-4">
              {/* Campos editáveis de dados da indicação */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
                <div>
                  <Label htmlFor="edit-fullName">Nome do Cliente</Label>
                  <Input
                    id="edit-fullName"
                    {...editForm.register("fullName")}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Telefone</Label>
                  <Input
                    id="edit-phone"
                    {...editForm.register("phone")}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-licensePlate">Placa</Label>
                  <Input
                    id="edit-licensePlate"
                    {...editForm.register("licensePlate")}
                    placeholder="ABC1D23"
                    className="uppercase"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-company">Seguradora</Label>
                  <Select
                    value={editForm.watch("companyId")?.toString() || ""}
                    onValueChange={(value) => editForm.setValue("companyId", parseInt(value))}
                  >
                    <SelectTrigger id="edit-company">
                      <SelectValue placeholder="Selecione a seguradora" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-status">Status da Indicação</Label>
                <Select
                  value={editForm.watch("status")}
                  onValueChange={(value: any) => editForm.setValue("status", value)}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-500" />
                        Pendente
                      </div>
                    </SelectItem>
                    <SelectItem value="analyzing">
                      <div className="flex items-center">
                        <Search className="h-4 w-4 mr-2 text-blue-500" />
                        Em Análise
                      </div>
                    </SelectItem>
                    <SelectItem value="validated">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Validado
                      </div>
                    </SelectItem>
                    <SelectItem value="converted">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-green-700" />
                        Convertido
                      </div>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 mr-2 text-red-600" />
                        Rejeitado
                      </div>
                    </SelectItem>
                    <SelectItem value="paid">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-green-800" />
                        Pago
                      </div>
                    </SelectItem>
                    <SelectItem value="false">
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-orange-600" />
                        Falso
                      </div>
                    </SelectItem>
                    <SelectItem value="not_validated">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 mr-2 text-gray-600" />
                        Não Validado
                      </div>
                    </SelectItem>
                    <SelectItem value="not_converted">
                      <div className="flex items-center">
                        <XCircle className="h-4 w-4 mr-2 text-gray-700" />
                        Não Convertido
                      </div>
                    </SelectItem>
                    <SelectItem value="contact_list">
                      <div className="flex items-center">
                        <Info className="h-4 w-4 mr-2 text-cyan-600" />
                        Lista de contato
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Comprovante de Pagamento */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  📎 Comprovante de Pagamento
                  {editForm.watch("status") === "converted" && !selectedReferral?.paymentProof && !paymentProof && (
                    <span className="text-red-600 text-xs font-semibold">(Obrigatório para conversão)</span>
                  )}
                </label>
                
                {selectedReferral?.paymentProof && !paymentProof && (
                  <div className="mb-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 mb-2">✅ Comprovante já anexado anteriormente</p>
                    <img 
                      src={selectedReferral.paymentProof} 
                      alt="Comprovante de pagamento" 
                      className="max-w-full h-auto max-h-40 rounded border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => selectedReferral.paymentProof && window.open(selectedReferral.paymentProof, '_blank')}
                      title="Clique para visualizar em tamanho completo"
                    />
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      onClick={() => downloadPaymentProof(selectedReferral.paymentProof!, selectedReferral.id)}
                      className="mt-2"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Comprovante
                    </Button>
                  </div>
                )}
                
                {paymentProof && (
                  <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700 mb-2">📎 Novo comprovante selecionado</p>
                    <img 
                      src={paymentProof} 
                      alt="Preview do comprovante" 
                      className="max-w-full h-auto max-h-40 rounded border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(paymentProof, '_blank')}
                      title="Clique para visualizar em tamanho completo"
                    />
                    <div className="flex gap-2 mt-2">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={() => selectedReferral && downloadPaymentProof(paymentProof, selectedReferral.id)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar
                      </Button>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={() => setPaymentProof("")}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    </div>
                  </div>
                )}
                
                <Input
                  id="payment-proof-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500">
                  Formatos aceitos: JPG, PNG. Tamanho máximo: 5MB
                </p>
              </div>

              <div>
                <Label htmlFor="edit-notes">Observações</Label>
                <textarea
                  id="edit-notes"
                  {...editForm.register("notes")}
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                  placeholder="Adicione observações sobre a indicação..."
                />
              </div>
              
              {/* Histórico de Status */}
              {selectedReferral?.statusHistory && selectedReferral.statusHistory.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Histórico de Status:</label>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedReferral.statusHistory

                      .sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                      .map((entry: any, index: number) => {
                        const entryUser = allUsers.find(u => u.id === entry.changedBy);
                        const entryDate = new Date(entry.changedAt);
                        
                        return (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-200">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {statusLabels[entry.status as keyof typeof statusLabels] || entry.status}
                                </Badge>
                                <span className="text-xs text-gray-600 font-medium">
                                  {entryUser?.fullName || 'Usuário não encontrado'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {entryDate.toLocaleDateString("pt-BR")} às {entryDate.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {entry.notes && (
                              <div className="text-sm text-gray-700">
                                {entry.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              
              {/* Fallback para observações simples (compatibilidade) */}
              {selectedReferral?.notes && (!selectedReferral.statusHistory || selectedReferral.statusHistory.filter((entry: any) => entry.notes && entry.notes.trim()).length === 0) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações Anteriores:</label>
                  <div className="p-2 bg-gray-50 rounded text-sm">
                    {selectedReferral.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}