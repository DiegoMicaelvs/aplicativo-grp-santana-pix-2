import { Link } from "wouter";
import { PrivacyPolicyDialog } from "@/components/ui/privacy-policy-dialog";
import { Button } from "@/components/ui/button";
import { ValidaLogo } from "@/components/brand/valida-logo";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[hsl(165_25%_9%)] text-white">
      <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <ValidaLogo wordClassName="text-white" />
          <p className="text-sm text-white/60">Cadastrou, validou é PIX.</p>
        </div>
        <nav className="-mx-5 -my-2 flex flex-wrap justify-center" aria-label="Footer">
          <div className="px-5 py-2">
            <Link href="/sobre" className="text-base text-gray-300 hover:text-white">
              Sobre
            </Link>
          </div>

          <div className="px-5 py-2">
            <Link href="/#como-funciona" className="text-base text-gray-300 hover:text-white">
              Como Funciona
            </Link>
          </div>

          <div className="px-5 py-2">
            <PrivacyPolicyDialog title="Termos de Serviço">
              <Button variant="link" className="text-base text-gray-300 hover:text-white p-0 h-auto font-normal">
                Termos de Serviço
              </Button>
            </PrivacyPolicyDialog>
          </div>

          <div className="px-5 py-2">
            <PrivacyPolicyDialog title="Política de Privacidade">
              <Button variant="link" className="text-base text-gray-300 hover:text-white p-0 h-auto font-normal">
                Política de Privacidade
              </Button>
            </PrivacyPolicyDialog>
          </div>

          <div className="px-5 py-2">
            <Link href="/contato" className="text-base text-gray-300 hover:text-white">
              Contato
            </Link>
          </div>
        </nav>
        <div className="mt-8 flex justify-center space-x-6">
          <a href="https://www.instagram.com/grpsantana/?igsh=d3VyM3V2Y2twODl0" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300">
            <span className="sr-only">Instagram</span>
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
            </svg>
          </a>

          <a href="https://grpsantana.com.br/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300">
            <span className="sr-only">Site Oficial</span>
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </a>
        </div>
        <p className="mt-8 text-center text-base text-gray-400">
          &copy; {new Date().getFullYear()} Grupo Santana. Software registrado no INPI sob nº 51202500***-*. Todos os direitos reservados.
        </p>
        <p className="mt-2 text-center text-xs text-gray-500">
          <span title="Software protegido pelas Leis 9.609/98 e 9.610/98. Proibida a reprodução não autorizada.">
            INDIQUE-MX25-{new Date().getFullYear()}-9D7F4B2E835CAC1170-REG-INPI
          </span>
        </p>
      </div>
    </footer>
  );
}
