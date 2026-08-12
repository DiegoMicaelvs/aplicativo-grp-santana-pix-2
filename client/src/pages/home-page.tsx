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
import { ValidaLogo } from '@/components/brand/valida-logo';

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
      <div className="relative overflow-hidden bg-valida-glow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Coluna de texto */}
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                +600 indicadores ativos · 13 mil cadastros/dia
              </span>

              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl font-heading">
                Cadastrou, validou
                <span className="block text-gradient-valida">é PIX.</span>
              </h1>

              <p className="mt-5 text-lg text-muted-foreground sm:max-w-xl sm:mx-auto lg:mx-0">
                Chega de programa de indicação que só paga se a empresa vender. No Valida você{" "}
                <span className="font-semibold text-foreground">recebe por cada cadastro validado</span>
                {" "}— mesmo antes da venda acontecer. Converteu?{" "}
                <span className="font-semibold text-foreground">Ainda ganha um bônus.</span>
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-center lg:justify-start">
                <Button asChild size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/20">
                  <Link href={user ? "/new-referral" : "/auth"}>Comece a ganhar</Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => comoFuncionaRef.current?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Como funciona
                </Button>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                Cadastro 100% gratuito · Pagamento via PIX
              </p>
            </div>

            {/* Coluna visual — cartão de "lead validado", sem imagem raster */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative w-full max-w-sm">
                {/* cartão de trás */}
                <div className="absolute -right-3 -top-3 h-full w-full rounded-2xl border border-border bg-card/60" />
                {/* cartão principal */}
                <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xl">
                  <div className="flex items-center justify-between">
                    <ValidaLogo variant="mark" className="h-10 w-10" />
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
                        <path d="M20 6.5 9.5 17 4 11.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Validado
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="h-2.5 w-2/3 rounded-full bg-muted" />
                    <div className="h-2.5 w-1/2 rounded-full bg-muted" />
                  </div>

                  <div className="mt-6 rounded-xl bg-secondary p-4">
                    <p className="text-xs font-medium text-muted-foreground">Comissão liberada</p>
                    <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground font-heading">
                      + R$ 3,00
                    </p>
                    <p className="text-xs text-muted-foreground">caiu no seu PIX</p>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    Cadastro → Validação → PIX
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">PIX automático por cadastro validado</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  Você recebe por cada indicação validada. Se nosso time comercial fechar a venda, você ainda ganha um bônus extra! Os valores são definidos no momento do seu cadastro.
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
              Temos casos de pessoas que transformaram as indicações em uma renda extra expressiva em um único mês. Foco em quem tem contato com motoristas: frentistas, lava-jatos, despachantes, panfleteiros — vocês têm ouro nas mãos!
            </p>
          </div>

          <div className="mt-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Benefit 1 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-secondary rounded-md p-3">
                      <DollarSign className="h-6 w-6 text-primary" />
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
                    <div className="flex-shrink-0 bg-primary rounded-md p-3">
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
                    <div className="flex-shrink-0 bg-secondary rounded-md p-3">
                      <Users className="h-6 w-6 text-primary" />
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
                    <div className="flex-shrink-0 bg-primary rounded-md p-3">
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
                    <div className="flex-shrink-0 bg-secondary rounded-md p-3">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Flexibilidade total</h3>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-base text-gray-600">Trabalhe nas horas vagas, nas ruas ou onde quiser.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefit 6 */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-primary rounded-md p-3">
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
      <div className="bg-primary">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl font-heading">
            <span className="block">Pronto para começar?</span>
            <span className="block text-secondary">Junte-se a mais de 600 indicadores ativos.</span>
          </h2>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 lg:mt-0 lg:flex-shrink-0">
            <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto whitespace-nowrap">
              <Link href={user ? "/dashboard" : "/auth"}>Cadastre-se agora</Link>
            </Button>
            <Button asChild size="lg" variant="default" className="w-full sm:w-auto whitespace-nowrap">
              <Link href={user ? "/dashboard" : "/auth"}>{user ? "Acessar Dashboard" : "Já sou indicador"}</Link>
            </Button>
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
                  O sistema possui um limite diário de cadastros por usuário. Quanto mais indicações válidas você fizer, maior a sua renda. Os detalhes sobre limites e valores são apresentados após o seu cadastro como indicador.
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
