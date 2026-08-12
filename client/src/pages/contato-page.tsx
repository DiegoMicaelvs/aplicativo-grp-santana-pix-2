import { useEffect } from "react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, Globe, Instagram, Facebook } from "lucide-react";

export default function ContatoPage() {
  useEffect(() => {
    // Update page title and meta description for SEO
    document.title = "Contato - Valida | Fale Conosco";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Entre em contato com o Valida. Tire suas dúvidas sobre nosso programa de indicação. E-mail, telefone e endereço.');
    }
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', 'Contato - Valida | Fale Conosco');
    }
    
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', 'Entre em contato com o Valida. Tire suas dúvidas sobre nosso programa de indicação.');
    }
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Entre em Contato
          </h1>
          <p className="text-xl text-gray-600">
            Estamos aqui para ajudar! Entre em contato conosco através dos canais abaixo.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-yellow-600" />
              </div>
              <CardTitle className="text-lg">E-mail</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                Para dúvidas sobre privacidade e termos
              </p>
              <a 
                href="mailto:contato@grpsantana.com.br"
                className="text-yellow-600 hover:text-yellow-700 font-medium break-all"
              >
                contato@grpsantana.com.br
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-yellow-600" />
              </div>
              <CardTitle className="text-lg">Site Oficial</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                Visite nosso site principal
              </p>
              <a 
                href="https://grpsantana.com.br/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-yellow-600 hover:text-yellow-700 font-medium"
              >
                grpsantana.com.br
              </a>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-yellow-600" />
              </div>
              <CardTitle className="text-lg">Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-2">
                <strong>+55 73 9841-4132</strong>
              </p>
              <p className="text-sm text-gray-500">
                Segunda a Sexta: 08:00 às 18:00<br />
                Sábado e Domingo: Fechado
              </p>
            </CardContent>
          </Card>

        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            Redes Sociais
          </h2>
          <div className="flex justify-center">
            <div className="flex items-center p-4 bg-pink-50 rounded-lg max-w-sm w-full">
              <div className="w-12 h-12 bg-pink-500 rounded-lg flex items-center justify-center mr-4">
                <Instagram className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Instagram</h3>
                <a 
                  href="https://www.instagram.com/grpsantana/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:text-pink-700"
                >@grpsantana</a>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            Suporte Técnico
          </h2>
          <div className="text-center">
            <p className="text-gray-600 mb-6">
              Para problemas técnicos com a plataforma ou dúvidas sobre indicações, 
              use o botão de suporte no canto inferior direito da tela.
            </p>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-left">
              <p className="text-sm text-gray-700">
                <strong>Dica:</strong> O botão de suporte permite que você envie 
                mensagens diretamente para nossa equipe técnica, incluindo capturas 
                de tela e arquivos se necessário.
              </p>
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}