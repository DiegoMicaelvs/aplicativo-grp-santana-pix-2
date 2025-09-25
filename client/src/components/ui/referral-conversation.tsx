import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  MessageCircle, 
  Clock, 
  User as UserIcon,
  Shield,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Send
} from "lucide-react";
import { ReferralConversation, CreateReferralConversation, User } from "@shared/schema";

type ReferralConversationWithUser = ReferralConversation & {
  user?: User;
};

const conversationSchema = z.object({
  message: z.string().min(1, "Mensagem é obrigatória"),
  messageType: z.enum(["comment", "status_change", "validation", "system"]).default("comment"),
  isInternal: z.boolean().default(false),
});

type ConversationFormValues = z.infer<typeof conversationSchema>;

interface ReferralConversationProps {
  referralId: number;
  userRole: string;
}

export function ReferralConversationComponent({ referralId, userRole }: ReferralConversationProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  const form = useForm<ConversationFormValues>({
    resolver: zodResolver(conversationSchema),
    defaultValues: {
      message: "",
      messageType: "comment",
      isInternal: false,
    },
  });

  const { data: conversations = [], isLoading } = useQuery<ReferralConversationWithUser[]>({
    queryKey: ["/api/referrals", referralId, "conversations"],
  });

  const createConversationMutation = useMutation({
    mutationFn: (data: ConversationFormValues) => apiRequest("POST", `/api/referrals/${referralId}/conversations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals", referralId, "conversations"] });
      form.reset();
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi adicionada ao histórico da indicação.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Erro ao adicionar mensagem",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ConversationFormValues) => {
    createConversationMutation.mutate(data);
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case "status_change":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "validation":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "system":
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  const getMessageTypeBadge = (type: string) => {
    switch (type) {
      case "status_change":
        return <Badge variant="outline" className="text-orange-600">Mudança de Status</Badge>;
      case "validation":
        return <Badge variant="outline" className="text-green-600">Validação</Badge>;
      case "system":
        return <Badge variant="outline" className="text-blue-600">Sistema</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-600">Comentário</Badge>;
    }
  };

  const canAddMessage = userRole === "admin" || userRole === "analista" || userRole === "indicador" || userRole === "promotor";
  const canAddInternalMessage = userRole === "admin" || userRole === "analista";

  // Hide conversation history for level 1 indicators
  if (userRole === 'indicador_nivel_1') {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Histórico da Indicação</CardTitle>
            <Badge variant="secondary">{conversations.length} mensagem(s)</Badge>
          </div>
          <Button variant="ghost" size="sm">
            {isExpanded ? "Recolher" : "Expandir"}
          </Button>
        </div>
        <CardDescription>
          Acompanhe o histórico completo de observações e mudanças desta indicação
        </CardDescription>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Conversation History */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Carregando histórico...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma mensagem ainda</p>
                <p className="text-sm text-gray-400">As observações dos analistas aparecerão aqui</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div key={conversation.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {conversation.user?.fullName?.charAt(0) || <UserIcon className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {conversation.user?.fullName || "Sistema"}
                      </span>
                      {getMessageTypeBadge(conversation.messageType)}
                      {conversation.isInternal && (
                        <Badge variant="destructive" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Interno
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(conversation.createdAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      {getMessageTypeIcon(conversation.messageType)}
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {conversation.message}
                      </p>
                    </div>
                    
                    {/* Metadata display for status changes */}
                    {conversation.metadata && (
                      <div className="text-xs text-gray-500 bg-white p-2 rounded border">
                        {conversation.metadata.oldStatus && conversation.metadata.newStatus && (
                          <p>Status: {conversation.metadata.oldStatus} → {conversation.metadata.newStatus}</p>
                        )}
                        {conversation.metadata.validationScore && (
                          <p>Pontuação de validação: {conversation.metadata.validationScore}/10</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Message Form */}
          {canAddMessage && (
            <div className="border-t pt-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova Observação</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Adicione uma observação sobre esta indicação..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <FormField
                      control={form.control}
                      name="messageType"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Tipo de Mensagem</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="comment">Comentário</SelectItem>
                              {(userRole === "admin" || userRole === "analista") && (
                                <>
                                  <SelectItem value="validation">Validação</SelectItem>
                                  <SelectItem value="status_change">Mudança de Status</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {canAddInternalMessage && (
                      <FormField
                        control={form.control}
                        name="isInternal"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-6">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm">
                              Mensagem interna (apenas analistas)
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={createConversationMutation.isPending}
                      className="min-w-[120px]"
                    >
                      {createConversationMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar Mensagem
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}