import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, CreditCard, TrendingUp, TrendingDown, Search, Filter, Eye, Check, X, Clock, AlertTriangle, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { BackButton } from "@/components/ui/back-button";

export default function AdminPaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all_statuses");
  const [typeFilter, setTypeFilter] = useState<string>("all_types");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processingNotes, setProcessingNotes] = useState("");

  const { toast } = useToast();

  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/withdrawals"]
  });

  const { data: cashFlowData = { entries: [], balance: 0 }, isLoading: cashFlowLoading } = useQuery<any>({
    queryKey: ["/api/admin/cash-flow"]
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"]
  });

  const processWithdrawalMutation = useMutation({
    mutationFn: async ({ withdrawalId, action, notes }: { withdrawalId: number; action: "approve" | "reject"; notes: string }) => {
      const status = action === "approve" ? "approved" : "rejected";
      const response = await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (!response.ok) throw new Error("Erro ao processar saque");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cash-flow"] });
      toast({ title: "Saque processado com sucesso!" });
      setIsDialogOpen(false);
      setProcessingNotes("");
    },
    onError: () => {
      toast({ title: "Erro ao processar saque", variant: "destructive" });
    },
  });

  // Filter withdrawals
  const filteredWithdrawals = withdrawals.filter((withdrawal: any) => {
    const user = users.find((u: any) => u.id === withdrawal.userId);
    const matchesSearch = user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         withdrawal.pixKey?.includes(searchTerm);
    const matchesStatus = statusFilter === "all_statuses" || withdrawal.status === statusFilter;
    const matchesType = typeFilter === "all_types" || withdrawal.requestType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate statistics
  const stats = {
    totalWithdrawals: withdrawals.length,
    pendingWithdrawals: withdrawals.filter((w: any) => w.status === "pending").length,
    approvedWithdrawals: withdrawals.filter((w: any) => w.status === "approved").length,
    totalPaidAmount: withdrawals.filter((w: any) => w.status === "paid").reduce((sum: number, w: any) => sum + parseFloat(w.amount), 0),
    totalPendingAmount: withdrawals.filter((w: any) => w.status === "pending").reduce((sum: number, w: any) => sum + parseFloat(w.amount), 0),
    totalInflow: cashFlowData.entries.filter((cf: any) => cf.type === "inflow").reduce((sum: number, cf: any) => sum + parseFloat(cf.amount), 0),
    totalOutflow: cashFlowData.entries.filter((cf: any) => cf.type === "outflow").reduce((sum: number, cf: any) => sum + parseFloat(cf.amount), 0)
  };

  const netCashFlow = stats.totalInflow - stats.totalOutflow;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "approved": return "bg-blue-100 text-blue-800";
      case "paid": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendente";
      case "approved": return "Aprovado";
      case "paid": return "Pago";
      case "rejected": return "Rejeitado";
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "indicador": return "Indicador";
      case "promotor": return "Promotor";
      default: return type;
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    return user?.fullName || "Usuário não encontrado";
  };

  const handleProcessWithdrawal = (action: "approve" | "reject") => {
    if (selectedWithdrawal) {
      processWithdrawalMutation.mutate({
        withdrawalId: selectedWithdrawal.id,
        action,
        notes: processingNotes
      });
    }
  };

  if (withdrawalsLoading || cashFlowLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando dados de pagamentos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Controle de Pagamentos</h1>
            <p className="text-gray-600 mt-2">Gerencie solicitações de saque e controle o fluxo de caixa</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saques Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingWithdrawals}</div>
            <p className="text-xs text-muted-foreground">R$ {stats.totalPendingAmount.toFixed(2)} pendentes</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ {stats.totalPaidAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{stats.approvedWithdrawals} saques aprovados</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ {stats.totalInflow.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fluxo Líquido</CardTitle>
            {netCashFlow >= 0 ? 
              <TrendingUp className="h-4 w-4 text-green-600" /> : 
              <TrendingDown className="h-4 w-4 text-red-600" />
            }
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R$ {netCashFlow.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, email ou chave PIX..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_statuses">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_types">Todos os Tipos</SelectItem>
                <SelectItem value="indicador">Indicador</SelectItem>
                <SelectItem value="promotor">Promotor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawals Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Solicitações de Saque</CardTitle>
          <CardDescription>
            {filteredWithdrawals.length} de {withdrawals.length} solicitações encontradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Chave PIX</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Solicitação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWithdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="font-medium">{getUserName(withdrawal.userId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTypeLabel(withdrawal.requestType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      R$ {parseFloat(withdrawal.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{withdrawal.pixKey}</TableCell>
                    <TableCell className="font-mono text-sm">{withdrawal.cpfKey}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(withdrawal.status)}>
                        {getStatusLabel(withdrawal.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(withdrawal.requestedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog open={isDialogOpen && selectedWithdrawal?.id === withdrawal.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (open) {
                            setSelectedWithdrawal(withdrawal);
                            setProcessingNotes("");
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={withdrawal.status !== "pending"}>
                              <Eye className="h-4 w-4 mr-1" />
                              {withdrawal.status === "pending" ? "Processar" : "Visualizar"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Detalhes do Saque</DialogTitle>
                              <DialogDescription>
                                Analise e processe a solicitação de saque
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedWithdrawal && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <strong>Usuário:</strong> {getUserName(selectedWithdrawal.userId)}
                                  </div>
                                  <div>
                                    <strong>Tipo:</strong> {getTypeLabel(selectedWithdrawal.requestType)}
                                  </div>
                                  <div>
                                    <strong>Valor:</strong> R$ {parseFloat(selectedWithdrawal.amount).toFixed(2)}
                                  </div>
                                  <div>
                                    <strong>Chave PIX:</strong> {selectedWithdrawal.pixKey}
                                  </div>
                                  <div>
                                    <strong>CPF:</strong> {selectedWithdrawal.cpfKey}
                                  </div>
                                  <div>
                                    <strong>Status:</strong> {getStatusLabel(selectedWithdrawal.status)}
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Observações do Processamento:</label>
                                  <Textarea
                                    value={processingNotes}
                                    onChange={(e) => setProcessingNotes(e.target.value)}
                                    placeholder="Adicione observações sobre o processamento..."
                                    rows={3}
                                  />
                                </div>
                                
                                {selectedWithdrawal.notes && (
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Observações do Usuário:</label>
                                    <div className="p-2 bg-gray-50 rounded text-sm">
                                      {selectedWithdrawal.notes}
                                    </div>
                                  </div>
                                )}
                                
                                {selectedWithdrawal.status === "pending" && (
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      variant="destructive" 
                                      onClick={() => handleProcessWithdrawal("reject")}
                                      disabled={processWithdrawalMutation.isPending}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Rejeitar
                                    </Button>
                                    <Button 
                                      onClick={() => handleProcessWithdrawal("approve")}
                                      disabled={processWithdrawalMutation.isPending}
                                    >
                                      <Check className="h-4 w-4 mr-1" />
                                      Aprovar
                                    </Button>
                                  </div>
                                )}
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
            
            {filteredWithdrawals.length === 0 && (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma solicitação de saque encontrada.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Resumo do Fluxo de Caixa
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
          </CardTitle>
          <CardDescription>Últimas movimentações financeiras</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Operador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashFlowData.entries.slice(0, 10).map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge className={entry.type === "inflow" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {entry.type === "inflow" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell className={entry.type === "inflow" ? "text-green-600" : "text-red-600"}>
                      {entry.type === "inflow" ? "+" : "-"}R$ {parseFloat(entry.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      R$ {parseFloat(entry.balance).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {entry.createdByUser ? entry.createdByUser.fullName : "Sistema"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {cashFlowData.entries.length === 0 && (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma movimentação encontrada.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}