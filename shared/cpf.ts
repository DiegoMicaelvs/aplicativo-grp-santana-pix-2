/**
 * Validação e normalização de CPF.
 *
 * Dois problemas que isto resolve:
 *
 * 1. O cadastro aceitava qualquer sequência de 11 dígitos. "00000000000" e
 *    "12345678901" entravam normalmente — e o CPF é justamente a chave que
 *    amarra o indicador ao PIX do saque.
 *
 * 2. O CPF era gravado como veio. "123.456.789-09" e "12345678909" são a MESMA
 *    pessoa, mas viram duas linhas distintas: a UNIQUE do banco não impede, e
 *    a mesma pessoa passa a ter duas contas indicando.
 */

/** Remove tudo que não for dígito. É esta forma que vai para o banco. */
export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Confere os dois dígitos verificadores.
 * Rejeita também os repetidos (000..., 111...), que passam no cálculo mas não
 * são CPFs válidos.
 */
export function cpfEhValido(valor: string): boolean {
  const cpf = normalizarCpf(valor);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitoVerificador = (ateOndeContar: number): number => {
    let soma = 0;
    let peso = ateOndeContar + 1;

    for (let i = 0; i < ateOndeContar; i++) {
      soma += Number(cpf[i]) * peso;
      peso--;
    }

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digitoVerificador(9) === Number(cpf[9]) && digitoVerificador(10) === Number(cpf[10]);
}

/** Só dígitos, útil para telefone pelo mesmo motivo do CPF. */
export function normalizarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  // Chega tanto "+5511988887777" quanto "11988887777"; guardamos sem o DDI.
  return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

/** Placa em caixa alta e sem separadores: ABC-1D23 e abc1d23 são a mesma. */
export function normalizarPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
