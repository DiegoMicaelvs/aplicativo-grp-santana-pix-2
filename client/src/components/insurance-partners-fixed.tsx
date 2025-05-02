import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShieldCheck, Shield, CreditCard, Car, Building, Umbrella, Landmark, Wallet,
  BriefcaseBusiness, CircleDollarSign, LineChart, Lock, Map, Banknote, Layers
} from "lucide-react";

// Lista de seguradoras tradicionais parceiras
const traditionalInsurers = [
  { name: "Porto Seguro", color: "#00a1fc", icon: Building },
  { name: "Azul Seguros", color: "#0047ba", icon: Shield },
  { name: "Itaú", color: "#ec7000", icon: Wallet },
  { name: "Mapfre", color: "#f01716", icon: ShieldCheck },
  { name: "Banco do Brasil", color: "#ffe11f", icon: Landmark },
  { name: "Bradesco", color: "#cc092f", icon: BriefcaseBusiness },
  { name: "HDI", color: "#009a4e", icon: Umbrella },
  { name: "Liberty", color: "#142e65", icon: ShieldCheck },
  { name: "Tokio Marine", color: "#008c6e", icon: Building },
  { name: "Allianz", color: "#003781", icon: Lock },
  { name: "Sompo", color: "#d40000", icon: ShieldCheck },
  { name: "Suhai", color: "#004128", icon: Car },
  { name: "Zurich", color: "#001769", icon: Map },
];

// Lista de empresas de proteção patrimonial mutualistas
const mutualistCompanies = [
  { name: "Lions Mutual", color: "#ff8000", icon: CircleDollarSign },
  { name: "KONG", color: "#000000", icon: Layers },
  { name: "APVS Brasil", color: "#001c59", icon: CreditCard },
  { name: "BP Seguradora", color: "#0f1941", icon: Shield },
  { name: "GOL Plus", color: "#003366", icon: ShieldCheck },
  { name: "Aliro", color: "#0077c8", icon: Shield },
];

// Lista de produtos oferecidos
const insuranceProducts = [
  { name: "Seguro Auto", description: "Proteção completa para seu veículo com coberturas personalizadas", icon: Car },
  { name: "Seguro de Responsabilidade Civil", description: "Cobertura para danos causados a terceiros", icon: Shield },
  { name: "Assistência 24h", description: "Suporte completo para emergências com seu veículo", icon: ShieldCheck },
  { name: "Proteção contra Roubo e Furto", description: "Cobertura específica para casos de roubo ou furto do veículo", icon: Lock },
  { name: "Seguro para Vidros", description: "Proteção para vidros, faróis, lanternas e retrovisores", icon: Layers },
  { name: "Cobertura para Eventos Naturais", description: "Proteção contra danos causados por granizo, enchentes e outros eventos", icon: Umbrella },
  { name: "Carro Reserva", description: "Veículo substituto em caso de sinistro", icon: Car },
  { name: "Proteção a Passageiros", description: "Cobertura para danos corporais aos ocupantes do veículo", icon: CreditCard },
];

export function InsurancePartnersSection() {
  return (
    <div className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center mb-12">
          <h2 className="text-base text-primary font-semibold tracking-wide uppercase font-heading">Parcerias</h2>
          <p className="mt-2 text-3xl leading-8 font-bold tracking-tight text-gray-900 sm:text-4xl font-heading">
            Seguradoras Parceiras e Empresas de Proteção Patrimonial Mutualistas
          </p>
          <p className="mt-4 max-w-3xl text-xl text-gray-600 lg:mx-auto">
            Trabalhamos com as melhores seguradoras e empresas de proteção patrimonial do mercado para oferecer as opções mais vantajosas para seus indicados
          </p>
        </div>
        
        {/* Seção: Seguradoras Tradicionais */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-gray-900 font-heading mb-6 border-b pb-2">Seguradoras Tradicionais</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {traditionalInsurers.map((partner) => {
              const Icon = partner.icon;
              return (
                <div 
                  key={partner.name} 
                  className="flex flex-col items-center justify-center bg-white p-4 rounded-lg shadow hover:shadow-md transition-all duration-200 h-28"
                  title={partner.name}
                >
                  <Icon style={{ color: partner.color }} className="h-8 w-8 mb-2" />
                  <span className="text-sm font-semibold text-center" style={{ color: partner.color }}>{partner.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Seção: Empresas de Proteção Patrimonial Mutualistas */}
        <div className="mb-16">
          <h3 className="text-xl font-bold text-gray-900 font-heading mb-6 border-b pb-2">Empresas de Proteção Patrimonial Mutualistas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mutualistCompanies.map((partner) => {
              const Icon = partner.icon;
              return (
                <div 
                  key={partner.name} 
                  className="flex flex-col items-center justify-center bg-white p-4 rounded-lg shadow hover:shadow-md transition-all duration-200 h-28"
                  title={partner.name}
                >
                  <Icon style={{ color: partner.color }} className="h-8 w-8 mb-2" />
                  <span className="text-sm font-semibold text-center" style={{ color: partner.color }}>{partner.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Produtos oferecidos */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-gray-900 font-heading mb-8 text-center">
            O que oferecemos para suas indicações
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {insuranceProducts.map((product) => {
              const Icon = product.icon;
              return (
                <Card key={product.name} className="h-full hover:shadow-md transition-all duration-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center mb-2">
                      <div className="flex-shrink-0 mr-3 p-2 rounded-full bg-primary-100">
                        <Icon className="h-5 w-5 text-primary-600" />
                      </div>
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600">
                      {product.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}