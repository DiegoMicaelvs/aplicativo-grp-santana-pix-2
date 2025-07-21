import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  BanknoteIcon, 
  CheckIcon, 
  XIcon, 
  ClockIcon, 
  UserIcon,
  CreditCardIcon,
  AlertTriangleIcon,
  RefreshCcwIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { queryClient } from '@/lib/queryClient';

interface WithdrawalRequest {
  id: number;
  userId: number;
  amount: string;
  pixKey: string;
  status: 'pending' | 'paid' | 'rejected';
  requestedAt: string;
  processedAt?: string;
  notes?: string;
  processedBy?: number;
  user: {
    id: number;
    username: string;
    fullName: string;
    cpf: string;
    balance: string;
  };
  processedByUser?: {
    id: number;
    fullName: string;
  };
}

interface CashFlowData {
  entries: any[];
  balance: number;
}

export default function AdminWithdrawals() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [processingNotes, setProcessingNotes] = useState('');
  const { toast } = useToast();

  const { data: withdrawals = [], isLoading, refetch } = useQuery<WithdrawalRequest[]>({
    queryKey: ['/api/admin/withdrawals']
  });

  const { data: cashFlow } = useQuery<CashFlowData>({
    queryKey: ['/api/admin/cash-flow']
  });

  const updateWithdrawalMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const response = await fetch(`/api/admin/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      });
      if (!response.ok) throw new Error('Failed to update withdrawal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cash-flow'] });
      setSelectedWithdrawal(null);
      setProcessingNotes('');
      toast({
        title: "Sucesso",
        description: "Solicitação de saque processada com sucesso"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar solicitação",
        variant: "destructive"
      });
    }
  });

  const filteredWithdrawals = withdrawals.filter(withdrawal => {
    if (statusFilter === 'all') return true;
    return withdrawal.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <ClockIcon className="w-3 h-3 mr-1" />
          Pendente
        </Badge>;
      case 'paid':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckIcon className="w-3 h-3 mr-1" />
          Pago
        </Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <XIcon className="w-3 h-3 mr-1" />
          Rejeitado
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
  };

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  };

  const getTotalByStatus = (status: string) => {
    return withdrawals
      .filter(w => w.status === status)
      .reduce((sum, w) => sum + parseFloat(w.amount), 0);
  };

  const handleProcessWithdrawal = (withdrawal: WithdrawalRequest, newStatus: 'paid' | 'rejected') => {
    updateWithdrawalMutation.mutate({
      id: withdrawal.id,
      status: newStatus,
      notes: processingNotes
    });
  };

  const validateCpfMatch = (withdrawal: WithdrawalRequest) => {
    const userCpf = withdrawal.user.cpf?.replace(/\D/g, '');
    const pixCpf = withdrawal.pixKey?.replace(/\D/g, '');
    return userCpf === pixCpf;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciar Saques</h1>
        <Button onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCcwIcon className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Saldo Atual</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(cashFlow?.balance || 0)}
                </p>
              </div>
              <BanknoteIcon className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {formatCurrency(getTotalByStatus('pending'))}
                </p>
              </div>
              <ClockIcon className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pagos</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(getTotalByStatus('paid'))}
                </p>
              </div>
              <CheckIcon className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rejeitados</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(getTotalByStatus('rejected'))}
                </p>
              </div>
              <XIcon className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="w-full md:w-64">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredWithdrawals.length} solicitação(ões) encontrada(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de saques */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitações de Saque</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-gray-600 dark:text-gray-400">Carregando solicitações...</div>
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              Nenhuma solicitação encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Chave PIX</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead>Saldo do Usuário</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWithdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{withdrawal.user.fullName}</div>
                            <div className="text-sm text-gray-500">{withdrawal.user.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-lg">
                        {formatCurrency(withdrawal.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CreditCardIcon className="w-4 h-4 text-gray-400" />
                          <div className="font-mono text-sm">{withdrawal.pixKey}</div>
                          {!validateCpfMatch(withdrawal) && (
                            <div title="CPF da chave PIX não confere com o cadastro">
                              <AlertTriangleIcon className="w-4 h-4 text-red-500" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(withdrawal.requestedAt)}
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          parseFloat(withdrawal.user.balance) >= parseFloat(withdrawal.amount)
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatCurrency(withdrawal.user.balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {withdrawal.status === 'pending' && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  setSelectedWithdrawal(withdrawal);
                                  setProcessingNotes('');
                                }}
                              >
                                Processar
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Processar Solicitação de Saque</DialogTitle>
                              </DialogHeader>
                              
                              {selectedWithdrawal && (
                                <div className="space-y-6">
                                  {/* Informações do usuário */}
                                  <div className="border rounded-lg p-4 space-y-2">
                                    <h3 className="font-semibold">Informações do Usuário</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Nome:</span>
                                        <span className="ml-2 font-medium">{selectedWithdrawal.user.fullName}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">CPF:</span>
                                        <span className="ml-2 font-mono">{selectedWithdrawal.user.cpf}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Saldo Atual:</span>
                                        <span className="ml-2 font-semibold text-green-600">{formatCurrency(selectedWithdrawal.user.balance)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Valor Solicitado:</span>
                                        <span className="ml-2 font-semibold text-blue-600">{formatCurrency(selectedWithdrawal.amount)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Validação de CPF */}
                                  {!validateCpfMatch(selectedWithdrawal) && (
                                    <Alert variant="destructive">
                                      <AlertTriangleIcon className="w-4 h-4" />
                                      <AlertDescription>
                                        <strong>Atenção:</strong> A chave PIX (CPF) não confere com o CPF cadastrado do usuário. 
                                        Verifique antes de aprovar o pagamento.
                                      </AlertDescription>
                                    </Alert>
                                  )}

                                  {/* Chave PIX */}
                                  <div className="border rounded-lg p-4">
                                    <h3 className="font-semibold mb-2">Chave PIX para Pagamento</h3>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                                      <span className="font-mono text-lg">{selectedWithdrawal.pixKey}</span>
                                    </div>
                                  </div>

                                  {/* Verificação de saldo */}
                                  {parseFloat(selectedWithdrawal.user.balance) < parseFloat(selectedWithdrawal.amount) && (
                                    <Alert variant="destructive">
                                      <AlertTriangleIcon className="w-4 h-4" />
                                      <AlertDescription>
                                        <strong>Saldo Insuficiente:</strong> O usuário não possui saldo suficiente para este saque.
                                      </AlertDescription>
                                    </Alert>
                                  )}

                                  {/* Notas */}
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Notas (opcional)</label>
                                    <Textarea
                                      placeholder="Adicione observações sobre o processamento..."
                                      value={processingNotes}
                                      onChange={(e) => setProcessingNotes(e.target.value)}
                                    />
                                  </div>

                                  {/* Ações */}
                                  <div className="flex justify-end gap-3">
                                    <Button
                                      variant="destructive"
                                      onClick={() => handleProcessWithdrawal(selectedWithdrawal, 'rejected')}
                                      disabled={updateWithdrawalMutation.isPending}
                                    >
                                      <XIcon className="w-4 h-4 mr-2" />
                                      Rejeitar
                                    </Button>
                                    <Button
                                      onClick={() => handleProcessWithdrawal(selectedWithdrawal, 'paid')}
                                      disabled={updateWithdrawalMutation.isPending}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckIcon className="w-4 h-4 mr-2" />
                                      {updateWithdrawalMutation.isPending ? 'Processando...' : 'Aprovar Pagamento'}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        )}
                        
                        {withdrawal.status !== 'pending' && (
                          <div className="text-sm text-gray-500">
                            {withdrawal.processedAt && `Processado em ${formatDateTime(withdrawal.processedAt)}`}
                            {withdrawal.processedByUser && (
                              <div>por {withdrawal.processedByUser.fullName}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}