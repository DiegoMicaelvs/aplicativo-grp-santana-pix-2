import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PrivacyPolicyDialogProps {
  children: React.ReactNode;
  title?: string;
}

export function PrivacyPolicyDialog({ children, title = "Termo de Consentimento e Política de Privacidade" }: PrivacyPolicyDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Programa "Indique e Ganhe" — Valida
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full pr-4">
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold">
                Valida, pessoa jurídica de direito privado, com sede em território nacional, doravante denominada "VALIDA", apresenta os termos abaixo para a participação no programa de incentivo denominado "Indique e Ganhe", disponibilizado por meio de seu aplicativo oficial.
              </p>
              <p className="mt-2">
                Ao realizar o cadastro no aplicativo e clicar na opção "Li e aceito os termos", o usuário declara ter lido, compreendido e aceitado integralmente este Termo, aderindo voluntariamente ao programa.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-base">1. DO OBJETIVO</h3>
              <p>1.1. O programa "Indique e Ganhe" tem como finalidade incentivar a divulgação e o crescimento da base de usuários da plataforma do VALIDA, mediante bonificação por indicações válidas realizadas por usuários cadastrados.</p>
            </div>

            <div>
              <h3 className="font-semibold text-base">2. DA PARTICIPAÇÃO E INDICAÇÃO</h3>
              <p>2.1. Qualquer usuário cadastrado no aplicativo poderá indicar novos participantes, mediante inserção dos dados do indicado dentro do próprio aplicativo.</p>
              <p className="mt-2">2.2. Será considerada indicação válida aquela em que:</p>
              <div className="ml-4 mt-1">
                <p>i. O indicado realize o cadastro completo e individual na plataforma,</p>
                <p>ii. Não possua registro anterior no sistema, e</p>
                <p>iii. Passe com sucesso pela validação automatizada, cujo objetivo é verificar a autenticidade do cadastro.</p>
              </div>
              <p className="mt-2">2.3. O VALIDA reserva-se o direito de recusar cadastros ou desconsiderar indicações em caso de suspeita de fraude, duplicidade, inconsistência de dados ou qualquer outra irregularidade identificada durante a validação.</p>
              <p className="mt-2">2.4. O valor de R$ 3,00 (três reais) será atribuído ao usuário por cada indicação válida, de acordo com as regras descritas neste termo.</p>
            </div>

            <div>
              <h3 className="font-semibold text-base">3. DOS PAGAMENTOS</h3>
              <p>3.1. Os pagamentos das bonificações ocorrerão duas vezes ao mês, nas seguintes datas fixas: 10 e 20 de cada mês.</p>
              <p className="mt-2">3.2. As indicações validadas até 5 (cinco) dias corridos antes da data de pagamento serão processadas para a data mais próxima.</p>
              <p className="mt-2">3.3. Validações concluídas após esse prazo serão automaticamente programadas para a data de pagamento subsequente.</p>
              <p className="mt-2">3.4. Os valores serão pagos exclusivamente por meio dos dados bancários ou contas cadastradas e validadas pelo próprio usuário no aplicativo. O VALIDA não se responsabiliza por erros de informação ou por dados incompletos/inválidos fornecidos pelo participante.</p>
              <p className="mt-2">3.5. Além da bonificação de R$ 3,00 por cada indicação válida, o usuário também fará jus ao recebimento adicional de R$ 50,00 (cinquenta reais) por cada pessoa indicada que, após validação, venha a contratar a proteção veicular ofertada pelo VALIDA por meio do programa de indicação.</p>
              <p className="mt-2">3.6. O pagamento do valor adicional mencionado no item 3.5 ocorrerá dentro das mesmas datas e prazos estipulados nesta cláusula, condicionando-se à confirmação da contratação efetiva e ativa da proteção veicular pelo indicado, conforme apuração da equipe responsável.</p>
            </div>

            <div>
              <h3 className="font-semibold text-base">4. DA POLÍTICA DE PRIVACIDADE E TRATAMENTO DE DADOS (LGPD)</h3>
              <p>4.1. O VALIDA realiza o tratamento de dados pessoais dos participantes do programa em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados – LGPD).</p>
              <p className="mt-2">4.2. Ao aceitar este termo, o usuário consente expressamente com a coleta, uso, armazenamento, tratamento e compartilhamento de seus dados pessoais, exclusivamente para as seguintes finalidades:</p>
              <div className="ml-4 mt-1">
                <p>i. Identificação e autenticação no aplicativo,</p>
                <p>ii. Controle de indicações e validações,</p>
                <p>iii. Processamento de pagamentos, e</p>
                <p>iv. Cumprimento de obrigações legais e regulatórias.</p>
              </div>
              <p className="mt-2">4.3. O VALIDA poderá compartilhar dados com terceiros estritamente necessários à execução do programa, como processadores de pagamento, serviços antifraude e empresas de tecnologia contratadas.</p>
              <p className="mt-2">4.4. A segurança dos dados é tratada com rigor, sendo adotadas práticas de segurança da informação e criptografia para proteger o sigilo e integridade dos dados armazenados.</p>
              <p className="mt-2">4.5. O usuário poderá, a qualquer momento, solicitar:</p>
              <div className="ml-4 mt-1">
                <p>i. Acesso às informações pessoais tratadas,</p>
                <p>ii. Correção de dados incorretos,</p>
                <p>iii. Revogação do consentimento (com efeitos sobre a participação no programa), e</p>
                <p>iv. Exclusão dos dados (desde que não inviabilize a execução de obrigações legais ou contratuais pendentes).</p>
              </div>
              <p className="mt-2">4.5.1. Para solicitação de exclusão, o canal de contato disponível é: privacidade@leadflow.com.br (ou outro meio oficial indicado no aplicativo).</p>
            </div>

            <div>
              <h3 className="font-semibold text-base">5. DO CONSENTIMENTO E ACEITE ELETRÔNICO</h3>
              <p>5.1. O presente termo será considerado aceito eletronicamente quando o usuário clicar na opção "Li e aceito os termos" no momento de seu cadastro ou ao aderir ao programa via aplicativo.</p>
              <p className="mt-2">5.2. O aceite eletrônico tem a mesma validade jurídica de uma assinatura física, conforme legislação aplicável.</p>
            </div>

            <div>
              <h3 className="font-semibold text-base">6. DISPOSIÇÕES GERAIS</h3>
              <p>6.1. O VALIDA poderá, a seu critério, alterar os termos deste programa a qualquer tempo, mediante aviso prévio no aplicativo.</p>
              <p className="mt-2">6.2. A participação no programa é facultativa, sendo o usuário livre para solicitar seu desligamento a qualquer momento.</p>
              <p className="mt-2">6.3. Este termo é regido pelas leis da República Federativa do Brasil, elegendo-se o foro da comarca de Ilhéus/BA como competente para dirimir eventuais controvérsias, com renúncia expressa a qualquer outro.</p>
            </div>

            <div className="border-t pt-4">
              <p className="font-semibold">Valida — Grupo Santana</p>
              <p>CNPJ: 28.254.849/0001-00</p>
              <p>Urucuca/BA</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}