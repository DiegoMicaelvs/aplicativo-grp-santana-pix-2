import { useEffect } from "react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, Globe, Instagram, Facebook } from "lucide-react";

export default function ContatoPage() {
  useEffect(() => {
    // Update page title and meta description for SEO
    document.title = "Contato - Metis da Pix | Fale Conosco";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Entre em contato com a Metis da Pix. Tire suas dúvidas sobre nosso programa de indicação. E-mail, telefone e endereço.');
    }
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', 'Contato - Metis da Pix | Fale Conosco');
    }
    
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', 'Entre em contato com a Metis da Pix. Tire suas dúvidas sobre nosso programa de indicação.');
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
                href="mailto:contato@metisbrasil.com.br"
                className="text-yellow-600 hover:text-yellow-700 font-medium break-all"
              >
                contato@metisbrasil.com.br
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
                href="https://metisbrasil.com.br/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-yellow-600 hover:text-yellow-700 font-medium"
              >
                metisbrasil.com.br
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
                <strong>(31) 3514-6533</strong><br />
                <strong>(31) 9 9824-1928</strong>
              </p>
              <p className="text-sm text-gray-500">
                Segunda a Sexta: 08:00 às 18:00<br />
                Sábado e Domingo: Fechado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-lg">Assistência 24h</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-2">
                <strong>0800 400 3013</strong><br />
                <strong>0800 941 8282</strong>
              </p>
              <p className="text-sm text-gray-500">
                Atendimento emergencial 24 horas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-lg">Escritório</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600">
                <strong>Métis Brasil</strong><br />
                Av. Otacílio Negrão de Lima, 800<br />
                São Luiz, Belo Horizonte - MG<br />
                CEP: 30.270-802
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            Redes Sociais
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center p-4 bg-blue-50 rounded-lg">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                <Facebook className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Facebook</h3>
                <a 
                  href="https://www.facebook.com/metisbrasil" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  @metisbrasil
                </a>
              </div>
            </div>

            <div className="flex items-center p-4 bg-pink-50 rounded-lg">
              <div className="w-12 h-12 bg-pink-500 rounded-lg flex items-center justify-center mr-4">
                <Instagram className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Instagram</h3>
                <a 
                  href="https://www.instagram.com/metisbrasil/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:text-pink-700"
                >
                  @metisbrasil
                </a>
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

        <div className="bg-blue-50 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
            Contatos de Emergência - Metis Brasil
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-center">
            <div>
              <h4 className="font-medium text-gray-800">Guincho e Emergência</h4>
              <p className="text-blue-600 font-semibold">0800 841 4900</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800">Abertura de Eventos</h4>
              <p className="text-blue-600 font-semibold">0800 944 3000</p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}