import { cn } from "@/lib/utils";

/**
 * Marca do Valida.
 *
 * Wordmark em SVG (não depende de imagem raster): um selo com checkmark —
 * o verbo da marca é "validar" — seguido do nome "Valida".
 *
 * `variant="mark"` mostra só o selo (favicon, avatares, telas compactas).
 * As cores vêm das variáveis de tema, então acompanham claro/escuro sozinhas.
 */

interface ValidaLogoProps {
  className?: string;
  variant?: "full" | "mark";
  /** Cor do texto: por padrão herda `currentColor`; o selo é sempre verde. */
  wordClassName?: string;
}

function Selo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[62%] w-[62%]">
        <path
          d="M20 6.5 9.5 17 4 11.5"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function ValidaLogo({ className, variant = "full", wordClassName }: ValidaLogoProps) {
  if (variant === "mark") {
    return <Selo className={cn("h-9 w-9", className)} />;
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Selo className="h-9 w-9" />
      <span
        className={cn(
          "font-heading text-2xl font-extrabold tracking-tight text-foreground",
          wordClassName,
        )}
      >
        Valida
      </span>
    </span>
  );
}

export default ValidaLogo;
