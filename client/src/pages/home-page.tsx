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
                  <span className="block text-primary">Indique e Ganhe</span>
                  <span className="block">Com o Grupo Santana</span>
                </h1>
                <p className="mt-3 text-base text-gray-600 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Indique pessoas com veículos sem seguro e ganhe <span className="font-semibold text-primary-700">R$3,00 por cada indicação validada</span>, mesmo que não fechem contrato! Ao indicar 3 pessoas, ganhe um <span className="font-semibold text-primary-700">bônus de R$10,00</span>.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Link href={user ? "/new-referral" : "/auth"}>
                      <Button size="lg" className="w-full">
                        Comece a Ganhar
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full text-primary-700 bg-primary-100 hover:bg-primary-200 border-primary-100"
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
            className="h-56 w-full object-cover sm:h-72 md:h-96 lg:w-full lg:h-full"
            src="https://images.unsplash.com/photo-1560472355-536de3962603?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80"
            alt="Pessoas felizes com seu seguro"
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
              Três passos simples para começar a ganhar
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 lg:mx-auto">
              O processo é rápido e descomplicado. Você pode começar a indicar e ganhar hoje mesmo!
            </p>
          </div>

          <div className="mt-10">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                    <span className="text-xl font-bold">1</span>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Cadastre-se</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  Faça seu cadastro gratuito como indicador. É rápido e você só precisa ter mais de 18 anos e informar seus dados básicos.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                    <span className="text-xl font-bold">2</span>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Indique pessoas</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  Indique amigos, familiares ou conhecidos que possuam veículos sem seguro. Você só precisa dos dados básicos deles e do veículo.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                    <span className="text-xl font-bold">3</span>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Receba sua recompensa</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  Ganhe R$3,00 por cada indicação <span className="font-semibold">validada</span> (dados corretos), mesmo que não fechem contrato. E ao indicar 3 pessoas, receba um bônus adicional de R$10,00!
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
              Por que se tornar um indicador?
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 lg:mx-auto">
              Ganhe <span className="font-semibold text-primary-700">R$3,00 por cada indicação validada</span> e um <span className="font-semibold text-primary-700">bônus de R$10,00</span> a cada 3 indicações. Basta que as informações sejam corretas!
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
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Comissões Atrativas</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Ganhe <span className="font-semibold text-primary-700">R$3,00 por cada indicação validada</span>, independente de fechamento. Ao indicar 3 pessoas válidas, receba um <span className="font-semibold text-primary-700">bônus de R$10,00</span>. Comissões extras para vendas concretizadas.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 2 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Horário Flexível</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Trabalhe no seu próprio tempo. Indique quando e onde quiser, sem compromisso de horário ou metas obrigatórias.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 3 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Credibilidade</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Você está indicando seguros do Grupo Santana, uma empresa com mais de 20 anos de mercado e excelentes avaliações.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 4 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <BarChart className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Programa de Bonificação</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Quanto mais indicações você fizer, maiores serão seus bônus. Temos um sistema de níveis com recompensas crescentes.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 5 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <HeadphonesIcon className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Suporte Constante</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Nossa equipe está sempre disponível para ajudar em qualquer dúvida. Você nunca estará sozinho nessa jornada.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 6 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-accent rounded-md p-3">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Impacto Social</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">
                      Você está ajudando pessoas a protegerem seu patrimônio e suas famílias, criando uma rede de segurança na sua comunidade.
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
            <span className="block">Pronto para começar?</span>
            <span className="block text-primary-100">Junte-se a milhares de indicadores.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <Link href={user ? "/dashboard" : "/auth"}>
                <Button size="lg" variant="default" className="bg-white text-primary-700 hover:bg-gray-100">
                  Cadastre-se agora
                </Button>
              </Link>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <Link href={user ? "/dashboard" : "/auth"}>
                <Button size="lg" variant="default" className="bg-primary-600 hover:bg-primary-500 text-black">
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
                  Quem pode se tornar um indicador?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Qualquer pessoa maior de 18 anos, com CPF válido e dados bancários próprios pode se cadastrar como indicador. Não é necessário ter experiência prévia no setor de seguros.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  Como funciona o pagamento das comissões?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Você ganha <span className="font-semibold text-primary-700">R$3,00 por cada indicação validada</span> (número existente, pessoa existente e placa correta), mesmo que a pessoa não contrate o seguro. Ao indicar 3 pessoas válidas, você recebe um <span className="font-semibold text-primary-700">bônus adicional de R$10,00</span>. Se a indicação contratar o seguro, você também recebe uma comissão adicional. Os pagamentos são realizados até o 15º dia do mês seguinte.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  Quais dados preciso para fazer uma indicação?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Você precisará do nome completo, telefone e e-mail da pessoa indicada, além de informações básicas sobre o veículo (marca, modelo, ano). Não é necessário ter informações detalhadas, nossa equipe entrará em contato com a pessoa para completar o processo.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  Existe um limite de indicações que posso fazer?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Não há limite para o número de indicações que você pode fazer. Quanto mais pessoas você indicar, maiores serão suas chances de ganhar comissões e atingir níveis mais altos no nosso programa de bonificação.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5" className="border px-4 rounded-lg">
                <AccordionTrigger className="text-lg font-medium text-gray-900">
                  Como sei se minha indicação virou cliente?
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-600">
                  Você pode acompanhar o status de todas as suas indicações em tempo real através do seu painel de controle no site ou aplicativo. Além disso, você receberá notificações por e-mail e SMS sempre que houver atualizações importantes sobre suas indicações.
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
