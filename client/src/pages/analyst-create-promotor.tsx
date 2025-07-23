import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type UserInsert } from "@shared/schema";
import { ArrowLeft, UserPlus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export default function AnalystCreatePromotorPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<UserInsert>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      role: "promotor",
      isActive: true,
      mustChangePassword: true
    }
  });

  const createPromotorMutation = useMutation({
    mutationFn: async (data: UserInsert) => {
      const response = await fetch("/api/analyst/promotores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar promotor");
      }
      return response.json();
    },
    onSuccess: (newUser) => {
      toast({
        title: "Sucesso",
        description: `Promotor ${newUser.fullName} criado com sucesso!`,
      });
      setLocation("/analyst");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserInsert) => {
    // Auto-set username as email if not provided
    if (!data.username) {
      data.username = data.email;
    }
    createPromotorMutation.mutate(data);
  };

  const { handleSubmit, register, setValue, watch, formState: { errors } } = form;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Criar Novo Promotor</h1>
            <p className="text-gray-600 mt-2">Cadastre um novo promotor no sistema</p>
          </div>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Dados do Promotor
          </CardTitle>
          <CardDescription>
            Preencha as informações do novo promotor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Nome Completo *</Label>
                <Input
                  id="fullName"
                  {...register("fullName")}
                  placeholder="Nome completo do promotor"
                />
                {errors.fullName && (
                  <p className="text-sm text-red-600">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  {...register("cpf")}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {errors.cpf && (
                  <p className="text-sm text-red-600">{errors.cpf.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email de Contato *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="email@exemplo.com"
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="username">Email de Login</Label>
                <Input
                  id="username"
                  type="email"
                  {...register("username")}
                  placeholder="Se vazio, usará o email de contato"
                />
                {errors.username && (
                  <p className="text-sm text-red-600">{errors.username.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="(11) 99999-9999"
                />
                {errors.phone && (
                  <p className="text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="shirtSize">Tamanho da Camisa *</Label>
                <Select onValueChange={(value) => setValue("shirtSize", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tamanho" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PP">PP</SelectItem>
                    <SelectItem value="P">P</SelectItem>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="G">G</SelectItem>
                    <SelectItem value="GG">GG</SelectItem>
                    <SelectItem value="XG">XG</SelectItem>
                  </SelectContent>
                </Select>
                {errors.shirtSize && (
                  <p className="text-sm text-red-600">{errors.shirtSize.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="address">Endereço Completo *</Label>
              <Input
                id="address"
                {...register("address")}
                placeholder="Rua, número, bairro, cidade - Estado"
              />
              {errors.address && (
                <p className="text-sm text-red-600">{errors.address.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="pixKey">Chave PIX *</Label>
              <Input
                id="pixKey"
                {...register("pixKey")}
                placeholder="CPF, email, telefone ou chave aleatória"
              />
              {errors.pixKey && (
                <p className="text-sm text-red-600">{errors.pixKey.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Senha Temporária *</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                O usuário será obrigado a alterar a senha no primeiro login
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/analyst")}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createPromotorMutation.isPending}
              >
                {createPromotorMutation.isPending ? "Criando..." : "Criar Promotor"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}