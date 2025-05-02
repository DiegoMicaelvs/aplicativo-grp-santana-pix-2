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
    return `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`;
  };
  
  const isActive = (path: string) => {
    return location === path ? "border-primary-500 text-gray-900" : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300";
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 md:justify-start md:space-x-10">
          <div className="flex justify-start lg:w-0 lg:flex-1">
            <Link href="/" className="flex items-center">
              <span className="sr-only">Indique e Ganhe</span>
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">I</div>
              <span className="text-xl font-heading font-bold text-gray-900 ml-2">Indique e Ganhe</span>
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
                  <SheetTitle className="font-heading">Indique e Ganhe</SheetTitle>
                  <SheetDescription>
                    Indique amigos com veículos sem seguro e ganhe comissões
                  </SheetDescription>
                </SheetHeader>
                <div className="py-4 flex flex-col gap-2">
                  <Link href="/como-funciona" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">Como Funciona</Button>
                  </Link>
                  <Link href="/vantagens" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">Vantagens</Button>
                  </Link>
                  <Link href="/faq" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">Perguntas Frequentes</Button>
                  </Link>
                  
                  {user ? (
                    <>
                      <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">Dashboard</Button>
                      </Link>
                      <Link href="/referrals" onClick={() => setIsOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">Minhas Indicações</Button>
                      </Link>
                      <Link href="/new-referral" onClick={() => setIsOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">Nova Indicação</Button>
                      </Link>
                      {user.role === 'admin' && (
                        <Link href="/admin" onClick={() => setIsOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start">Painel Admin</Button>
                        </Link>
                      )}
                      <div className="border-t border-gray-200 mt-2 pt-2">
                        <Button variant="ghost" className="w-full justify-start text-destructive" onClick={() => {
                          handleLogout();
                          setIsOpen(false);
                        }}>
                          <LogOut className="mr-2 h-4 w-4" />
                          Sair
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Link href="/auth" onClick={() => setIsOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">Entrar</Button>
                      </Link>
                      <Link href="/auth" onClick={() => setIsOpen(false)}>
                        <Button className="w-full">Cadastre-se</Button>
                      </Link>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <>
              <nav className="hidden md:flex space-x-10">
                <Link href="/#como-funciona" className={`text-base font-medium ${isActive("/#como-funciona")} hover:text-gray-900`}>
                  Como Funciona
                </Link>
                <Link href="/#vantagens" className={`text-base font-medium ${isActive("/#vantagens")} hover:text-gray-900`}>
                  Vantagens
                </Link>
                <Link href="/#faq" className={`text-base font-medium ${isActive("/#faq")} hover:text-gray-900`}>
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
                      <Link href="/dashboard">
                        <DropdownMenuItem>Dashboard</DropdownMenuItem>
                      </Link>
                      <Link href="/referrals">
                        <DropdownMenuItem>Minhas Indicações</DropdownMenuItem>
                      </Link>
                      <Link href="/new-referral">
                        <DropdownMenuItem>Nova Indicação</DropdownMenuItem>
                      </Link>
                      {user.role === 'admin' && (
                        <Link href="/admin">
                          <DropdownMenuItem>Painel Admin</DropdownMenuItem>
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
                    <span className="text-sm font-medium text-gray-700 mr-2">Olá, {user.firstName}</span>
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-800 font-bold">
                      {getUserInitials()}
                    </div>
                  </div>
                ) : (
                  <>
                    <Link href="/auth">
                      <Button variant="ghost" className="text-base font-medium text-gray-600 hover:text-gray-900">
                        Entrar
                      </Button>
                    </Link>
                    <Link href="/auth">
                      <Button className="ml-8">
                        Cadastre-se
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
