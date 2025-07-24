import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface BackButtonProps {
  to?: string;
  children?: React.ReactNode;
  className?: string;
}

export function BackButton({ to, children = "Voltar ao Dashboard", className }: BackButtonProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const getDashboardRoute = () => {
    if (!user) return "/";
    
    switch (user.role) {
      case "admin":
        return "/admin";
      case "analista":
        return "/analyst";
      case "gerente":
        return "/manager";
      case "promotor":
        return "/promoter";
      case "indicador":
        return "/dashboard";
      case "vendedor":
        return "/dashboard";
      default:
        return "/dashboard";
    }
  };

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else {
      // Navigate to appropriate dashboard instead of browser back
      navigate(getDashboardRoute());
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleBack}
      className={`flex items-center gap-2 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {children}
    </Button>
  );
}