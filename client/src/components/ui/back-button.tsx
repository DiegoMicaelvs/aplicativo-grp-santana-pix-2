import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface BackButtonProps {
  fallbackPath?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function BackButton({ 
  fallbackPath = "/admin", 
  className = "", 
  variant = "outline",
  size = "default"
}: BackButtonProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    // Try to go back in browser history
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback to a specific path if no history
      setLocation(fallbackPath);
    }
  };

  return (
    <Button
      onClick={handleBack}
      variant={variant}
      size={size}
      className={`${className}`}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Voltar
    </Button>
  );
}