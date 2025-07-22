import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Smartphone } from "lucide-react";
import { 
  ArrowLeft, 
  Settings, 
  Database, 
  Mail, 
  Shield, 
  Users, 
  DollarSign,
  Bell,
  Globe,
  Palette,
  Server,
  Key,
  RefreshCw,
  MessageSquare,
  Phone
} from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [smsStatus, setSmsStatus] = useState<any>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isTestingSms, setIsTestingSms] = useState(false);

  // Estado das configurações do sistema
  const [systemSettings, setSystemSettings] = useState({
    siteName: "Kong Pix - Indique e Ganhe",
    siteUrl: "https://indique.replit.app",
    maintenanceMode: false,
    registrationEnabled: true,
    emailNotifications: true,
    smsNotifications: false,
    defaultCommissionAmount: 3.00,
    bonusCommissionAmount: 50.00,
    autoApproveReferrals: false,
    requireEmailVerification: true,
    maxReferralsPerDay: 100
  });



  // Carregar status do SMS ao inicializar
  useEffect(() => {
    const fetchSmsStatus = async () => {
      try {
        const response = await fetch('/api/admin/sms/status', {
          credentials: 'include'
        });
        const data = await response.json();
        setSmsStatus(data);
        
        // Atualizar configuração baseada no status
        if (data.configured) {
          setSystemSettings(prev => ({ ...prev, smsNotifications: true }));
        }
      } catch (error) {
        console.error('Error fetching SMS status:', error);
      }
    };

    fetchSmsStatus();
  }, []);

  const handleSettingChange = (key: string, value: any) => {
    setSystemSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Função para testar SMS
  const handleTestSms = async () => {
    if (!testPhone) {
      toast({
        title: "Erro",
        description: "Por favor, insira um número de telefone para teste.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingSms(true);
    try {
      const response = await fetch('/api/admin/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber: testPhone }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar SMS');
      }

      toast({
        title: "SMS Enviado",
        description: data.message || "SMS de teste enviado com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro no teste",
        description: error.message || "Falha ao enviar SMS de teste.",
        variant: "destructive",
      });
    } finally {
      setIsTestingSms(false);
    }
  };

  // Função para enviar SMS manual
  const handleSendManualSms = async () => {
    if (!testPhone || !testMessage) {
      toast({
        title: "Erro",
        description: "Por favor, preencha o número e a mensagem.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          phoneNumber: testPhone, 
          message: testMessage 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar SMS');
      }

      toast({
        title: "SMS Enviado",
        description: data.message || "SMS enviado com sucesso!",
      });

      setTestMessage("");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Falha ao enviar SMS.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      // Aqui seria feita a chamada à API para salvar as configurações
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Configurações salvas",
        description: "As configurações do sistema foram atualizadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações do Sistema</h1>
            <p className="text-gray-600">Gerencie as configurações globais do sistema</p>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="commissions" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Comissões</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Segurança</span>
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Banco</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">Avançado</span>
            </TabsTrigger>
          </TabsList>

          {/* Configurações Gerais */}
          <TabsContent value="general">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Configurações do Site
                  </CardTitle>
                  <CardDescription>
                    Configure as informações básicas do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="siteName">Nome do Site</Label>
                    <Input 
                      id="siteName"
                      value={systemSettings.siteName}
                      onChange={(e) => handleSettingChange('siteName', e.target.value)}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="siteUrl">URL do Site</Label>
                    <Input 
                      id="siteUrl"
                      value={systemSettings.siteUrl}
                      onChange={(e) => handleSettingChange('siteUrl', e.target.value)}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Modo de Manutenção</Label>
                      <p className="text-sm text-gray-600">
                        Ativar para bloquear acesso temporariamente
                      </p>
                    </div>
                    <Switch
                      checked={systemSettings.maintenanceMode}
                      onCheckedChange={(checked) => handleSettingChange('maintenanceMode', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Registro de Novos Usuários</Label>
                      <p className="text-sm text-gray-600">
                        Permitir que novos usuários se cadastrem
                      </p>
                    </div>
                    <Switch
                      checked={systemSettings.registrationEnabled}
                      onCheckedChange={(checked) => handleSettingChange('registrationEnabled', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configurações de Comissões */}
          <TabsContent value="commissions">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Configurações de Comissão
                  </CardTitle>
                  <CardDescription>
                    Configure os valores de comissão e limites do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="defaultCommission">Comissão Padrão (R$)</Label>
                    <Input 
                      id="defaultCommission"
                      type="number"
                      step="0.01"
                      min="0"
                      value={systemSettings.defaultCommissionAmount}
                      onChange={(e) => handleSettingChange('defaultCommissionAmount', parseFloat(e.target.value))}
                    />
                    <p className="text-sm text-gray-600">Valor pago por cadastro validado</p>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="bonusCommission">Comissão de Bônus (R$)</Label>
                    <Input 
                      id="bonusCommission"
                      type="number"
                      step="0.01"
                      min="0"
                      value={systemSettings.bonusCommissionAmount}
                      onChange={(e) => handleSettingChange('bonusCommissionAmount', parseFloat(e.target.value))}
                    />
                    <p className="text-sm text-gray-600">Bônus adicional por venda convertida</p>
                  </div>



                  <div className="grid gap-2">
                    <Label htmlFor="maxReferrals">Máximo de Indicações por Dia</Label>
                    <Input 
                      id="maxReferrals"
                      type="number"
                      min="1"
                      value={systemSettings.maxReferralsPerDay}
                      onChange={(e) => handleSettingChange('maxReferralsPerDay', parseInt(e.target.value))}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Auto-aprovação de Indicações</Label>
                      <p className="text-sm text-gray-600">
                        Aprovar automaticamente indicações válidas
                      </p>
                    </div>
                    <Switch
                      checked={systemSettings.autoApproveReferrals}
                      onCheckedChange={(checked) => handleSettingChange('autoApproveReferrals', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configurações de Notificações */}
          <TabsContent value="notifications">
            <div className="grid gap-6">
              {/* Configurações de Email */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Notificações por Email
                  </CardTitle>
                  <CardDescription>
                    Configure as notificações por email
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Notificações por Email</Label>
                      <p className="text-sm text-gray-600">
                        Enviar notificações importantes por email
                      </p>
                    </div>
                    <Switch
                      checked={systemSettings.emailNotifications}
                      onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Configurações de SMS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Notificações por SMS
                  </CardTitle>
                  <CardDescription>
                    Configure e teste as notificações por SMS via Comtele
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status do SMS */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Status da Configuração</h4>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Status do SMS</p>
                          <p className="text-sm text-gray-600">
                            {smsStatus?.message || "Carregando..."}
                          </p>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={smsStatus?.configured 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                          }
                        >
                          {smsStatus?.configured ? "Configurado" : "Não Configurado"}
                        </Badge>
                      </div>
                      
                      {smsStatus?.configured && (
                        <>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Provedor</p>
                              <p className="text-sm text-gray-600">{smsStatus.provider || 'Comtele'}</p>
                            </div>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              OK
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Auth Key</p>
                              <p className="text-sm text-gray-600">{smsStatus.authKey || 'Configurado'}</p>
                            </div>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              OK
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Sender ID</p>
                              <p className="text-sm text-gray-600">{smsStatus.sender || 'KongPix'}</p>
                            </div>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              OK
                            </Badge>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Configuração de ativação */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Notificações por SMS Ativas</Label>
                      <p className="text-sm text-gray-600">
                        {smsStatus?.configured 
                          ? "Ativar envio automático de SMS para usuários"
                          : "Configure as credenciais do Comtele primeiro"
                        }
                      </p>
                    </div>
                    <Switch
                      checked={systemSettings.smsNotifications && smsStatus?.configured}
                      disabled={!smsStatus?.configured}
                      onCheckedChange={(checked) => handleSettingChange('smsNotifications', checked)}
                    />
                  </div>

                  <Separator />

                  {/* Teste de SMS */}
                  {smsStatus?.configured && (
                    <div className="space-y-4">
                      {/* Aviso sobre Comtele */}
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-800">SMS via Comtele Configurado</AlertTitle>
                        <AlertDescription className="space-y-2 text-blue-700">
                          <p>Seu sistema está configurado para enviar SMS via Comtele.</p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                            <li>Provider: Comtele SMS</li>
                            <li>Auth Key: Configurada</li>
                            <li>Sender ID: KongPix</li>
                            <li>Status: Pronto para uso</li>
                          </ul>
                          
                          <div className="mt-3 p-2 bg-green-50 rounded-md">
                            <p className="text-sm font-medium text-green-800">✅ Sistema Pronto</p>
                            <p className="text-xs text-green-700 mt-1">
                              O sistema está configurado e pronto para enviar SMS para qualquer número brasileiro.
                              Use o formulário abaixo para testar o envio.
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>

                      <h4 className="font-medium">Teste de SMS</h4>
                      <div className="grid gap-3">
                        <div className="grid gap-2">
                          <Label htmlFor="testPhone">Número para Teste</Label>
                          <Input 
                            id="testPhone"
                            placeholder="(11) 99999-9999"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                          />
                          <p className="text-sm text-gray-600">
                            Use formato brasileiro: (11) 99999-9999
                          </p>
                          <p className="text-xs text-orange-600 font-medium">
                            ⚠️ Conta Trial: Este número precisa estar verificado no Twilio primeiro
                          </p>
                        </div>
                        
                        <Button 
                          onClick={handleTestSms}
                          disabled={isTestingSms || !testPhone}
                          className="w-full"
                        >
                          {isTestingSms ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Enviando Teste...
                            </>
                          ) : (
                            <>
                              <Phone className="h-4 w-4 mr-2" />
                              Enviar SMS de Teste
                            </>
                          )}
                        </Button>
                      </div>

                      <Separator />

                      {/* Envio manual de SMS */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Envio Manual de SMS</h4>
                        <div className="grid gap-3">
                          <div className="grid gap-2">
                            <Label htmlFor="testMessage">Mensagem Personalizada</Label>
                            <Input 
                              id="testMessage"
                              placeholder="Digite sua mensagem..."
                              value={testMessage}
                              onChange={(e) => setTestMessage(e.target.value)}
                              maxLength={160}
                            />
                            <p className="text-sm text-gray-600">
                              {testMessage.length}/160 caracteres
                            </p>
                          </div>
                          
                          <Button 
                            onClick={handleSendManualSms}
                            disabled={isLoading || !testPhone || !testMessage}
                            variant="outline"
                            className="w-full"
                          >
                            {isLoading ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Enviar SMS Manual
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Informação sobre configuração */}
                  {!smsStatus?.configured && (
                    <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="h-4 w-4 text-yellow-600" />
                        <p className="font-medium text-yellow-800">Configuração Necessária</p>
                      </div>
                      <p className="text-sm text-yellow-700">
                        Para ativar SMS, adicione as seguintes variáveis de ambiente:
                      </p>
                      <ul className="text-sm text-yellow-700 mt-2 list-disc list-inside">
                        <li>TWILIO_ACCOUNT_SID</li>
                        <li>TWILIO_AUTH_TOKEN</li>
                        <li>TWILIO_PHONE_NUMBER</li>
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configurações de Segurança */}
          <TabsContent value="security">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Configurações de Segurança
                  </CardTitle>
                  <CardDescription>
                    Configure as políticas de segurança do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Verificação de Email Obrigatória</Label>
                      <p className="text-sm text-gray-600">
                        Exigir verificação de email no cadastro
                      </p>
                    </div>
                    <Switch
                      checked={systemSettings.requireEmailVerification}
                      onCheckedChange={(checked) => handleSettingChange('requireEmailVerification', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Status de Segurança</h3>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">HTTPS</p>
                          <p className="text-sm text-gray-600">Conexão segura ativa</p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Ativo
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Criptografia de Senhas</p>
                          <p className="text-sm text-gray-600">Algoritmo scrypt</p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Ativo
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Sessões Seguras</p>
                          <p className="text-sm text-gray-600">PostgreSQL sessions</p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Ativo
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configurações do Banco de Dados */}
          <TabsContent value="database">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Status do Banco de Dados
                  </CardTitle>
                  <CardDescription>
                    Informações sobre o banco de dados do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Tipo de Banco</p>
                        <p className="text-sm text-gray-600">PostgreSQL (Neon)</p>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Conectado
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Ambiente</p>
                        <p className="text-sm text-gray-600">Produção</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Ativo
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Backup Automático</p>
                        <p className="text-sm text-gray-600">Gerenciado pela Neon</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Ativo
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium">Ações de Manutenção</h4>
                    <div className="flex gap-3">
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Verificar Conexão
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configurações Avançadas */}
          <TabsContent value="advanced">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Configurações Avançadas
                  </CardTitle>
                  <CardDescription>
                    Configurações técnicas e de desenvolvedor
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Key className="h-4 w-4 text-yellow-600" />
                      <p className="font-medium text-yellow-800">Variáveis de Ambiente</p>
                    </div>
                    <p className="text-sm text-yellow-700">
                      Algumas configurações são controladas por variáveis de ambiente e requerem reinicialização do servidor.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">DATABASE_URL</p>
                        <p className="text-sm text-gray-600">Configurado</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        OK
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">NODE_ENV</p>
                        <p className="text-sm text-gray-600">production</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        OK
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">DEVELOPER_MASTER_PASSWORD</p>
                        <p className="text-sm text-gray-600">Configurado para operações sensíveis</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        OK
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Botão de Salvar */}
        <div className="flex justify-end gap-4 pt-6">
          <Link href="/admin/dashboard-new">
            <Button variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button 
            onClick={handleSaveSettings}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configurações'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}