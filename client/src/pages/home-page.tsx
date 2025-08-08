import { useRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import { ChevronDown, Clock, DollarSign, Shield, Users, BarChart, HeadphonesIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PromotionalAlert } from '@/components/promotional-alert';

export default function HomePage() {
  const { user } = useAuth();
  const [location] = useLocation();
  const comoFuncionaRef = useRef<HTMLDivElement>(null);
  const vantagensRef = useRef<HTMLDivElement>(null);

  const faqRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Scroll to the appropriate section based on the hash in the URL
    if (location === '/#como-funciona' && comoFuncionaRef.current) {
      comoFuncionaRef.current.scrollIntoView({ behavior: 'smooth' });
    } else if (location === '/#vantagens' && vantagensRef.current) {
      vantagensRef.current.scrollIntoView({ behavior: 'smooth' });
    } else if (location === '/#faq' && faqRef.current) {
      faqRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* Hero Section */}
      <div className="relative bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <svg
              className="hidden lg:block absolute right-0 inset-y-0 h-full w-48 text-white transform translate-x-1/2"
              fill="currentColor"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="50,0 100,0 50,100 0,100" />
            </svg>
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-bold text-gray-900 sm:text-5xl md:text-6xl font-heading">
                  <span className="block text-primary">Cadastrou, Validou é PIX!</span>
                  <span className="block">Simples assim.</span>
                </h1>
                <p className="mt-3 text-base text-gray-600 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Chega de programas de indicação que só pagam se a empresa vender! Aqui você ganha <span className="font-semibold text-primary">R$3 por cada cadastro validado</span>, mesmo que a venda ainda nem tenha acontecido. Se o nosso time converter em venda, você ainda recebe <span className="font-semibold text-primary">R$50 de bônus!</span>
                </p>
                <div className="mt-5 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:justify-center lg:justify-start">
                  <div className="flex-1 sm:flex-initial">
                    <Link href={user ? "/new-referral" : "/auth"}>
                      <Button size="lg" className="w-full whitespace-nowrap">
                        Comece a Ganhar
                      </Button>
                    </Link>
                  </div>
                  <div className="flex-1 sm:flex-initial">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full whitespace-nowrap"
                      onClick={() => comoFuncionaRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      Como Funciona
                    </Button>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <img
            className="h-56 w-full object-contain object-center sm:h-72 md:h-96 lg:w-full lg:h-full"
            src="/images/metis-brasil-hero.png"
            alt="Métis Brasil - Proteção Patrimonial"
          />
        </div>
      </div>
      {/* How It Works Section */}
      <div className="bg-white py-12" id="como-funciona" ref={comoFuncionaRef}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PromotionalAlert />
          <div className="lg:text-center">
            <h2 className="text-base text-primary font-semibold tracking-wide uppercase font-heading">Como Funciona</h2>
            <p className="mt-2 text-3xl leading-8 font-bold tracking-tight text-gray-900 sm:text-4xl font-heading">
              Você não precisa vender nada
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 lg:mx-auto">
              Só precisa indicar motoristas, preencher corretamente os dados e pronto! Somos mais de 600 indicadores ativos, com uma média de 13 mil cadastros por dia.
            </p>
          </div>

          <div className="mt-10">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                    <span className="text-xl font-bold">1</span>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Cadastre-se no site ou app</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  Basta ser maior de 18 anos. O cadastro é 100% gratuito para você.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                    <span className="text-xl font-bold">2</span>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Receba seu kit</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  Com crachá, camiseta e contrato para trabalhar com segurança e credibilidade.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                    <span className="text-xl font-bold">3</span>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Indique motoristas</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  Pelo seu link ou com apoio do nosso sistema. Validamos os dados e confirmamos se estão corretos e prontos para contato.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                    <span className="text-xl font-bold">4</span>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">PIX automático de R$3</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  Por cadastro validado. Se nosso time comercial fechar a venda, você ganha mais R$50 de bônus!
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
      {/* Benefits Section */}
      <div className="bg-gray-50 py-12" id="vantagens" ref={vantagensRef}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary font-semibold tracking-wide uppercase font-heading">Vantagens</h2>
            <p className="mt-2 text-3xl leading-8 font-bold tracking-tight text-gray-900 sm:text-4xl font-heading">
              Renda extra real e imediata
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 lg:mx-auto">
              Temos casos de pessoas que faturaram mais de R$5.000 em um único mês. Foco em quem tem contato com motoristas: frentistas, lava-jatos, despachantes, panfleteiros - vocês têm ouro nas mãos!
            </p>
          </div>

          <div className="mt-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Benefit 1 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Renda extra real e imediata</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Receba por cada cadastro validado, mesmo sem venda.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 2 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Sem experiência, sem venda, sem complicação</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Basta indicar, validar e pronto: o Pix cai!
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 3 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Kit credencial incluso</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Receba crachá, camiseta e contrato para trabalhar com segurança e credibilidade.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 4 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <HeadphonesIcon className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Apoio completo e treinamento</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Nosso time te dá todo o suporte para você se destacar.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 5 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Flexibilidade total</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Trabalhe nas horas vagas, nas ruas, em casa ou onde quiser.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 6 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <BarChart className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Foco em quem tem contato com motoristas</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Frentistas, lava-jatos, despachantes, panfleteiros: vocês têm ouro nas mãos!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      {/* Registration CTA */}
      <div className="bg-primary-700">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl font-heading">
            <span className="block text-[#0a0a0a]">Pronto para começar?</span>
            <span className="block text-[#000000]">Junte-se a mais de 600 indicadores ativos.</span>
          </h2>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 lg:mt-0 lg:flex-shrink-0">
            <div className="flex-1 sm:flex-initial">
              <Link href={user ? "/dashboard" : "/auth"}>
                <Button size="lg" variant="secondary" className="w-full sm:w-auto whitespace-nowrap">
                  Cadastre-se agora
                </Button>
              </Link>
            </div>
            <div className="flex-1 sm:flex-initial">
              <Link href={user ? "/dashboard" : "/auth"}>
                <Button size="lg" variant="default" className="w-full sm:w-auto whitespace-nowrap">
                  {user ? "Acessar Dashboard" : "Já sou indicador"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* FAQ Section */}
      <div className="bg-white py-12" id="faq" ref={faqRef}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary font-semibold tracking-wide uppercase font-heading">Perguntas Frequentes</h2>
            <p className="mt-2 text-3xl leading-8 font-bold tracking-tight text-gray-900 sm:text-4xl font-heading">
              Tire suas dúvidas
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 lg:mx-auto">
              Encontre respostas para as perguntas mais comuns sobre o programa de indicação.
            </p>
          </div>

          <div className="mt-12 max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-6">
              <AccordionItem value="item-1" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  Preciso vender algo?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Não! O seu papel é cadastrar. A venda é por nossa conta.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  Quando recebo o PIX?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Após a validação do cadastro. Os pagamentos são rápidos e transparentes.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  Quantos cadastros posso fazer por dia?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Quantos quiser! Mas com apenas 30 cadastros diários, você já garante R$1.980 por mês.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  Posso trabalhar de qualquer lugar?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Sim! Você escolhe onde e quando indicar. Ideal para quem já tem contato com motoristas.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  E se eu quiser parar?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Sem problemas! Você é livre para entrar e sair quando quiser. Aqui não tem fidelidade forçada.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-6" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  Tem algum custo para participar?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Nenhum. O programa é 100% gratuito para você.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
