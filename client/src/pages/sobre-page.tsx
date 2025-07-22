import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
            Sobre o Kong Pix
          </h1>
          
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Quem Somos
              </h2>
              <p className="text-gray-600 leading-relaxed">
                O Kong Pix é um programa de indicação inovador que conecta pessoas 
                que possuem veículos sem proteção veicular com nossa rede de proteção. 
                Nosso objetivo é democratizar o acesso à proteção veicular através de 
                um sistema de indicações que beneficia todos os envolvidos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Nossa Missão
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Facilitar o acesso à proteção veicular através de um programa de 
                indicações transparente e lucrativo, conectando proprietários de 
                veículos com soluções de proteção adequadas às suas necessidades.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Como Funciona
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    1. Cadastre-se
                  </h3>
                  <p className="text-gray-600">
                    Faça seu cadastro gratuito em nossa plataforma e torne-se 
                    um indicador oficial.
                  </p>
                </div>
                
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    2. Indique
                  </h3>
                  <p className="text-gray-600">
                    Encontre pessoas com veículos sem proteção e faça a indicação 
                    através da nossa plataforma.
                  </p>
                </div>
                
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    3. Validação
                  </h3>
                  <p className="text-gray-600">
                    Nossa equipe entra em contato e valida a indicação com o 
                    proprietário do veículo.
                  </p>
                </div>
                
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    4. Receba
                  </h3>
                  <p className="text-gray-600">
                    Receba sua comissão via PIX imediatamente após a validação 
                    da indicação.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Nossos Valores
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Transparência
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Processo claro e transparente em todas as etapas
                  </p>
                </div>
                
                <div className="text-center">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Agilidade
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Pagamentos rápidos e processamento eficiente
                  </p>
                </div>
                
                <div className="text-center">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Confiabilidade
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Parceiro confiável para sua renda extra
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Contato
              </h2>
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="text-gray-600">
                  <strong>Site Oficial:</strong> 
                  <a href="https://www.kongprotecaoveicular.com.br/" 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="text-yellow-600 hover:text-yellow-700 ml-2">
                    www.kongprotecaoveicular.com.br
                  </a>
                </p>
                <p className="text-gray-600 mt-2">
                  <strong>Instagram:</strong> 
                  <a href="https://www.instagram.com/kongprotecao/" 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="text-yellow-600 hover:text-yellow-700 ml-2">
                    @kongprotecao
                  </a>
                </p>
                <p className="text-gray-600 mt-2">
                  <strong>Facebook:</strong> 
                  <a href="https://www.facebook.com/kongprotecaoveicular" 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="text-yellow-600 hover:text-yellow-700 ml-2">
                    Kong Proteção Veicular
                  </a>
                </p>
                <p className="text-gray-600 mt-2">
                  <strong>E-mail:</strong> 
                  <a href="mailto:privacidade@kongprotecaoveicular.com.br" 
                     className="text-yellow-600 hover:text-yellow-700 ml-2">
                    privacidade@kongprotecaoveicular.com.br
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}