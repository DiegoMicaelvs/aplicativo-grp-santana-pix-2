import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PromotionalAlert() {
  const [showDialog, setShowDialog] = useState(false);
  
  useEffect(() => {
    // Check if the user has seen the alert before
    const hasSeenPromo = localStorage.getItem('hasSeenPromoAlert');
    if (!hasSeenPromo) {
      // Show dialog after a short delay
      const timer = setTimeout(() => {
        setShowDialog(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleClose = () => {
    setShowDialog(false);
    // Store that user has seen the alert
    localStorage.setItem('hasSeenPromoAlert', 'true');
  };
  
  return (
    <>
      <Alert className="bg-yellow-50 border-yellow-300 my-4">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 font-bold">Promoção por tempo limitado!</AlertTitle>
        <AlertDescription className="text-yellow-700">
          R$3,00 por indicação validada. Oferta válida até Agosto/2025. <Button variant="link" className="p-0 h-auto text-yellow-900 underline font-medium" onClick={() => setShowDialog(true)}>Saiba mais</Button>
        </AlertDescription>
      </Alert>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading">Promoção por tempo limitado!</DialogTitle>
            <DialogDescription>
              Aproveite nossa tarifa promocional por tempo limitado
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-800 mb-2 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 text-yellow-600" />
                Ganhe mais por cada indicação!
              </h3>
              <p className="text-yellow-800 mb-3">
                Como parte de nossa campanha promocional, estamos oferecendo uma comissão especial por indicações validadas:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full text-sm mr-2">
                    PROMO
                  </div>
                  <p className="font-bold text-lg">R$3,00 por indicação validada</p>
                </div>
                <p className="text-sm text-yellow-700">Válido até Agosto de 2025</p>
                
                <div className="pt-3 border-t border-yellow-200 mt-3">
                  <p className="text-sm text-gray-600">Após o período promocional, o valor retornará para:</p>
                  <p className="font-medium mt-1">R$1,50 por indicação validada</p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-bold text-blue-800 mb-2">
                Dica do Grupo Santana:
              </h3>
              <p className="text-blue-700">
                Aproveite esse período promocional para maximizar seus ganhos! Não se esqueça do bônus adicional de R$10,00 a cada 3 indicações válidas.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleClose} className="w-full">Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
