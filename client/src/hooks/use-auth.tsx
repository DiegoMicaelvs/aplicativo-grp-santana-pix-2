import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User, InsertUser, LoginData } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, InsertUser>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      /**
       * Zera o cache ANTES de marcar o novo usuário.
       *
       * O React Query guarda as respostas por 5 min de staleTime e 10 min de
       * gcTime (ver lib/queryClient.ts). Sem limpar, quem logasse logo depois
       * de outra pessoa no MESMO navegador via as telas montarem com os dados
       * da conta anterior — sem nem chamar a API, porque o cache ainda estava
       * "fresco". Os dados só sumiam quando ficavam obsoletos e o refetch
       * trazia os corretos.
       *
       * Era assim que leads de outra conta apareciam e depois sumiam. Com
       * nome, telefone e CPF de terceiros na tela, isso é incidente de dado
       * pessoal — e num computador compartilhado (evento, escritório) acontece
       * a cada troca de usuário.
       */
      queryClient.clear();
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login realizado com sucesso!",
        description: `Bem-vindo(a) de volta, ${user.fullName}!`,
      });
      
      // Redirect based on user role after successful login
      if (user.role === "indicador_nivel_1") {
        setLocation("/new-referral");
      } else if (user.role === "admin") {
        setLocation("/admin");
      } else if (user.role === "promotor") {
        setLocation("/promoter-dashboard");
      } else if (user.role === "supervisor") {
        setLocation("/supervisor-dashboard");
      } else {
        setLocation("/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no login",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", userData);
      return await res.json();
    },
    onSuccess: (user: User) => {
      // Mesmo motivo do login: o cadastro também troca de identidade.
      queryClient.clear();
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Cadastro realizado com sucesso!",
        description: "Você já pode começar a indicar seus amigos e ganhar comissões!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no cadastro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Sair tem que levar os dados junto: antes só a query "/api/user" era
      // zerada e todo o resto (indicações, saques, usuários) continuava no
      // cache do navegador, visível para o próximo que logasse.
      queryClient.clear();
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logout realizado com sucesso",
        description: "Até logo!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha ao sair",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
