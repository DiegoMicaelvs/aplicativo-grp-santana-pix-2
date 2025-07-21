import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function ClearSessionButton() {
  const { toast } = useToast();

  const clearSession = async () => {
    try {
      // Clear all query cache
      queryClient.clear();
      
      // Clear local storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear cookies by setting them to expire
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      
      toast({
        title: "Sessão limpa",
        description: "Cache e dados de sessão foram removidos. Tente fazer login novamente.",
      });
      
      // Refresh the page
      window.location.reload();
    } catch (error) {
      console.error('Error clearing session:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar sessão. Recarregue a página manualmente.",
        variant: "destructive"
      });
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={clearSession}
      className="text-xs"
    >
      Limpar Sessão
    </Button>
  );
}