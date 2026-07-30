# Testes

```bash
npm test
```

248 testes. Precisa do Postgres do Docker no ar (`docker compose up -d db`).

| Comando | O que roda |
| --- | --- |
| `npm test` | tudo |
| `npm run test:unit` | só os unitários (não precisam de banco) |
| `npm run test:watch` | modo interativo |

## Por que existe banco de verdade aqui

Os testes de integração rodam contra um Postgres real, num banco separado
(`kongpix_test`), recriado do zero a cada execução.

O que estamos verificando é justamente comportamento **transacional**: `UPDATE`
condicional com guarda de estado, advisory lock, índice único parcial, débito
atômico. Nada disso apareceria com banco mockado — o mock confirmaria a nossa
suposição errada em vez de testar o banco.

O banco de teste é criado pelo **mesmo caminho documentado** em
`docs/RODAR-LOCAL.md` (002 → `db:push` → 001), então a suíte também verifica
que o procedimento de setup funciona.

## O que está coberto

### Unitários — `tests/unit/`

**`rateio.test.ts`** — a matemática do rateio. Além dos casos normais, 180
combinações de pool × take × alocação verificando duas invariantes que valem
para qualquer entrada:

1. nenhuma parcela negativa (parcela negativa vira débito no saldo de quem não
   devia nada);
2. a soma das três parcelas é exatamente o pool (nem centavo criado, nem
   centavo sumido).

**`pix.test.ts`** — titularidade da chave PIX no saque. Inclui o caso do
celular com DDI: o cadastro guarda `11988888888` e a chave PIX vem
`+5511988888888`. Sem normalizar, todo saque por celular cairia em retenção.

### Integração — `tests/integration/`

**`comissao.test.ts`** — crédito nas transições de status. Cobre os dois bugs
reais de cálculo: `converted` aplicado duas vezes debitando R$3 do indicador, e
`pending → converted` direto pagando R$50 em vez de R$53. Mais estorno na
reversão e validações simultâneas creditando uma vez só.

**`saque.test.ts`** — o double-spend. Dez pedidos paralelos somando R$155
contra saldo de R$100; a invariante verificada é `sacado + restante = inicial`.
Também: rejeição dupla não devolvendo o valor duas vezes, e pagamento
concorrente não lançando duas saídas no caixa.

**`antifraude.test.ts`** — bloqueio acima de 10 indicações falsas. Verifica o
limiar exato (ativo na 10ª, bloqueado na 11ª), que não vaza para colegas de
equipe nem para o promotor, e que indicações validadas não contam.

**`rate-limit.test.ts`** — contadores no Postgres. Inclui 50 incrementos
simultâneos na mesma chave conferindo que nenhum se perde, e o `zerar()` que
antes apagava zero linhas sem dar erro.

## O que NÃO está coberto

Sendo explícito para ninguém confiar demais:

- **Camada HTTP**: os testes chamam `storage` direto. Autorização de rota,
  middlewares e formato de resposta não passam por aqui — foram verificados
  manualmente por requisição.
- **Client React**: nenhum teste de componente.
- **WebSocket**: a autenticação do handshake foi verificada à mão.
- **Achados médios e baixos** de `docs/AUDITORIA-ESCALA.md`.

## Escrevendo teste novo

Comece do banco limpo e monte o próprio cenário — nada de depender de seed
compartilhado, que faz um teste quebrar por causa de outro:

```ts
import { limpar, criarEmpresa, criarUsuario, criarIndicacao, saldoDe } from "../helpers/fixtures";

beforeEach(async () => {
  await limpar();
});
```

Em teste de concorrência, prefira afirmar a **invariante** ("o total pago é
exatamente uma comissão") em vez do mecanismo ("N chamadas receberam erro de
conflito"). Quantas colisões o agendador provoca muda entre execuções; o
dinheiro não.
