import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, FilterIcon, RefreshCcwIcon, UserIcon, ActivityIcon, FileTextIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { BackButton } from '@/components/ui/back-button';

interface AuditLogEntry {
  id: number;
  userId: number;
  action: string;
  entityType: string;
  entityId?: number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
    fullName: string;
    role: string;
  };
}

export default function AdminAuditLog() {
  const [filters, setFilters] = useState({
    userId: '',
    entityType: '',
    fromDate: null as Date | null,
    toDate: null as Date | null
  });

  const { data: auditLogs = [], isLoading, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ['/api/admin/audit-log', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.fromDate) params.append('fromDate', filters.fromDate.toISOString());
      if (filters.toDate) params.append('toDate', filters.toDate.toISOString());
      
      const response = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json();
    }
  });

  const clearFilters = () => {
    setFilters({
      userId: '',
      entityType: '',
      fromDate: null,
      toDate: null
    });
  };

  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'update':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'delete':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'login':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case 'user':
        return <UserIcon className="w-4 h-4" />;
      case 'referral':
        return <ActivityIcon className="w-4 h-4" />;
      case 'withdrawal_request':
        return <FileTextIcon className="w-4 h-4" />;
      default:
        return <ActivityIcon className="w-4 h-4" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Log de Auditoria</h1>
        </div>
        <Button onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCcwIcon className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="w-5 h-5" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro por usuário */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                ID do Usuário
              </label>
              <Input
                type="number"
                placeholder="ID do usuário"
                value={filters.userId}
                onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
              />
            </div>

            {/* Filtro por tipo de entidade */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo de Entidade
              </label>
              <Select value={filters.entityType} onValueChange={(value) => 
                setFilters(prev => ({ ...prev, entityType: value === 'all' ? '' : value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="referral">Indicação</SelectItem>
                  <SelectItem value="withdrawal_request">Solicitação de Saque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro data inicial */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Data Inicial
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.fromDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.fromDate ? (
                      format(filters.fromDate, "dd/MM/yyyy")
                    ) : (
                      <span>Selecionar data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.fromDate || undefined}
                    onSelect={(date) => setFilters(prev => ({ ...prev, fromDate: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtro data final */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Data Final
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.toDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.toDate ? (
                      format(filters.toDate, "dd/MM/yyyy")
                    ) : (
                      <span>Selecionar data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.toDate || undefined}
                    onSelect={(date) => setFilters(prev => ({ ...prev, toDate: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de logs */}
      <Card>
        <CardHeader>
          <CardTitle>Registros de Auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-gray-600 dark:text-gray-400">Carregando logs...</div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              Nenhum registro encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{log.user?.fullName}</div>
                            <div className="text-sm text-gray-500">@{log.user?.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionBadgeColor(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEntityTypeIcon(log.entityType)}
                          <span className="capitalize">{log.entityType.replace('_', ' ')}</span>
                          {log.entityId && (
                            <span className="text-sm text-gray-500">#{log.entityId}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={log.details || ''}>
                        {log.details || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ipAddress || '-'}
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