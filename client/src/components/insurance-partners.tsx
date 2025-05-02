import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Lista de seguradoras parceiras com logos
const insurancePartners = [
  { name: "Porto Seguro", color: "#00a1fc" },
  { name: "Azul Seguros", color: "#0047ba" },
  { name: "Itaú", color: "#ec7000" },
  { name: "Mapfre", color: "#f01716" },
  { name: "Banco do Brasil", color: "#ffe11f" },
  { name: "Bradesco", color: "#cc092f" },
  { name: "HDI", color: "#009a4e" },
  { name: "Aliro", color: "#0077c8" },
  { name: "Liberty", color: "#142e65" },
  { name: "Tokio Marine", color: "#008c6e" },
  { name: "Allianz", color: "#003781" },
  { name: "Sompo", color: "#d40000" },
  { name: "Suhai", color: "#004128" },
  { name: "Zurich", color: "#001769" },
  { name: "Lions Mutual", color: "#ff8000" },
  { name: "KONG", color: "#000000" },
  { name: "APVS Brasil", color: "#001c59" },
  { name: "BP Seguradora", color: "#0f1941" },
  { name: "GOL Plus", color: "#003366" },
];

// Lista de produtos oferecidos
const insuranceProducts = [
  { name: "Seguro Auto", description: "Proteção completa para seu veículo com coberturas personalizadas" },
  { name: "Seguro de Responsabilidade Civil", description: "Cobertura para danos causados a terceiros" },
  { name: "Assistência 24h", description: "Suporte completo para emergências com seu veículo" },
  { name: "Proteção contra Roubo e Furto", description: "Cobertura específica para casos de roubo ou furto do veículo" },
  { name: "Seguro para Vidros", description: "Proteção para vidros, faróis, lanternas e retrovisores" },
  { name: "Cobertura para Eventos Naturais", description: "Proteção contra danos causados por granizo, enchentes e outros eventos" },
  { name: "Carro Reserva", description: "Veículo substituto em caso de sinistro" },
  { name: "Proteção a Passageiros", description: "Cobertura para danos corporais aos ocupantes do veículo" },
];

export function InsurancePartnersSection() {
  return (
    <div className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 font-heading mb-4">Nossas Parceiras</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Trabalhamos com as melhores seguradoras do mercado para oferecer as melhores opções para nossos clientes
          </p>
        </div>
        
        {/* Logos das seguradoras */}
        <div className="flex flex-wrap justify-center gap-6 mb-16">
          {insurancePartners.map((partner) => (
            <div 
              key={partner.name} 
              className="flex items-center justify-center bg-white p-4 rounded-lg shadow-sm h-20 w-40"
              title={partner.name}
            >
              <span className="text-lg font-semibold" style={{ color: partner.color }}>{partner.name}</span>
            </div>
          ))}
        </div>
        
        {/* Produtos oferecidos */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-gray-900 font-heading mb-8 text-center">
            O que oferecemos para suas indicações
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {insuranceProducts.map((product) => (
              <Card key={product.name} className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600">
                    {product.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
