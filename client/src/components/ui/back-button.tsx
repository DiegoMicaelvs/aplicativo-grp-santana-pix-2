import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface BackButtonProps {
  to?: string;
  children?: React.ReactNode;
  className?: string;
}

export function BackButton({ to, children = "Voltar", className }: BackButtonProps) {
  const [, navigate] = useLocation();

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else {
      window.history.back();
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