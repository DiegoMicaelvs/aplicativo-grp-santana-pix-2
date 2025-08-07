import { useState } from "react";
import { Search, Car, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { BackButton } from "@/components/ui/back-button";
import { useToast } from "@/hooks/use-toast";

interface PlateSearchResult {
  found: boolean;
  message: string;
  status?: string;
  createdAt?: string;
}

export default function PlateSearchPage() {
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlateSearchResult | null>(null);
  const { toast } = useToast();

  // Format plate input (XXX-0000 or XXX0X00)
  const formatPlate = (value: string) => {
    // Remove all non-alphanumeric characters
    const cleanValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Apply format based on length
    if (cleanValue.length <= 3) {
      return cleanValue;
    } else if (cleanValue.length <= 7) {
      return `${cleanValue.slice(0, 3)}-${cleanValue.slice(3)}`;
    }
    return `${cleanValue.slice(0, 3)}-${cleanValue.slice(3, 7)}`;
  };

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPlate(e.target.value);
    setPlate(formatted);
    setResult(null); // Clear previous result
  };

  const handleSearch = async () => {
    if (!plate || plate.replace(/[^A-Za-z0-9]/g, '').length < 7) {
      toast({
        title: "Placa inválida",
        description: "Por favor, insira uma placa completa (7 caracteres)",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search-plate?plate=${encodeURIComponent(plate)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao consultar placa');
      }

      setResult(data);
    } catch (error) {
      console.error('Error searching plate:', error);
      toast({
        title: "Erro na consulta",
        description: error instanceof Error ? error.message : "Erro ao consultar placa",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getStatusLabel = (status?: string) => {
    const labels: Record<string, string> = {
      'pending': 'Pendente',
      'analyzing': 'Em Análise',
      'validated': 'Validado',
      'converted': 'Convertido',
      'paid': 'Pago',
      'rejected': 'Rejeitado'
    };
    return status ? labels[status] || status : '';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="bg-gray-100 flex-grow">
        <div className="py-10">
          <header>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold leading-tight text-gray-900 font-heading">
                    Consulta de Placas
                  </h1>
                  <p className="mt-2 text-gray-600">
                    Ferramenta disponível para todos os usuários - Verifique se uma placa já está cadastrada no sistema
                  </p>
                </div>
                <BackButton to="/dashboard" />
              </div>
            </div>
          </header>
          
          <main>
            <div className="max-w-3xl mx-auto sm:px-6 lg:px-8 mt-8">
              <div className="px-4 py-8 sm:px-0">
                {/* Search Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5" />
                      Digite a Placa do Veículo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="XXX-0000 ou XXX0X00"
                          value={plate}
                          onChange={handlePlateChange}
                          onKeyPress={handleKeyPress}
                          maxLength={8}
                          className="text-lg font-mono uppercase"
                          disabled={loading}
                        />
                        <Button 
                          onClick={handleSearch}
                          disabled={loading || !plate}
                          className="min-w-[120px]"
                        >
                          {loading ? (
                            <span>Consultando...</span>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Consultar
                            </>
                          )}
                        </Button>
                      </div>
                      
                      <div className="text-sm text-gray-500">
                        * Digite a placa no formato brasileiro (padrão antigo ou Mercosul)
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Result Card */}
                {result && (
                  <Card className="mt-6">
                    <CardContent className="pt-6">
                      {result.found ? (
                        <Alert className="border-red-200 bg-red-50">
                          <XCircle className="h-5 w-5 text-red-600" />
                          <AlertDescription className="ml-2">
                            <div className="font-semibold text-red-900">
                              {result.message}
                            </div>
                            {result.status && (
                              <div className="mt-2 text-sm text-red-700">
                                <div>Status: <span className="font-medium">{getStatusLabel(result.status)}</span></div>
                                {result.createdAt && (
                                  <div>Cadastrada em: <span className="font-medium">{formatDate(result.createdAt)}</span></div>
                                )}
                              </div>
                            )}
                            <div className="mt-3 text-xs text-red-600">
                              Esta placa não pode ser cadastrada novamente.
                            </div>
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert className="border-green-200 bg-green-50">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <AlertDescription className="ml-2">
                            <div className="font-semibold text-green-900">
                              {result.message}
                            </div>
                            <div className="mt-2 text-sm text-green-700">
                              Você pode prosseguir com o cadastro desta indicação.
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Information Card */}
                <Card className="mt-6 bg-blue-50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-blue-900 mb-2">Como funciona?</h3>
                    <div className="text-sm text-blue-700 space-y-2">
                      <p>
                        • Qualquer usuário pode consultar placas de veículos
                      </p>
                      <p>
                        • Digite a placa do veículo que deseja consultar
                      </p>
                      <p>
                        • O sistema verificará se já existe uma indicação com esta placa
                      </p>
                      <p>
                        • Placas já cadastradas não podem ser indicadas novamente
                      </p>
                      <p>
                        • Use esta ferramenta antes de criar uma nova indicação
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}