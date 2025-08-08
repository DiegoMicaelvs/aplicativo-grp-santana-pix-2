/**
 * @application Indique e Ganhe
 * @client Metis da Pix
 * @version 1.0.0
 * @signature MX25-9D7F4B2E835CAC1170-AUTHCODE-PROTECTED
 * @copyright Todas as funcionalidades e o código-fonte desta aplicação são
 * propriedade exclusiva da Metis da Pix e estão protegidos por leis de
 * propriedade intelectual. Qualquer reprodução, modificação ou uso não
 * autorizado deste software constitui violação dos direitos autorais.
 * @date Maio 2025
 */

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "@/hooks/use-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
);
