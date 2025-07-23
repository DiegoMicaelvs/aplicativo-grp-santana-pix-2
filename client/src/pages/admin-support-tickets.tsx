import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/ui/back-button';
import { 
  HelpCircle, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  User,
  Calendar,
  Paperclip,
  Send,
  RefreshCcw,
  Eye,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { queryClient } from '@/lib/queryClient';

interface SupportTicket {
  id: number;
  ticketNumber: string;
  userId: number;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: 'bug' | 'feature' | 'question' | 'other';
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    fullName: string;
    username: string;
  };
  responses: TicketResponse[];
}

interface TicketResponse {
  id: number;
  ticketId: number;
  userId: number;
  isAdminResponse: boolean;
  message: string;
  attachments: string[];
  createdAt: string;
  user: {
    fullName: string;
    username: string;
  };
}

export default function AdminSupportTickets() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const { toast } = useToast();

  // Fetch all support tickets
  const { data: tickets = [], isLoading, refetch } = useQuery<SupportTicket[]>({
    queryKey: ['/api/admin/support-tickets']
  });

  // Update ticket status mutation
  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: number; status: string }) => {
      const response = await fetch(`/api/admin/support-tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Erro ao atualizar status do ticket');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status do ticket atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/support-tickets'] });
      setShowTicketDialog(false);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  });

  // Add response to ticket mutation
  const addResponseMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: number; message: string }) => {
      const response = await fetch(`/api/admin/support-tickets/${ticketId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, isAdminResponse: true })
      });
      if (!response.ok) throw new Error('Erro ao adicionar resposta');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Resposta adicionada com sucesso!" });
      setResponseMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/support-tickets'] });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar resposta", variant: "destructive" });
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bug':
        return <AlertTriangle className="w-4 h-4" />;
      case 'feature':
        return <CheckCircle className="w-4 h-4" />;
      case 'question':
        return <HelpCircle className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="w-4 h-4" />;
      case 'in_progress':
        return <MessageSquare className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'closed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'bug': return 'Bug/Erro';
      case 'feature': return 'Recurso';
      case 'question': return 'Dúvida';
      case 'other': return 'Outro';
      default: return category;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Andamento';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low': return 'Baixa';
      case 'medium': return 'Média';
      case 'high': return 'Alta';
      case 'urgent': return 'Urgente';
      default: return priority;
    }
  };

  // Filter tickets based on status and priority
  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  const getTicketStats = () => {
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      urgent: tickets.filter(t => t.priority === 'urgent').length,
    };
    return stats;
  };

  const stats = getTicketStats();

  const handleAddResponse = () => {
    if (!selectedTicket || !responseMessage.trim()) return;
    
    addResponseMutation.mutate({
      ticketId: selectedTicket.id,
      message: responseMessage.trim()
    });
  };

  const handleStatusUpdate = (status: string) => {
    if (!selectedTicket) return;
    
    updateTicketMutation.mutate({
      ticketId: selectedTicket.id,
      status
    });
  };

  const openTicketDialog = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowTicketDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center ml-[14px] mr-[14px] pl-[3px] pr-[3px] mt-[28px] mb-[28px]">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tickets de Suporte</h1>
        </div>
        <Button onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</p>
              </div>
              <HelpCircle className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Abertos</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.open}</p>
              </div>
              <Clock className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Em Andamento</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.inProgress}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Resolvidos</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Urgentes</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.urgent}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Prioridade
              </label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Prioridades</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Tickets</CardTitle>
          <CardDescription>
            {filteredTickets.length} ticket(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando tickets...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8">
              <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum ticket encontrado com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">
                        #{ticket.ticketNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <div>
                            <div className="font-medium text-sm">{ticket.user.fullName}</div>
                            <div className="text-xs text-gray-500">{ticket.user.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={ticket.subject}>
                          {ticket.subject}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(ticket.category)}
                          <span className="text-sm">{getCategoryLabel(ticket.category)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(ticket.priority)} variant="outline">
                          {getPriorityLabel(ticket.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(ticket.status)}
                          <Badge className={getStatusColor(ticket.status)} variant="outline">
                            {getStatusLabel(ticket.status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">{formatDateTime(ticket.createdAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTicketDialog(ticket)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Ticket Detail Dialog */}
      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Ticket #{selectedTicket?.ticketNumber}
            </DialogTitle>
            <DialogDescription>
              Detalhes do ticket e histórico de respostas
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-6">
              {/* Ticket Info */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {selectedTicket.user.fullName} ({selectedTicket.user.username})
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDateTime(selectedTicket.createdAt)}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getPriorityColor(selectedTicket.priority)} variant="outline">
                        {getPriorityLabel(selectedTicket.priority)}
                      </Badge>
                      <Badge className={getStatusColor(selectedTicket.status)} variant="outline">
                        {getStatusLabel(selectedTicket.status)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Descrição:</h4>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {selectedTicket.description}
                      </p>
                    </div>

                    {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Anexos:</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedTicket.attachments.map((attachment, index) => (
                            <a 
                              key={index}
                              href={attachment} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <Paperclip className="w-4 h-4" />
                              <span className="text-sm">Anexo {index + 1}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Status Update */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Atualizar Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedTicket.status === 'open' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusUpdate('open')}
                      disabled={updateTicketMutation.isPending}
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Aberto
                    </Button>
                    <Button
                      variant={selectedTicket.status === 'in_progress' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusUpdate('in_progress')}
                      disabled={updateTicketMutation.isPending}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Em Andamento
                    </Button>
                    <Button
                      variant={selectedTicket.status === 'resolved' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusUpdate('resolved')}
                      disabled={updateTicketMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Resolvido
                    </Button>
                    <Button
                      variant={selectedTicket.status === 'closed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusUpdate('closed')}
                      disabled={updateTicketMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Fechado
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Responses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Histórico de Respostas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedTicket.responses && selectedTicket.responses.length > 0 ? (
                      selectedTicket.responses.map((response) => (
                        <div
                          key={response.id}
                          className={`p-4 rounded-lg border ${
                            response.isAdminResponse
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span className="font-medium text-sm">
                                {response.user.fullName}
                                {response.isAdminResponse && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Admin
                                  </Badge>
                                )}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(response.createdAt)}
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {response.message}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">
                        Nenhuma resposta ainda.
                      </p>
                    )}

                    {/* Add Response Form */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">Adicionar Resposta</h4>
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Digite sua resposta..."
                          value={responseMessage}
                          onChange={(e) => setResponseMessage(e.target.value)}
                          rows={3}
                        />
                        <div className="flex justify-end">
                          <Button
                            onClick={handleAddResponse}
                            disabled={!responseMessage.trim() || addResponseMutation.isPending}
                            className="flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            {addResponseMutation.isPending ? 'Enviando...' : 'Enviar Resposta'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}