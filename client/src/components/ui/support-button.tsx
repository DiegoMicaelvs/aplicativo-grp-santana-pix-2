import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Upload, X, FileText, Image, Paperclip } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const supportTicketSchema = z.object({
  subject: z.string().min(5, "Assunto deve ter pelo menos 5 caracteres"),
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.enum(["bug", "feature", "question", "other"])
});

type SupportTicketForm = z.infer<typeof supportTicketSchema>;

export function SupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [showMyTickets, setShowMyTickets] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<SupportTicketForm>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      subject: "",
      description: "",
      priority: "medium",
      category: "question"
    }
  });

  // Get user's tickets
  const { data: userTickets = [] } = useQuery<any[]>({
    queryKey: ["/api/support/my-tickets"],
    enabled: showMyTickets
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: SupportTicketForm & { attachments: string[] }) => {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao criar ticket");
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Ticket criado com sucesso!", 
        description: `Número do ticket: ${data.ticketNumber}` 
      });
      form.reset();
      setSelectedFiles([]);
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/support/my-tickets"] });
    },
    onError: () => {
      toast({ title: "Erro ao criar ticket", variant: "destructive" });
    },
  });

  const uploadFilesMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const uploadedUrls: string[] = [];
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch("/api/support/upload", {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          const { url } = await response.json();
          uploadedUrls.push(url);
        }
      }
      
      return uploadedUrls;
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB max
      const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/pdf'].includes(file.type);
      return isValidSize && isValidType;
    });
    
    setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 3)); // Max 3 files
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: SupportTicketForm) => {
    let attachmentUrls: string[] = [];
    
    if (selectedFiles.length > 0) {
      try {
        attachmentUrls = await uploadFilesMutation.mutateAsync(selectedFiles);
      } catch (error) {
        toast({ title: "Erro ao fazer upload dos arquivos", variant: "destructive" });
        return;
      }
    }
    
    createTicketMutation.mutate({ ...data, attachments: attachmentUrls });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-100 text-blue-800";
      case "in_progress": return "bg-purple-100 text-purple-800";
      case "resolved": return "bg-green-100 text-green-800";
      case "closed": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="fixed bottom-4 right-4 z-50 shadow-lg">
            <HelpCircle className="h-4 w-4 mr-2" />
            Suporte
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Central de Suporte</DialogTitle>
            <DialogDescription>
              Relate problemas, solicite recursos ou tire dúvidas sobre o sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Toggle between create ticket and my tickets */}
            <div className="flex gap-2">
              <Button 
                variant={!showMyTickets ? "default" : "outline"}
                onClick={() => setShowMyTickets(false)}
                size="sm"
              >
                Novo Ticket
              </Button>
              <Button 
                variant={showMyTickets ? "default" : "outline"}
                onClick={() => setShowMyTickets(true)}
                size="sm"
              >
                Meus Tickets
              </Button>
            </div>

            {!showMyTickets ? (
              // Create new ticket form
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bug">Reportar Bug/Erro</SelectItem>
                            <SelectItem value="feature">Solicitar Recurso</SelectItem>
                            <SelectItem value="question">Dúvida/Pergunta</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a prioridade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assunto</FormLabel>
                        <FormControl>
                          <Input placeholder="Descreva resumidamente o problema..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição Detalhada</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descreva detalhadamente o problema, quando ocorreu, quais passos foram seguidos..."
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* File upload section */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Anexos (Opcional)</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <div className="flex flex-col items-center space-y-2">
                        <Upload className="h-8 w-8 text-gray-400" />
                        <div className="text-center">
                          <p className="text-sm text-gray-600">
                            Anexe imagens ou arquivos que mostrem o problema
                          </p>
                          <p className="text-xs text-gray-500">
                            PNG, JPG, GIF, PDF, TXT (máx. 5MB cada, 3 arquivos)
                          </p>
                        </div>
                        <input
                          type="file"
                          multiple
                          accept=".png,.jpg,.jpeg,.gif,.pdf,.txt"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="file-upload"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => document.getElementById('file-upload')?.click()}
                        >
                          <Paperclip className="h-4 w-4 mr-2" />
                          Selecionar Arquivos
                        </Button>
                      </div>
                    </div>

                    {/* Selected files preview */}
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center space-x-2">
                              {file.type.startsWith('image/') ? (
                                <Image className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                              <span className="text-sm truncate">{file.name}</span>
                              <span className="text-xs text-gray-500">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createTicketMutation.isPending || uploadFilesMutation.isPending}
                    >
                      {createTicketMutation.isPending || uploadFilesMutation.isPending ? "Enviando..." : "Criar Ticket"}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              // My tickets list
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  Seus tickets de suporte:
                </div>
                
                {userTickets.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Você ainda não tem tickets de suporte.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {userTickets.map((ticket: any) => (
                      <Card key={ticket.id}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-sm font-medium">
                                #{ticket.ticketNumber}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {ticket.subject}
                              </CardDescription>
                            </div>
                            <div className="flex space-x-2">
                              <Badge className={getPriorityColor(ticket.priority)} variant="secondary">
                                {ticket.priority}
                              </Badge>
                              <Badge className={getStatusColor(ticket.status)} variant="secondary">
                                {ticket.status}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-2">
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {ticket.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Criado em: {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}