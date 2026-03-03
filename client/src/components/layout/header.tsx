import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, User, LogOut, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import logoIcon from "@assets/fivicon (3)_1762537559063.png";

export default function Header() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isMobile = useMobile();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "?";
    const names = user.fullName?.split(' ') || [];
    if (names.length >= 2) {
      return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`;
    }
    return user.fullName?.charAt(0) || "?";
  };
  
  const isActive = (path: string) => {
    return location === path ? "border-primary-500 text-gray-900" : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300";
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 md:justify-start md:space-x-10">
          <div className="flex justify-start lg:w-0 lg:flex-1">
            <Link href="/" className="flex items-center space-x-4 group">
              <span className="sr-only">LeadFlow</span>
              <img 
                src={logoIcon} 
                alt="LeadFlow Logo" 
                className="h-24 w-auto transition-transform duration-200 group-hover:scale-105" 
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))' }}
              />
              <span className="text-3xl font-bold text-primary font-heading">LeadFlow</span>
            </Link>
          </div>

          {isMobile ? (
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle className="font-heading">LeadFlow</SheetTitle>
                  <SheetDescription>
                    Cadastrou, validou é PIX! Indique e ganhe comissões
                  </SheetDescription>
                </SheetHeader>
                <div className="py-4 flex flex-col gap-2">
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link href="/#como-funciona" onClick={() => { setIsOpen(false); if (location === '/') document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' }); }}>Como Funciona</Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link href="/#vantagens" onClick={() => { setIsOpen(false); if (location === '/') document.getElementById('vantagens')?.scrollIntoView({ behavior: 'smooth' }); }}>Vantagens</Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link href="/#faq" onClick={() => { setIsOpen(false); if (location === '/') document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }); }}>Perguntas Frequentes</Link>
                  </Button>
                  
                  {user ? (
                    <>
                      {user.role !== 'indicador_nivel_1' && (
                        <Button asChild variant="ghost" className="w-full justify-start">
                          <Link href={user.role === 'promotor' ? '/promoter' : '/dashboard'} onClick={() => setIsOpen(false)}>Dashboard</Link>
                        </Button>
                      )}
                      <Button asChild variant="ghost" className="w-full justify-start">
                        <Link href="/referrals" onClick={() => setIsOpen(false)}>Minhas Indicações</Link>
                      </Button>
                      <Button asChild variant="ghost" className="w-full justify-start">
                        <Link href="/new-referral" onClick={() => setIsOpen(false)}>Nova Indicação</Link>
                      </Button>
                      {user.role !== 'metis_viewer' && user.role !== 'indicador_nivel_1' && (
                        <Button asChild variant="ghost" className="w-full justify-start">
                          <Link href="/earnings" onClick={() => setIsOpen(false)}>Meus Ganhos</Link>
                        </Button>
                      )}
                      {user.role !== 'metis_viewer' && user.role !== 'indicador_nivel_1' && (
                        <Button asChild variant="ghost" className="w-full justify-start">
                          <Link href="/withdrawals" onClick={() => setIsOpen(false)}>Saques</Link>
                        </Button>
                      )}
                      {user.role === 'admin' && (
                        <Button asChild variant="ghost" className="w-full justify-start">
                          <Link href="/admin" onClick={() => setIsOpen(false)}>Painel Admin</Link>
                        </Button>
                      )}
                      {user.role === 'gerente' && (
                        <Button asChild variant="ghost" className="w-full justify-start">
                          <Link href="/manager" onClick={() => setIsOpen(false)}>Painel Gerente</Link>
                        </Button>
                      )}
                      {user.role === 'analista' && (
                        <Button asChild variant="ghost" className="w-full justify-start">
                          <Link href="/analyst" onClick={() => setIsOpen(false)}>Painel Analista</Link>
                        </Button>
                      )}
                      {user.role === 'promotor' && (
                        <Button asChild variant="ghost" className="w-full justify-start">
                          <Link href="/team" onClick={() => setIsOpen(false)}>Minha Equipe</Link>
                        </Button>
                      )}
                      {(user.role === 'admin' || user.role === 'promotor' || (user.role === 'analista' && user.analystLevel === 3)) && (
                        <Button asChild variant="ghost" className="w-full justify-start">
                          <Link href="/referral-links" onClick={() => setIsOpen(false)}>Links de Referência</Link>
                        </Button>
                      )}
                      <div className="border-t border-gray-200 mt-2 pt-2">
                        <Button variant="ghost" className="w-full justify-start text-destructive" onClick={() => { handleLogout(); setIsOpen(false); }}>
                          <LogOut className="mr-2 h-4 w-4" />
                          Sair
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button asChild variant="ghost" className="w-full justify-start">
                        <Link href="/auth" onClick={() => setIsOpen(false)}>Entrar</Link>
                      </Button>
                      <Button asChild className="w-full">
                        <Link href="/auth" onClick={() => setIsOpen(false)}>Cadastre-se</Link>
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <>
              <nav className="hidden md:flex space-x-10">
                <Link href="/#como-funciona" className={`text-base font-medium ${isActive("/#como-funciona")} hover:text-gray-900`} onClick={(e) => {
                  if (location === '/') {
                    e.preventDefault();
                    document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}>
                  Como Funciona
                </Link>
                <Link href="/#vantagens" className={`text-base font-medium ${isActive("/#vantagens")} hover:text-gray-900`} onClick={(e) => {
                  if (location === '/') {
                    e.preventDefault();
                    document.getElementById('vantagens')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}>
                  Vantagens
                </Link>

                <Link href="/#faq" className={`text-base font-medium ${isActive("/#faq")} hover:text-gray-900`} onClick={(e) => {
                  if (location === '/') {
                    e.preventDefault();
                    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}>
                  Perguntas Frequentes
                </Link>
                
                {user && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="px-0">
                        Minha Conta
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {user.role !== 'indicador_nivel_1' && (
                        <Link href={user.role === 'promotor' ? '/promoter' : '/dashboard'}>
                          <DropdownMenuItem>Dashboard</DropdownMenuItem>
                        </Link>
                      )}
                      <Link href="/referrals">
                        <DropdownMenuItem>Minhas Indicações</DropdownMenuItem>
                      </Link>
                      {user.role !== 'metis_viewer' && (
                        <Link href="/new-referral">
                          <DropdownMenuItem>Nova Indicação</DropdownMenuItem>
                        </Link>
                      )}
                      {user.role !== 'metis_viewer' && user.role !== 'indicador_nivel_1' && (
                        <Link href="/earnings">
                          <DropdownMenuItem>Meus Ganhos</DropdownMenuItem>
                        </Link>
                      )}
                      {user.role !== 'metis_viewer' && user.role !== 'indicador_nivel_1' && (
                        <Link href="/withdrawals">
                          <DropdownMenuItem>Saques</DropdownMenuItem>
                        </Link>
                      )}
                      {user.role === 'admin' && (
                        <Link href="/admin">
                          <DropdownMenuItem>Painel Admin</DropdownMenuItem>
                        </Link>
                      )}
                      {user.role === 'gerente' && (
                        <Link href="/manager">
                          <DropdownMenuItem>Painel Gerente</DropdownMenuItem>
                        </Link>
                      )}
                      {user.role === 'analista' && (
                        <Link href="/analyst">
                          <DropdownMenuItem>Painel Analista</DropdownMenuItem>
                        </Link>
                      )}
                      {user.role === 'promotor' && (
                        <Link href="/team">
                          <DropdownMenuItem>Minha Equipe</DropdownMenuItem>
                        </Link>
                      )}
                      {(user.role === 'admin' || user.role === 'promotor' || (user.role === 'analista' && user.analystLevel === 3)) && (
                        <Link href="/referral-links">
                          <DropdownMenuItem>Links de Referência</DropdownMenuItem>
                        </Link>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sair
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </nav>

              <div className="hidden md:flex items-center justify-end md:flex-1 lg:w-0">
                {user ? (
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-700 mr-2">Olá, {user.fullName.split(' ')[0]}</span>
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-800 font-bold">
                      {getUserInitials()}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <Button asChild variant="ghost" className="text-base font-medium text-gray-600 hover:text-gray-900">
                      <Link href="/auth">Entrar</Link>
                    </Button>
                    <Button asChild>
                      <Link href="/auth">Cadastre-se</Link>
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
