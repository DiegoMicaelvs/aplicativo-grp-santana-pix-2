import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Eye, Search, Filter, Edit, Check, X, Clock, DollarSign, Users, TrendingUp, AlertTriangle, AlertCircle, Trash2, UserCheck, Download, ChevronsUpDown, XCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { BackButton } from "@/components/ui/back-button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

type ReferralStatus = "pending" | "analyzing" | "converted" | "rejected" | "validated" | "paid" | "false" | "not_validated" | "not_converted" | "contact_list";

// Componente de validação
function ValidationDialog({ referral, onValidate }: { referral: any; onValidate: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicleBrand: referral.vehicleBrand || "",
    vehicleModel: referral.vehicleModel || "",
    vehicleYear: referral.vehicleYear || "",
    nameCorrect: referral.nameCorrect ?? true,
    plateCorrect: referral.plateCorrect ?? true,
    phoneCorrect: referral.phoneCorrect ?? true,
    validationNotes: referral.validationNotes || "",
  });
  const [showObservations, setShowObservations] = useState(false);
  const { toast } = useToast();

  // Verifica se há divergências baseado nos dados salvos ou no estado atual do form
  const hasDiscrepancies = () => {
    // Se já foi validado, usar os dados salvos
    if (referral.validatedAt) {
      return referral.nameCorrect === false || referral.plateCorrect === false || referral.phoneCorrect === false;
    }
    return false; // Se não foi validado ainda, não há divergências conhecidas
  };

  // Função para determinar a cor do botão
  const getButtonStyle = () => {
    if (!referral.validatedAt) {
      // Se não foi validado ainda, usar cor padrão (azul)
      return "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200";
    }
    
    // Se foi validado, verificar se há divergências
    if (hasDiscrepancies()) {
      return "bg-red-50 hover:bg-red-100 text-red-700 border-red-200";
    } else {
      return "bg-green-50 hover:bg-green-100 text-green-700 border-green-200";
    }
  };

  const validateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/referrals/${referral.id}/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Incluir cookies de autenticação
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao validar indicação");
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate and refetch all related queries immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/referrals"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/users"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/stats"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/user"], refetchType: 'active' }),
      ]);
      
      toast({ title: "Indicação validada com sucesso!" });
      setIsOpen(false);
      onValidate();
    },
    onError: () => {
      toast({ title: "Erro ao validar indicação", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    // Verificar se há divergências
    const hasDivergences = !formData.nameCorrect || !formData.plateCorrect || !formData.phoneCorrect;
    setShowObservations(hasDivergences);
    
    if (hasDivergences && !formData.validationNotes.trim()) {
      toast({ 
        title: "Observações obrigatórias", 
        description: "Adicione observações sobre as divergências encontradas",
        variant: "destructive" 
      });
      return;
    }
    
    validateMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={getButtonStyle()}>
          <Check className="h-4 w-4 mr-1" />
          Validação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Validação da Indicação</DialogTitle>
          <DialogDescription>
            Valide as informações da indicação de {referral.fullName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Informações da indicação */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Dados da Indicação</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><strong>Cliente:</strong> {referral.fullName}</div>
              <div><strong>Telefone:</strong> {referral.phone}</div>
              <div><strong>Placa:</strong> {referral.licensePlate}</div>
              <div><strong>Status:</strong> {referral.status}</div>
            </div>
          </div>

          {/* 1. Campo para marca, modelo e ano */}
          <div className="space-y-3">
            <h4 className="font-medium">1. Dados do Veículo</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Marca</label>
                <Input
                  value={formData.vehicleBrand}
                  onChange={(e) => setFormData({...formData, vehicleBrand: e.target.value})}
                  placeholder="Ex: Toyota"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Modelo</label>
                <Input
                  value={formData.vehicleModel}
                  onChange={(e) => setFormData({...formData, vehicleModel: e.target.value})}
                  placeholder="Ex: Corolla"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Ano</label>
                <Input
                  value={formData.vehicleYear}
                  onChange={(e) => setFormData({...formData, vehicleYear: e.target.value})}
                  placeholder="Ex: 2020 ou 2022/2023"
                />
              </div>
            </div>
          </div>

          {/* 2, 3, 4. Perguntas de validação */}
          <div className="space-y-3">
            <h4 className="font-medium">2. Validação dos Dados</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded">
                <span>O nome está correto?</span>
                <div className="flex gap-2">
                  <Button
                    variant={formData.nameCorrect ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, nameCorrect: true})}
                  >
                    Sim
                  </Button>
                  <Button
                    variant={!formData.nameCorrect ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, nameCorrect: false})}
                  >
                    Não
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded">
                <span>A placa do carro está correta?</span>
                <div className="flex gap-2">
                  <Button
                    variant={formData.plateCorrect ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, plateCorrect: true})}
                  >
                    Sim
                  </Button>
                  <Button
                    variant={!formData.plateCorrect ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, plateCorrect: false})}
                  >
                    Não
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded">
                <span>O número do celular está correto?</span>
                <div className="flex gap-2">
                  <Button
                    variant={formData.phoneCorrect ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, phoneCorrect: true})}
                  >
                    Sim
                  </Button>
                  <Button
                    variant={!formData.phoneCorrect ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setFormData({...formData, phoneCorrect: false})}
                  >
                    Não
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Campo de observações - aparece se houver divergências */}
          {(!formData.nameCorrect || !formData.plateCorrect || !formData.phoneCorrect || showObservations) && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-red-600">
                Observações sobre divergências *
              </label>
              <Textarea
                value={formData.validationNotes}
                onChange={(e) => setFormData({...formData, validationNotes: e.target.value})}
                placeholder="Descreva as divergências encontradas..."
                rows={3}
                className="border-red-200"
              />
            </div>
          )}

          {/* Observações opcionais */}
          {formData.nameCorrect && formData.plateCorrect && formData.phoneCorrect && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea
                value={formData.validationNotes}
                onChange={(e) => setFormData({...formData, validationNotes: e.target.value})}
                placeholder="Adicione observações adicionais se necessário..."
                rows={2}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={validateMutation.isPending || !formData.vehicleBrand || !formData.vehicleModel || !formData.vehicleYear}
            >
              {validateMutation.isPending ? "Validando..." : "Validar Indicação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Contact Status types and labels
type ContactStatus = "retornar_contato" | "sem_sucesso" | "em_negociacao" | "aguardando_pagamento" | null;

const contactStatusLabels: Record<string, string> = {
  retornar_contato: "Retornar Contato",
  sem_sucesso: "Sem Sucesso",
  em_negociacao: "Em negociação",
  aguardando_pagamento: "Aguardando pagamento"
};

const contactStatusColors: Record<string, string> = {
  retornar_contato: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sem_sucesso: "bg-red-100 text-red-800 border-red-300",
  em_negociacao: "bg-blue-100 text-blue-800 border-blue-300",
  aguardando_pagamento: "bg-purple-100 text-purple-800 border-purple-300"
};

// Contact Status Dialog Component - Optimized for performance
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
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyst/referrals"] });
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
  const buttonClass = currentStatus 
    ? contactStatusColors[currentStatus] 
    : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("text-xs px-2 h-7 whitespace-nowrap", buttonClass)}
        >
          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate max-w-[120px]">
            {currentStatus ? contactStatusLabels[currentStatus] : "Contato"}
          </span>
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

// Helper function to convert UTC date to local datetime-local format
function convertToLocalDateTimeString(utcDateString: string): string {
  if (!utcDateString) return "";
  
  const date = new Date(utcDateString);
  
  // Get local date and time components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Helper function to convert local datetime-local format back to ISO UTC
function convertLocalToUTC(localDateTimeString: string): string {
  if (!localDateTimeString) return "";
  
  const localDate = new Date(localDateTimeString);
  return localDate.toISOString();
}

export default function AdminReferralsDetailedPage() {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all_statuses");
  const [contactStatusFilter, setContactStatusFilter] = useState<string>("all_contact_statuses");
  const [userFilter, setUserFilter] = useState<string>("all_users");
  const [companyFilter, setCompanyFilter] = useState<string>("all_companies");
  const [monthFilter, setMonthFilter] = useState<string>("all_months");
  const [localFilter, setLocalFilter] = useState<string>("all_locals");
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ReferralStatus>("pending");
  const [statusNotes, setStatusNotes] = useState("");
  const [paymentProof, setPaymentProof] = useState<string>("");
  
  // Debounce search input to avoid filtering on every keystroke
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    phone: "",
    licensePlate: "",
    companyId: 0,
    userId: 0,
    commissionIndicator: "0",
    commissionPromoter: "0",
    createdAt: "",
    city: "",
    state: ""
  });
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userDropdownOpenMobile, setUserDropdownOpenMobile] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  const { data: referrals = [], isLoading: referralsLoading, refetch: refetchReferrals } = useQuery<any[]>({
    queryKey: ["/api/admin/referrals"],
    refetchInterval: false, // Desabilitado para melhorar performance
    refetchOnWindowFocus: false, // Desabilitado para reduzir carga
    staleTime: 5 * 60 * 1000, // Cache válido por 5 minutos
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 60000, // Atualiza a cada 60 segundos (usuários mudam menos)
    refetchOnWindowFocus: true,
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"]
  });

  // Fetch all users instead of just indicadores
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });
  
  // Sort users alphabetically by fullName - memoized to avoid re-sorting on every render
  const sortedUsers = useMemo(() => 
    [...allUsers].sort((a, b) => 
      (a.fullName || '').localeCompare(b.fullName || '', 'pt-BR')
    ),
    [allUsers]
  );

  const updateStatusMutation = useMutation({
    mutationFn: async ({ referralId, status, notes, paymentProof }: { referralId: number; status: ReferralStatus; notes: string; paymentProof?: string }) => {
      console.log(`[updateStatusMutation] Iniciando atualização: referralId=${referralId}, status=${status}`);
      
      const response = await fetch(`/api/referrals/${referralId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Incluir cookies de autenticação
        body: JSON.stringify({ status, notes, paymentProof }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.details || errorData.error || "Erro ao atualizar status";
        console.error(`[updateStatusMutation] Erro na resposta:`, errorData);
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log(`[updateStatusMutation] Resposta bem-sucedida:`, result);
      return result;
    },
    onSuccess: async (updatedReferral) => {
      console.log(`[updateStatusMutation] onSuccess - dados recebidos:`, updatedReferral);
      
      // Update only the specific referral in the cache (surgical update)
      queryClient.setQueryData(["/api/admin/referrals"], (old: any[] = []) =>
        old.map(ref => ref.id === updatedReferral.id ? updatedReferral : ref)
      );
      
      // Invalidate critical queries for cross-role sync (lazy refetch)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/referrals"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/stats"] }),
      ]);
      
      toast({ title: "Status atualizado com sucesso!" });
      setIsDialogOpen(false);
      setStatusNotes("");
      setSelectedReferral(null);
    },
    onError: (error: any) => {
      console.error("[updateStatusMutation] onError - Erro ao atualizar status:", error);
      const errorMessage = error?.message || "Erro ao atualizar status";
      toast({ 
        title: "Erro ao atualizar status", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  const updateReferralMutation = useMutation({
    mutationFn: async ({ referralId, data }: { referralId: number; data: any }) => {
      const response = await fetch(`/api/referrals/${referralId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Incluir cookies de autenticação
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao atualizar indicação");
      }
      
      return response.json();
    },
    onSuccess: async (data) => {
      console.log("[updateReferralMutation] Dados atualizados:", data);
      // Invalidate and refetch all related queries immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/referrals"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/users"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/stats"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/companies"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/referrals"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/user"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/team/stats"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"], refetchType: 'active' }),
      ]);
      toast({ title: "Indicação atualizada com sucesso!" });
      setIsDialogOpen(false);
      setSelectedReferral(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar indicação", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const deleteReferralMutation = useMutation({
    mutationFn: async (referralId: number) => {
      const response = await fetch(`/api/referrals/${referralId}`, {
        method: "DELETE",
        credentials: "include", // Incluir cookies de autenticação
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao deletar indicação");
      }
      
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate and refetch all related queries immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/referrals"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/users"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/analyst/stats"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/user"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/team/stats"], refetchType: 'active' }),
      ]);
      
      toast({ title: "Indicação deletada com sucesso!" });
      setIsDialogOpen(false);
      setIsDeleteDialogOpen(false);
      setSelectedReferral(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao deletar indicação", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  // Create user lookup map for O(1) access - memoized
  const userLookupMap = useMemo(() => {
    const map = new Map();
    users.forEach((user: any) => {
      map.set(user.id, user);
    });
    return map;
  }, [users]);

  // Filter referrals - optimized to avoid expensive operations
  const filteredReferrals = useMemo(() => {
    // Early return if no filters and no search
    if (searchTerm === "" && 
        statusFilter === "all_statuses" && 
        contactStatusFilter === "all_contact_statuses" &&
        userFilter === "all_users" && 
        companyFilter === "all_companies" && 
        monthFilter === "all_months" && 
        localFilter === "all_locals") {
      return referrals;
    }
    
    const searchLower = searchTerm.toLowerCase();
    const hasDateSearch = searchTerm.includes('/');
    
    return referrals.filter((referral: any) => {
      // Quick filters first (cheapest operations)
      if (statusFilter !== "all_statuses" && referral.status !== statusFilter) return false;
      if (contactStatusFilter !== "all_contact_statuses") {
        if (contactStatusFilter === "no_contact_status") {
          if (referral.contactStatus) return false;
        } else if (referral.contactStatus !== contactStatusFilter) {
          return false;
        }
      }
      if (userFilter !== "all_users" && referral.userId.toString() !== userFilter) return false;
      if (companyFilter !== "all_companies" && referral.companyId?.toString() !== companyFilter) return false;
      
      // Local filter
      if (localFilter !== "all_locals") {
        if (localFilter === "no_state") {
          if (referral.state) return false;
        } else if (referral.state !== localFilter) {
          return false;
        }
      }
      
      // Month filter (only if needed)
      if (monthFilter !== "all_months") {
        let dateToUse = referral.createdAt;
        if (statusFilter === "validated" && referral.validatedAt) {
          dateToUse = referral.validatedAt;
        } else if ((statusFilter === "converted" || statusFilter === "paid") && referral.updatedAt) {
          dateToUse = referral.updatedAt;
        }
        
        const referralDate = new Date(dateToUse);
        const referralMonth = referralDate.getMonth();
        const referralYear = referralDate.getFullYear();
        const [filterYear, filterMonth] = monthFilter.split("-").map(Number);
        if (referralYear !== filterYear || referralMonth !== filterMonth - 1) return false;
      }
      
      // Search term (most expensive - do last and only if needed)
      if (searchTerm !== "") {
        const user = userLookupMap.get(referral.userId);
        
        // Check simple fields first (cheapest)
        if (referral.fullName?.toLowerCase().includes(searchLower) ||
            referral.phone?.includes(searchTerm) ||
            referral.licensePlate?.toLowerCase().includes(searchLower) ||
            user?.fullName?.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Only check date if search contains '/' and nothing else matched
        if (hasDateSearch) {
          try {
            let dateToUse = referral.createdAt;
            if (statusFilter === "validated" && referral.validatedAt) {
              dateToUse = referral.validatedAt;
            } else if ((statusFilter === "converted" || statusFilter === "paid") && referral.updatedAt) {
              dateToUse = referral.updatedAt;
            }
            
            const referralDate = new Date(dateToUse);
            const formattedDate = format(referralDate, "dd/MM/yyyy", { locale: ptBR });
            if (formattedDate.includes(searchTerm)) return true;
            
            const shortDate = format(referralDate, "dd/MM", { locale: ptBR });
            if (shortDate.includes(searchTerm)) return true;
            
            const mediumDate = format(referralDate, "dd/MM/yy", { locale: ptBR });
            if (mediumDate.includes(searchTerm)) return true;
          } catch (error) {
            // Date parsing failed, skip
          }
        }
        
        return false;
      }
      
      return true;
    });
  }, [referrals, userLookupMap, searchTerm, statusFilter, contactStatusFilter, userFilter, companyFilter, monthFilter, localFilter]);

  // Memoized filter options to prevent recalculation on every render
  const activeIndicators = useMemo(() => {
    return users
      .filter(u => 
        (u.role === "indicador" || u.role === "indicador_nivel_1") && 
        u.isActive === true
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users]);

  const monthOptions = useMemo(() => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      months.push({ value: monthYear, label: monthName });
    }
    return months;
  }, []);

  const uniqueStates = useMemo(() => {
    const stateSet = new Set<string>();
    referrals.forEach((referral: any) => {
      if (referral.state) {
        stateSet.add(referral.state);
      }
    });
    return Array.from(stateSet).sort();
  }, [referrals]);

  // Helper function to get company name by ID
  const getCompanyName = (companyId: number) => {
    const company = companies.find((c: any) => c.id === companyId);
    return company?.name || "N/A";
  };

  // Helper function to get appropriate date for display based on status filter
  const getDisplayDate = (referral: any) => {
    // Show validated date when filtering by validated status
    if (statusFilter === "validated" && referral.validatedAt) {
      return referral.validatedAt;
    }
    // Show conversion date (updatedAt) when filtering by converted/paid status
    if ((statusFilter === "converted" || statusFilter === "paid") && referral.updatedAt) {
      return referral.updatedAt;
    }
    // Default to creation date
    return referral.createdAt;
  };

  // Export to Excel function - exports only filtered referrals
  const handleExportExcel = () => {
    try {
      // Prepare data for export from filtered referrals
      const exportData = filteredReferrals.map((referral: any) => {
        const user = users.find((u: any) => u.id === referral.userId);
        const company = companies.find((c: any) => c.id === referral.companyId);
        
        return {
          'Cliente': referral.fullName,
          'Telefone': referral.phone,
          'Placa': referral.licensePlate,
          'Seguradora': company?.name || 'N/A',
          'Cidade': referral.city || '-',
          'Estado': referral.state || '-',
          'Possui Seguro': referral.hasInsurance ? 'Sim' : 'Não',
          'Indicador': user?.fullName || 'N/A',
          'Status': getStatusLabel(referral.status as ReferralStatus),
          'Comissão Indicador (R$)': parseFloat(referral.commissionIndicator || '0').toFixed(2),
          'Comissão Promotor (R$)': parseFloat(referral.commissionPromoter || '0').toFixed(2),
          'Data': format(new Date(getDisplayDate(referral)), "dd/MM/yyyy HH:mm", { locale: ptBR }),
          'Data Criação': format(new Date(referral.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
          'Marca': referral.vehicleBrand || '-',
          'Modelo': referral.vehicleModel || '-',
          'Ano': referral.vehicleYear || '-',
          'Observações': referral.notes || '-'
        };
      });
      
      // Create worksheet from data
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Indicações');
      
      // Generate filename with current date and filter info
      let filename = `indicacoes_${new Date().toISOString().split('T')[0]}`;
      if (statusFilter !== "all_statuses") {
        filename += `_${getStatusLabel(statusFilter as ReferralStatus)}`;
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

  // Calculate statistics - memoized to avoid recalculating on every render
  const stats = useMemo(() => ({
    totalReferrals: referrals.length,
    pendingReferrals: referrals.filter((r: any) => r.status === "pending").length,
    analyzingReferrals: referrals.filter((r: any) => r.status === "analyzing").length,
    validatedReferrals: referrals.filter((r: any) => r.status === "validated").length,
    convertedReferrals: referrals.filter((r: any) => r.status === "converted" || r.status === "paid").length,
    rejectedReferrals: referrals.filter((r: any) => r.status === "rejected").length,
    totalCommissions: referrals
      .filter((r: any) => ['validated', 'converted'].includes(r.status))
      .reduce((sum: number, r: any) => sum + (parseFloat(r.commissionIndicator) || 0) + (parseFloat(r.commissionPromoter) || 0), 0)
  }), [referrals]);

  const getStatusBadgeColor = (status: ReferralStatus) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "analyzing": return "bg-blue-100 text-blue-800";
      case "converted": return "bg-purple-100 text-purple-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "validated": return "bg-green-100 text-green-800";
      case "paid": return "bg-emerald-100 text-emerald-800";
      case "false": return "bg-gray-900 text-white";
      case "not_validated": return "bg-orange-100 text-orange-800";
      case "not_converted": return "bg-indigo-100 text-indigo-800";
      case "contact_list": return "bg-cyan-100 text-cyan-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: ReferralStatus) => {
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
      default: return status;
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user?.fullName || "Usuário não encontrado";
  };

  const handleStatusUpdate = () => {
    if (selectedReferral && newStatus !== selectedReferral.status) {
      updateStatusMutation.mutate({
        referralId: selectedReferral.id,
        status: newStatus,
        notes: statusNotes,
        paymentProof: paymentProof || undefined
      });
    }
  };

  // Function to convert file to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: "Arquivo inválido", 
        description: "Por favor, selecione uma imagem (JPG, PNG, etc.)",
        variant: "destructive" 
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: "Arquivo muito grande", 
        description: "O tamanho máximo permitido é 5MB",
        variant: "destructive" 
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentProof(reader.result as string);
      toast({ 
        title: "Comprovante carregado", 
        description: "Clique em 'Atualizar Status' para salvar"
      });
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

  if (referralsLoading || usersLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando indicações...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
          <BackButton />
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Gestão Detalhada de Indicações</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1 md:mt-2">Visualize, analise e gerencie todas as indicações do sistema</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 md:gap-4 lg:gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total de Indicações</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold">{stats.totalReferrals}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600">{stats.pendingReferrals}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Em Análise</CardTitle>
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{stats.analyzingReferrals}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Validadas</CardTitle>
            <Check className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{stats.validatedReferrals}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Convertidas</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600">{stats.convertedReferrals}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Rejeitadas</CardTitle>
            <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">{stats.rejectedReferrals}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Comissões Totais</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">R$ {stats.totalCommissions.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Avançados
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 md:px-6 pb-4 md:pb-6">
          <div className="space-y-4">
            {/* Search Bar - Full Width on All Screens */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Buscar por cliente, telefone, placa, indicador ou data"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 text-sm md:text-base"
              />
            </div>
            
            {/* Filter Selects - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full text-sm md:text-base">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_statuses">Todos os Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="analyzing">Em Análise</SelectItem>
                  <SelectItem value="converted">Convertida</SelectItem>
                  <SelectItem value="rejected">Rejeitada</SelectItem>
                  <SelectItem value="validated">Validada</SelectItem>
                  <SelectItem value="paid">Paga</SelectItem>
                  <SelectItem value="false">Falso</SelectItem>
                  <SelectItem value="not_validated">Não validado</SelectItem>
                  <SelectItem value="not_converted">Não convertido</SelectItem>
                  <SelectItem value="contact_list">Lista de contato</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={contactStatusFilter} onValueChange={setContactStatusFilter}>
                <SelectTrigger className="w-full text-sm md:text-base">
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
              
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-full text-sm md:text-base">
                  <SelectValue placeholder="Indicador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_users">Todos os Indicadores</SelectItem>
                  {activeIndicators.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-full text-sm md:text-base">
                  <SelectValue placeholder="Seguradora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_companies">Todas as Seguradoras</SelectItem>
                  {companies.filter(company => company.isActive).map(company => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-full text-sm md:text-base">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_months">Todos os Meses</SelectItem>
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={localFilter} onValueChange={setLocalFilter}>
                <SelectTrigger className="w-full text-sm md:text-base">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_locals">Todos os Estados</SelectItem>
                  <SelectItem value="no_state">Sem Estado</SelectItem>
                  {uniqueStates.map(state => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card>
        <CardHeader className="px-3 md:px-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div>
              <CardTitle className="text-lg md:text-xl">Lista Detalhada de Indicações</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {filteredReferrals.length} de {referrals.length} indicações encontradas
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={async () => {
                  await refetchReferrals();
                  toast({ 
                    title: "✅ Dados atualizados!",
                    description: "A lista de indicações foi atualizada com sucesso."
                  });
                }}
                className="flex items-center justify-center gap-2 text-sm md:text-base"
                variant="outline"
                size="sm"
                disabled={referralsLoading}
              >
                <RefreshCw className={`h-3 w-3 md:h-4 md:w-4 ${referralsLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
              <Button 
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-2 text-sm md:text-base"
                variant="outline"
                size="sm"
              >
                <Download className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Exportar</span> Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {/* Mobile View - Cards */}
          <div className="block md:hidden">
            {filteredReferrals.map((referral) => (
              <div key={referral.id} className="border-b p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{referral.fullName}</p>
                    <p className="text-sm text-gray-600">{referral.phone}</p>
                  </div>
                  <Badge className={getStatusBadgeColor(referral.status)}>
                    {getStatusLabel(referral.status)}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Placa:</span> 
                    <span className="font-mono ml-1">{referral.licensePlate}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Local:</span> 
                    {referral.city && referral.state ? (
                      <span className="ml-1">{referral.city}/{referral.state}</span>
                    ) : (
                      <span className="text-gray-400 ml-1">-</span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Seguradora:</span> 
                    <span className="ml-1">{getCompanyName(referral.companyId)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Possui Seguro:</span>
                    <span className={`ml-1 font-medium ${referral.hasInsurance ? 'text-green-600' : 'text-red-600'}`}>
                      {referral.hasInsurance ? 'Sim' : 'Não'}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Indicador:</span>
                    <span className="ml-1">{getUserName(referral.userId)}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Data:</span>
                    <span className="ml-1">{format(new Date(getDisplayDate(referral)), "dd/MM/yy", { locale: ptBR })}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="text-sm">
                    <span className="text-green-600 font-semibold">
                      Ind: R$ {(parseFloat(referral.commissionIndicator) || 0).toFixed(2)}
                    </span>
                    {parseFloat(referral.commissionPromoter || '0') > 0 && (
                      <span className="text-blue-600 font-semibold ml-2">
                        Prom: R$ {parseFloat(referral.commissionPromoter).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {(user?.role === 'analista' || user?.role === 'admin') && (
                      <ValidationDialog referral={referral} onValidate={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
                      }} />
                    )}
                    {(user?.role === 'analista' || user?.role === 'admin') && (
                      <ContactStatusDialog referral={referral} onUpdate={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
                      }} />
                    )}
                    <Dialog open={isDialogOpen && selectedReferral?.id === referral.id} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (open) {
                        setSelectedReferral(referral);
                        setNewStatus(referral.status);
                        setPaymentProof(""); // Reset payment proof when opening dialog
                        setEditFormData({
                          fullName: referral.fullName,
                          phone: referral.phone,
                          licensePlate: referral.licensePlate,
                          companyId: referral.companyId || 1,
                          userId: referral.userId,
                          commissionIndicator: referral.commissionIndicator || "0",
                          commissionPromoter: referral.commissionPromoter || "0",
                          createdAt: referral.createdAt ? convertToLocalDateTimeString(referral.createdAt) : "",
                          city: referral.city || "",
                          state: referral.state || ""
                        });
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Editar Indicação</DialogTitle>
                          <DialogDescription>
                            Atualize os dados da indicação, altere o status ou delete o registro
                          </DialogDescription>
                        </DialogHeader>
                        
                        {selectedReferral && (
                          <div className="space-y-6">
                            {/* Seção 1: Editar Dados */}
                            <div className="space-y-4 border rounded-lg p-4">
                              <h3 className="font-semibold flex items-center gap-2">
                                <Edit className="h-4 w-4" />
                                Editar Dados da Indicação
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Nome Completo</label>
                                  <Input
                                    value={editFormData.fullName}
                                    onChange={(e) => setEditFormData({...editFormData, fullName: e.target.value})}
                                    placeholder="Nome completo do cliente"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Telefone</label>
                                  <Input
                                    value={editFormData.phone}
                                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                                    placeholder="(00) 00000-0000"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Placa do Veículo</label>
                                  <Input
                                    value={editFormData.licensePlate}
                                    onChange={(e) => setEditFormData({...editFormData, licensePlate: e.target.value})}
                                    placeholder="ABC-0000"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Seguradora</label>
                                  <Select 
                                    value={editFormData.companyId.toString()} 
                                    onValueChange={(value) => setEditFormData({...editFormData, companyId: parseInt(value)})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {companies.filter((company) => company.isActive || company.id === editFormData.companyId).map((company) => (
                                        <SelectItem key={company.id} value={company.id.toString()}>
                                          {company.name} {!company.isActive && "(Inativa)"}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Cidade</label>
                                  <Input
                                    value={editFormData.city}
                                    onChange={(e) => setEditFormData({...editFormData, city: e.target.value})}
                                    placeholder="Ex: São Paulo"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Estado</label>
                                  <Input
                                    value={editFormData.state}
                                    onChange={(e) => setEditFormData({...editFormData, state: e.target.value})}
                                    placeholder="Ex: SP"
                                  />
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium">📅 Data da Indicação</label>
                                <div className="p-2 bg-gray-50 rounded border mb-2">
                                  <p className="text-xs text-gray-600">Data atual:</p>
                                  <p className="text-sm font-medium">
                                    {selectedReferral.createdAt 
                                      ? format(new Date(selectedReferral.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                      : "Não definida"
                                    }
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs text-gray-600">Data</label>
                                    <Input
                                      type="date"
                                      value={editFormData.createdAt ? editFormData.createdAt.split('T')[0] : ''}
                                      onChange={(e) => {
                                        const date = e.target.value;
                                        const time = editFormData.createdAt ? editFormData.createdAt.split('T')[1] || '00:00' : '00:00';
                                        setEditFormData({...editFormData, createdAt: `${date}T${time}`});
                                      }}
                                      className="text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600">Hora (HH:MM)</label>
                                    <Input
                                      type="time"
                                      value={editFormData.createdAt ? editFormData.createdAt.split('T')[1] || '00:00' : '00:00'}
                                      onChange={(e) => {
                                        const time = e.target.value;
                                        const date = editFormData.createdAt ? editFormData.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
                                        setEditFormData({...editFormData, createdAt: `${date}T${time}`});
                                      }}
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500">Altere a data e hora se necessário</p>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-green-600" />
                                    Comissão Indicador (R$)
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.commissionIndicator}
                                    onChange={(e) => setEditFormData({...editFormData, commissionIndicator: e.target.value})}
                                    placeholder="0.00"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-blue-600" />
                                    Comissão Promotor (R$)
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.commissionPromoter}
                                    onChange={(e) => setEditFormData({...editFormData, commissionPromoter: e.target.value})}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                  <UserCheck className="h-4 w-4" />
                                  Atribuir a outro Usuário
                                </label>
                                <Popover open={userDropdownOpenMobile} onOpenChange={setUserDropdownOpenMobile}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={userDropdownOpenMobile}
                                      className="w-full justify-between font-normal"
                                    >
                                      {sortedUsers.find(u => u.id === editFormData.userId) 
                                        ? `${sortedUsers.find(u => u.id === editFormData.userId)?.fullName} (${sortedUsers.find(u => u.id === editFormData.userId)?.username}) - ${sortedUsers.find(u => u.id === editFormData.userId)?.role}`
                                        : "Selecione um usuário"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Pesquisar usuário..." />
                                      <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                                      <CommandGroup className="max-h-[200px] overflow-y-auto">
                                        {sortedUsers.map((user) => (
                                          <CommandItem
                                            key={user.id}
                                            value={`${user.fullName} ${user.username} ${user.role}`}
                                            onSelect={() => {
                                              console.log("[Select onChange Mobile] Novo userId selecionado:", user.id);
                                              setEditFormData({...editFormData, userId: user.id});
                                              setUserDropdownOpenMobile(false);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                editFormData.userId === user.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <div className="flex-1">
                                              <div className="font-medium">{user.fullName}</div>
                                              <div className="text-xs text-gray-500">
                                                {user.username} - {user.role}
                                              </div>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                {editFormData.userId > 0 && (
                                  <p className="text-xs text-gray-500">
                                    Usuário selecionado: {sortedUsers.find(u => u.id === editFormData.userId)?.fullName || "ID " + editFormData.userId}
                                  </p>
                                )}
                              </div>
                              
                              <Button 
                                onClick={() => {
                                  console.log("[Update Referral Mobile] Enviando dados:", editFormData);
                                  console.log("[Update Referral Mobile] CompanyId:", editFormData.companyId);
                                  
                                  // Convert local datetime back to UTC before sending
                                  const dataToSend = {
                                    ...editFormData,
                                    createdAt: editFormData.createdAt ? convertLocalToUTC(editFormData.createdAt) : editFormData.createdAt,
                                    paymentProof: paymentProof || selectedReferral.paymentProof // Use new proof or preserve existing
                                  };
                                  
                                  updateReferralMutation.mutate({
                                    referralId: selectedReferral.id,
                                    data: dataToSend
                                  });
                                }}
                                disabled={updateReferralMutation.isPending}
                                className="w-full"
                              >
                                {updateReferralMutation.isPending ? "Salvando..." : "Salvar Dados"}
                              </Button>
                            </div>
                            
                            {/* Seção 2: Alterar Status */}
                            <div className="space-y-4 border rounded-lg p-4">
                              <h3 className="font-semibold">Alterar Status</h3>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Status</label>
                                <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ReferralStatus)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="analyzing">Em Análise</SelectItem>
                                    <SelectItem value="converted">Convertida</SelectItem>
                                    <SelectItem value="rejected">Rejeitada</SelectItem>
                                    <SelectItem value="validated">Validada</SelectItem>
                                    <SelectItem value="paid">Paga</SelectItem>
                                    <SelectItem value="false">Falso</SelectItem>
                                    <SelectItem value="not_validated">Não validado</SelectItem>
                                    <SelectItem value="not_converted">Não convertido</SelectItem>
                                    <SelectItem value="contact_list">Lista de contato</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Observações</label>
                                <Textarea
                                  value={statusNotes}
                                  onChange={(e) => setStatusNotes(e.target.value)}
                                  placeholder="Adicione observações sobre a mudança de status..."
                                  rows={3}
                                />
                              </div>
                            
                            {selectedReferral.notes && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Observações Anteriores:</label>
                                <div className="p-2 bg-gray-50 rounded text-sm">
                                  {selectedReferral.notes}
                                </div>
                              </div>
                            )}
                            
                            {/* Commission change warning */}
                            {selectedReferral && newStatus !== selectedReferral.status && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-start">
                                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                                  <div>
                                    <h4 className="text-sm font-medium text-blue-800">
                                      💰 Alteração de Comissões
                                    </h4>
                                    <div className="text-sm text-blue-700 mt-1">
                                      {(() => {
                                        try {
                                          const currentIndicator = parseFloat(selectedReferral.commissionIndicator || '0');
                                          const currentPromoter = parseFloat(selectedReferral.commissionPromoter || '0');
                                          
                                          // Calculate new commissions based on status
                                          let newIndicator = 0;
                                          let newPromoter = 0;
                                          
                                          if (newStatus === 'validated') {
                                            newIndicator = 3;
                                            newPromoter = 1;
                                          } else if (newStatus === 'converted') {
                                            if (selectedReferral.status === 'validated') {
                                              newIndicator = currentIndicator + 50; // Sum to existing
                                              newPromoter = currentPromoter + 10;
                                            } else {
                                              newIndicator = 50;
                                              newPromoter = 10;
                                            }
                                          } else if (newStatus === 'paid') {
                                            newIndicator = currentIndicator; // Keep current
                                            newPromoter = currentPromoter;
                                          }
                                          // Para outros status (pending, rejected, analyzing, false, not_validated, not_converted), as comissões são zero
                                          
                                          const diffIndicator = newIndicator - currentIndicator;
                                          const diffPromoter = newPromoter - currentPromoter;
                                          
                                          return (
                                          <>
                                            <p>Esta mudança de status irá alterar as comissões:</p>
                                            <ul className="mt-2 space-y-1">
                                              <li>• Indicador: R$ {currentIndicator.toFixed(2)} → R$ {newIndicator.toFixed(2)} 
                                                <span className={`font-medium ${diffIndicator > 0 ? 'text-green-700' : diffIndicator < 0 ? 'text-red-700' : ''}`}>
                                                  {diffIndicator !== 0 && ` (${diffIndicator > 0 ? '+' : ''}R$ ${diffIndicator.toFixed(2)})`}
                                                </span>
                                              </li>
                                              {currentPromoter > 0 || newPromoter > 0 ? (
                                                <li>• Promotor: R$ {currentPromoter.toFixed(2)} → R$ {newPromoter.toFixed(2)}
                                                  <span className={`font-medium ${diffPromoter > 0 ? 'text-green-700' : diffPromoter < 0 ? 'text-red-700' : ''}`}>
                                                    {diffPromoter !== 0 && ` (${diffPromoter > 0 ? '+' : ''}R$ ${diffPromoter.toFixed(2)})`}
                                                  </span>
                                                </li>
                                              ) : null}
                                            </ul>
                                            {selectedReferral.status === 'validated' && newStatus === 'converted' && (
                                              <p className="mt-2 text-green-700 font-medium">
                                                ✅ Comissões serão somadas (validação + conversão)
                                              </p>
                                            )}
                                          </>
                                        );
                                        } catch (error) {
                                          console.error('[Commission Calculation Error]:', error);
                                          return <p className="text-red-600">Erro ao calcular comissões</p>;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                              
                              <Button 
                                onClick={handleStatusUpdate} 
                                disabled={updateStatusMutation.isPending}
                                className="w-full"
                              >
                                {updateStatusMutation.isPending ? "Atualizando..." : "Atualizar Status"}
                              </Button>
                            </div>
                            
                            {/* Seção 3: Deletar */}
                            <div className="space-y-4 border border-red-200 rounded-lg p-4 bg-red-50">
                              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                                <Trash2 className="h-4 w-4" />
                                Zona de Perigo
                              </h3>
                              <p className="text-sm text-red-600">
                                Esta ação é irreversível. A indicação será permanentemente removida do sistema.
                              </p>
                              
                              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button variant="destructive" className="w-full">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Deletar Indicação
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Confirmar Exclusão</DialogTitle>
                                    <DialogDescription>
                                      Tem certeza que deseja deletar esta indicação? Esta ação não pode ser desfeita.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="bg-red-50 p-3 rounded-lg">
                                      <p className="text-sm">
                                        <strong>Cliente:</strong> {selectedReferral.fullName}<br />
                                        <strong>Placa:</strong> {selectedReferral.licensePlate}<br />
                                        <strong>Status:</strong> {getStatusLabel(selectedReferral.status)}
                                      </p>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button 
                                        variant="outline" 
                                        onClick={() => setIsDeleteDialogOpen(false)}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button 
                                        variant="destructive" 
                                        onClick={() => {
                                          deleteReferralMutation.mutate(selectedReferral.id);
                                          setIsDeleteDialogOpen(false);
                                        }}
                                        disabled={deleteReferralMutation.isPending}
                                      >
                                        {deleteReferralMutation.isPending ? "Deletando..." : "Deletar Indicação"}
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop View - Table */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-full">
              <Table className="w-full text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Cliente</TableHead>
                  <TableHead className="min-w-[110px]">Telefone</TableHead>
                  <TableHead className="min-w-[80px]">Placa</TableHead>
                  <TableHead className="min-w-[120px]">Seguradora</TableHead>
                  <TableHead className="min-w-[90px]">Local</TableHead>
                  <TableHead className="min-w-[80px]">Tem Seguro</TableHead>
                  <TableHead className="min-w-[110px]">Indicador</TableHead>
                  <TableHead className="min-w-[90px]">Status</TableHead>
                  <TableHead className="min-w-[90px]">Contato</TableHead>
                  <TableHead className="min-w-[100px]">Comissões</TableHead>
                  <TableHead className="min-w-[70px]">Data</TableHead>
                  <TableHead className="min-w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell className="font-medium text-sm">
                      {referral.fullName}
                    </TableCell>
                    <TableCell className="text-xs">{referral.phone}</TableCell>
                    <TableCell className="font-mono text-xs">{referral.licensePlate}</TableCell>
                    <TableCell className="text-xs">
                      {getCompanyName(referral.companyId)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {referral.city && referral.state ? (
                        `${referral.city}/${referral.state}`
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className={`font-medium ${referral.hasInsurance ? 'text-green-600' : 'text-red-600'}`}>
                        {referral.hasInsurance ? 'Sim' : 'Não'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {getUserName(referral.userId)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusBadgeColor(referral.status)} text-xs`}>
                        {getStatusLabel(referral.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {referral.contactStatus ? (
                        <Badge className={cn("text-xs", contactStatusColors[referral.contactStatus])}>
                          {contactStatusLabels[referral.contactStatus]}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>
                        <span className="text-green-600 font-semibold">
                          I: {(parseFloat(referral.commissionIndicator) || 0).toFixed(0)}
                        </span>
                        {parseFloat(referral.commissionPromoter || '0') > 0 && (
                          <span className="text-blue-600 font-semibold block">
                            P: {parseFloat(referral.commissionPromoter).toFixed(0)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(getDisplayDate(referral)), "dd/MM", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {/* Botão de Validação - apenas para analistas e admin */}
                        {(user?.role === 'analista' || user?.role === 'admin') && (
                          <ValidationDialog referral={referral} onValidate={() => {
                            // Recarregar dados após validação
                            queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
                          }} />
                        )}
                        
                        {/* Botão de Status do Contato - apenas para analistas e admin */}
                        {(user?.role === 'analista' || user?.role === 'admin') && (
                          <ContactStatusDialog referral={referral} onUpdate={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
                          }} />
                        )}
                        
                        <Dialog open={isDialogOpen && selectedReferral?.id === referral.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (open) {
                            setSelectedReferral(referral);
                            setNewStatus(referral.status);
                            setEditFormData({
                              fullName: referral.fullName,
                              phone: referral.phone,
                              licensePlate: referral.licensePlate,
                              companyId: referral.companyId || 1,
                              userId: referral.userId,
                              commissionIndicator: referral.commissionIndicator || "0",
                              commissionPromoter: referral.commissionPromoter || "0",
                              createdAt: referral.createdAt ? convertToLocalDateTimeString(referral.createdAt) : "",
                              city: referral.city || "",
                              state: referral.state || ""
                            });
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Editar Indicação</DialogTitle>
                              <DialogDescription>
                                Atualize os dados da indicação, altere o status ou delete o registro
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedReferral && (
                              <div className="space-y-6">
                                {/* Seção 1: Editar Dados */}
                                <div className="space-y-4 border rounded-lg p-4">
                                  <h3 className="font-semibold flex items-center gap-2">
                                    <Edit className="h-4 w-4" />
                                    Editar Dados da Indicação
                                  </h3>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Nome Completo</label>
                                      <Input
                                        value={editFormData.fullName}
                                        onChange={(e) => setEditFormData({...editFormData, fullName: e.target.value})}
                                        placeholder="Nome completo do cliente"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Telefone</label>
                                      <Input
                                        value={editFormData.phone}
                                        onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                                        placeholder="(00) 00000-0000"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Placa do Veículo</label>
                                      <Input
                                        value={editFormData.licensePlate}
                                        onChange={(e) => setEditFormData({...editFormData, licensePlate: e.target.value})}
                                        placeholder="ABC-0000"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Seguradora</label>
                                      <Select 
                                        value={editFormData.companyId.toString()} 
                                        onValueChange={(value) => setEditFormData({...editFormData, companyId: parseInt(value)})}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {companies.filter((company) => company.isActive || company.id === editFormData.companyId).map((company) => (
                                            <SelectItem key={company.id} value={company.id.toString()}>
                                              {company.name} {!company.isActive && "(Inativa)"}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Cidade</label>
                                      <Input
                                        value={editFormData.city}
                                        onChange={(e) => setEditFormData({...editFormData, city: e.target.value})}
                                        placeholder="Ex: São Paulo"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Estado</label>
                                      <Input
                                        value={editFormData.state}
                                        onChange={(e) => setEditFormData({...editFormData, state: e.target.value})}
                                        placeholder="Ex: SP"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">📅 Data da Indicação</label>
                                      <div className="p-2 bg-gray-50 rounded border mb-2">
                                        <p className="text-xs text-gray-600">Data atual:</p>
                                        <p className="text-sm font-medium">
                                          {selectedReferral.createdAt 
                                            ? format(new Date(selectedReferral.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                            : "Não definida"
                                          }
                                        </p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-xs text-gray-600">Data</label>
                                          <Input
                                            type="date"
                                            value={editFormData.createdAt ? editFormData.createdAt.split('T')[0] : ''}
                                            onChange={(e) => {
                                              const date = e.target.value;
                                              const time = editFormData.createdAt ? editFormData.createdAt.split('T')[1] || '00:00' : '00:00';
                                              setEditFormData({...editFormData, createdAt: `${date}T${time}`});
                                            }}
                                            className="text-sm"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600">Hora (HH:MM)</label>
                                          <Input
                                            type="time"
                                            value={editFormData.createdAt ? editFormData.createdAt.split('T')[1] || '00:00' : '00:00'}
                                            onChange={(e) => {
                                              const time = e.target.value;
                                              const date = editFormData.createdAt ? editFormData.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
                                              setEditFormData({...editFormData, createdAt: `${date}T${time}`});
                                            }}
                                            className="text-sm"
                                          />
                                        </div>
                                      </div>
                                      <p className="text-xs text-gray-500">Altere a data e hora se necessário</p>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-green-600" />
                                        Comissão Indicador (R$)
                                      </label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.commissionIndicator}
                                        onChange={(e) => setEditFormData({...editFormData, commissionIndicator: e.target.value})}
                                        placeholder="0.00"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-blue-600" />
                                        Comissão Promotor (R$)
                                      </label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.commissionPromoter}
                                        onChange={(e) => setEditFormData({...editFormData, commissionPromoter: e.target.value})}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                      <UserCheck className="h-4 w-4" />
                                      Atribuir a outro Usuário
                                    </label>
                                    <Popover open={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          role="combobox"
                                          aria-expanded={userDropdownOpen}
                                          className="w-full justify-between font-normal"
                                        >
                                          {sortedUsers.find(u => u.id === editFormData.userId) 
                                            ? `${sortedUsers.find(u => u.id === editFormData.userId)?.fullName} (${sortedUsers.find(u => u.id === editFormData.userId)?.username}) - ${sortedUsers.find(u => u.id === editFormData.userId)?.role}`
                                            : "Selecione um usuário"}
                                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                          <CommandInput placeholder="Pesquisar usuário..." />
                                          <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                                          <CommandGroup className="max-h-[200px] overflow-y-auto">
                                            {sortedUsers.map((user) => (
                                              <CommandItem
                                                key={user.id}
                                                value={`${user.fullName} ${user.username} ${user.role}`}
                                                onSelect={() => {
                                                  console.log("[Select onChange] Novo userId selecionado:", user.id);
                                                  setEditFormData({...editFormData, userId: user.id});
                                                  setUserDropdownOpen(false);
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    editFormData.userId === user.id ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                <div className="flex-1">
                                                  <div className="font-medium">{user.fullName}</div>
                                                  <div className="text-xs text-gray-500">
                                                    {user.username} - {user.role}
                                                  </div>
                                                </div>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>
                                    {editFormData.userId > 0 && (
                                      <p className="text-xs text-gray-500">
                                        Usuário selecionado: {sortedUsers.find(u => u.id === editFormData.userId)?.fullName || "ID " + editFormData.userId}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <Button 
                                    onClick={() => {
                                      console.log("[Update Referral] Enviando dados:", editFormData);
                                      console.log("[Update Referral] CompanyId:", editFormData.companyId);
                                      
                                      // Convert local datetime back to UTC before sending
                                      const dataToSend = {
                                        ...editFormData,
                                        createdAt: editFormData.createdAt ? convertLocalToUTC(editFormData.createdAt) : editFormData.createdAt,
                                        paymentProof: paymentProof || selectedReferral.paymentProof // Use new proof or preserve existing
                                      };
                                      
                                      updateReferralMutation.mutate({
                                        referralId: selectedReferral.id,
                                        data: dataToSend
                                      });
                                    }}
                                    disabled={updateReferralMutation.isPending}
                                    className="w-full"
                                  >
                                    {updateReferralMutation.isPending ? "Salvando..." : "Salvar Dados"}
                                  </Button>
                                </div>
                                
                                {/* Seção 2: Alterar Status */}
                                <div className="space-y-4 border rounded-lg p-4">
                                  <h3 className="font-semibold">Alterar Status</h3>
                                  
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Status</label>
                                    <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ReferralStatus)}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="analyzing">Em Análise</SelectItem>
                                        <SelectItem value="converted">Convertida</SelectItem>
                                        <SelectItem value="rejected">Rejeitada</SelectItem>
                                        <SelectItem value="validated">Validada</SelectItem>
                                        <SelectItem value="paid">Paga</SelectItem>
                                        <SelectItem value="false">Falso</SelectItem>
                                        <SelectItem value="not_validated">Não validado</SelectItem>
                                        <SelectItem value="not_converted">Não convertido</SelectItem>
                                        <SelectItem value="contact_list">Lista de contato</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Observações</label>
                                    <Textarea
                                      value={statusNotes}
                                      onChange={(e) => setStatusNotes(e.target.value)}
                                      placeholder="Adicione observações sobre a mudança de status..."
                                      rows={3}
                                    />
                                  </div>

                                  {/* Comprovante de Pagamento */}
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                      📎 Comprovante de Pagamento
                                      {newStatus === "converted" && (!selectedReferral.paymentProof && !paymentProof) && (
                                        <span className="text-red-600 text-xs">(Obrigatório para conversão)</span>
                                      )}
                                    </label>
                                    
                                    {selectedReferral.paymentProof && !paymentProof && (
                                      <div className="mb-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-sm text-green-700 mb-2">✅ Comprovante já anexado anteriormente</p>
                                        <img 
                                          src={selectedReferral.paymentProof} 
                                          alt="Comprovante de pagamento" 
                                          className="max-w-full h-auto max-h-40 rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => window.open(selectedReferral.paymentProof, '_blank')}
                                          title="Clique para visualizar em tamanho completo"
                                        />
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          onClick={() => downloadPaymentProof(selectedReferral.paymentProof, selectedReferral.id)}
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
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => downloadPaymentProof(paymentProof, selectedReferral.id)}
                                          >
                                            <Download className="h-4 w-4 mr-2" />
                                            Baixar
                                          </Button>
                                          <Button 
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
                                      type="file"
                                      accept="image/*"
                                      onChange={handleFileChange}
                                      className="cursor-pointer"
                                    />
                                    <p className="text-xs text-gray-500">
                                      Formatos aceitos: JPG, PNG, etc. (máx. 5MB)
                                    </p>
                                  </div>
                                
                                {/* Histórico de Status com Observações */}
                                {selectedReferral.statusHistory && selectedReferral.statusHistory.length > 0 && (
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
                                                    {getStatusLabel(entry.status)}
                                                  </Badge>
                                                  <span className="text-xs text-gray-600 font-medium">
                                                    {entryUser?.fullName || 'Usuário não encontrado'}
                                                  </span>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                  {format(entryDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
                                {selectedReferral.notes && (!selectedReferral.statusHistory || selectedReferral.statusHistory.length === 0) && (
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Observações Anteriores:</label>
                                    <div className="p-2 bg-gray-50 rounded text-sm">
                                      {selectedReferral.notes}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Commission change warning */}
                                {selectedReferral && newStatus !== selectedReferral.status && (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex items-start">
                                      <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                                      <div>
                                        <h4 className="text-sm font-medium text-blue-800">
                                          💰 Alteração de Comissões
                                        </h4>
                                        <div className="text-sm text-blue-700 mt-1">
                                          {(() => {
                                            try {
                                              const currentIndicator = parseFloat(selectedReferral.commissionIndicator || '0');
                                              const currentPromoter = parseFloat(selectedReferral.commissionPromoter || '0');
                                              
                                              // Calculate new commissions based on status
                                              let newIndicator = 0;
                                              let newPromoter = 0;
                                              
                                              if (newStatus === 'validated') {
                                                newIndicator = 3;
                                                newPromoter = 1;
                                              } else if (newStatus === 'converted') {
                                                if (selectedReferral.status === 'validated') {
                                                  newIndicator = currentIndicator + 50; // Sum to existing
                                                  newPromoter = currentPromoter + 10;
                                                } else {
                                                  newIndicator = 50;
                                                  newPromoter = 10;
                                                }
                                              } else if (newStatus === 'paid') {
                                                newIndicator = currentIndicator; // Keep current
                                                newPromoter = currentPromoter;
                                              }
                                              // Para outros status (pending, rejected, analyzing, false, not_validated, not_converted), as comissões são zero
                                              
                                              const diffIndicator = newIndicator - currentIndicator;
                                              const diffPromoter = newPromoter - currentPromoter;
                                              
                                              return (
                                              <>
                                                <p>Esta mudança de status irá alterar as comissões:</p>
                                                <ul className="mt-2 space-y-1">
                                                  <li>• Indicador: R$ {currentIndicator.toFixed(2)} → R$ {newIndicator.toFixed(2)} 
                                                    <span className={`font-medium ${diffIndicator > 0 ? 'text-green-700' : diffIndicator < 0 ? 'text-red-700' : ''}`}>
                                                      {diffIndicator !== 0 && ` (${diffIndicator > 0 ? '+' : ''}R$ ${diffIndicator.toFixed(2)})`}
                                                    </span>
                                                  </li>
                                                  {currentPromoter > 0 || newPromoter > 0 ? (
                                                    <li>• Promotor: R$ {currentPromoter.toFixed(2)} → R$ {newPromoter.toFixed(2)}
                                                      <span className={`font-medium ${diffPromoter > 0 ? 'text-green-700' : diffPromoter < 0 ? 'text-red-700' : ''}`}>
                                                        {diffPromoter !== 0 && ` (${diffPromoter > 0 ? '+' : ''}R$ ${diffPromoter.toFixed(2)})`}
                                                      </span>
                                                    </li>
                                                  ) : null}
                                                </ul>
                                                {selectedReferral.status === 'validated' && newStatus === 'converted' && (
                                                  <p className="mt-2 text-green-700 font-medium">
                                                    ✅ Comissões serão somadas (validação + conversão)
                                                  </p>
                                                )}
                                              </>
                                            );
                                            } catch (error) {
                                              console.error('[Commission Calculation Error]:', error);
                                              return <p className="text-red-600">Erro ao calcular comissões</p>;
                                            }
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                  
                                  <Button 
                                    onClick={handleStatusUpdate} 
                                    disabled={updateStatusMutation.isPending}
                                    className="w-full"
                                  >
                                    {updateStatusMutation.isPending ? "Atualizando..." : "Atualizar Status"}
                                  </Button>
                                </div>
                                
                                {/* Seção 3: Deletar */}
                                <div className="space-y-4 border border-red-200 rounded-lg p-4 bg-red-50">
                                  <h3 className="font-semibold text-red-700 flex items-center gap-2">
                                    <Trash2 className="h-4 w-4" />
                                    Zona de Perigo
                                  </h3>
                                  <p className="text-sm text-red-600">
                                    Esta ação é irreversível. A indicação será permanentemente removida do sistema.
                                  </p>
                                  
                                  <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                    <DialogTrigger asChild>
                                      <Button variant="destructive" className="w-full">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Deletar Indicação
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                                      <DialogHeader>
                                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                                        <DialogDescription>
                                          Tem certeza que deseja deletar esta indicação? Esta ação não pode ser desfeita.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="bg-red-50 p-3 rounded-lg">
                                          <p className="text-sm">
                                            <strong>Cliente:</strong> {selectedReferral.fullName}<br />
                                            <strong>Telefone:</strong> {selectedReferral.phone}<br />
                                            <strong>Placa:</strong> {selectedReferral.licensePlate}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                                          Cancelar
                                        </Button>
                                        <Button 
                                          variant="destructive" 
                                          onClick={() => deleteReferralMutation.mutate(selectedReferral.id)}
                                          disabled={deleteReferralMutation.isPending}
                                        >
                                          {deleteReferralMutation.isPending ? "Deletando..." : "Sim, Deletar"}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            
            {filteredReferrals.length === 0 && (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma indicação encontrada com os filtros aplicados.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}