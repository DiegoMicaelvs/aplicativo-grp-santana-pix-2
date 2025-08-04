import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCPF(value: string): string {
  // Remove tudo que não for número
  const numbers = value.replace(/\D/g, "");
  
  // Limita a 11 dígitos
  const truncated = numbers.slice(0, 11);
  
  // Aplica a máscara
  if (truncated.length <= 3) {
    return truncated;
  } else if (truncated.length <= 6) {
    return truncated.replace(/(\d{3})(\d{1,})/, "$1.$2");
  } else if (truncated.length <= 9) {
    return truncated.replace(/(\d{3})(\d{3})(\d{1,})/, "$1.$2.$3");
  } else {
    return truncated.replace(/(\d{3})(\d{3})(\d{3})(\d{1,})/, "$1.$2.$3-$4");
  }
}
