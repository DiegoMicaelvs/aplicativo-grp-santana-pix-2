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
      <Alert className="bg-yellow-50 border-yellow-300 my-2 py-2">
        <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
        <AlertDescription className="text-yellow-700 text-sm flex items-center">
          <span className="font-medium">Promo!</span> R$3,00 por indicação validada. <Button variant="link" className="p-0 h-auto text-yellow-900 underline text-xs ml-1" onClick={() => setShowDialog(true)}>Detalhes</Button>
        </AlertDescription>
      </Alert>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-heading">Promoção por tempo limitado!</DialogTitle>
          </DialogHeader>
          
          <div className="py-2">
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <div className="flex items-center mb-2">
                <div className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-xs mr-2">
                  PROMO
                </div>
                <p className="font-bold">R$3,00 por indicação validada</p>
              </div>
              <p className="text-xs text-yellow-700">Válido até Agosto de 2025</p>
              
              <div className="pt-2 border-t border-yellow-200 mt-2">
                <p className="text-xs text-gray-600">Após o período promocional: R$1,50 por indicação</p>
              </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mt-2 text-sm">
              <p className="text-blue-700">
                Não esqueça do bônus de R$10,00 a cada 3 indicações válidas!
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleClose} size="sm" className="w-full">Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
