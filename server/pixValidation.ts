/**
 * Validação de titularidade da chave PIX no saque.
 *
 * Regra de negócio: o indicador só saca para uma chave que corresponda aos
 * próprios dados cadastrados — CPF, celular ou e-mail. Chave aleatória não é
 * aceita, porque não há como provar titularidade a partir dela.
 *
 * Quando a chave não corresponde, o saque não é recusado: ele fica RETIDO
 * aguardando intermediação do financeiro (o dinheiro já saiu do disponível).
 */

export type PixKeyKind = "cpf" | "telefone" | "email" | "aleatoria";

export interface PixKeyOwnershipCheck {
  kind: PixKeyKind;
  matchesOwner: boolean;
  /** Motivo legível, usado na nota do saque retido e na resposta da API. */
  reason: string;
}

export interface PixKeyOwner {
  cpf: string;
  phone: string | null;
  email: string | null;
  username: string | null;
}

const onlyDigits = (value: string): string => value.replace(/\D/g, "");

/**
 * Telefone como chave PIX costuma vir com DDI (+5511999999999), enquanto o
 * cadastro guarda só DDD + número (11999999999). Normalizamos os dois lados.
 */
function normalizePhone(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function checkPixKeyOwnership(
  pixKey: string,
  owner: PixKeyOwner,
): PixKeyOwnershipCheck {
  const key = pixKey.trim();

  if (!key) {
    return {
      kind: "aleatoria",
      matchesOwner: false,
      reason: "Chave PIX vazia.",
    };
  }

  // --- e-mail ---
  if (key.includes("@")) {
    const normalized = normalizeEmail(key);
    const ownerEmails = [owner.email, owner.username]
      .filter((v): v is string => !!v)
      .map(normalizeEmail);

    return {
      kind: "email",
      matchesOwner: ownerEmails.includes(normalized),
      reason: ownerEmails.includes(normalized)
        ? "E-mail confere com o cadastro."
        : "E-mail informado não é o do cadastro.",
    };
  }

  const digits = onlyDigits(key);

  // Chave sem dígitos suficientes ou com caracteres não numéricos residuais
  // (UUID de chave aleatória cai aqui) não é aceita.
  const isNumericKey = digits.length > 0 && onlyDigits(key).length === key.replace(/[\s.\-+()]/g, "").length;

  if (!isNumericKey) {
    return {
      kind: "aleatoria",
      matchesOwner: false,
      reason: "Chave aleatória não é aceita: use CPF, celular ou e-mail do cadastro.",
    };
  }

  // --- CPF ---
  const ownerCpf = onlyDigits(owner.cpf ?? "");
  if (digits.length === 11 && ownerCpf && digits === ownerCpf) {
    return {
      kind: "cpf",
      matchesOwner: true,
      reason: "CPF confere com o cadastro.",
    };
  }

  // --- celular ---
  const ownerPhone = owner.phone ? normalizePhone(owner.phone) : "";
  const keyPhone = normalizePhone(key);
  if (ownerPhone && keyPhone && keyPhone === ownerPhone) {
    return {
      kind: "telefone",
      matchesOwner: true,
      reason: "Celular confere com o cadastro.",
    };
  }

  // Numérica, mas não bate com CPF nem com celular do titular.
  return {
    kind: digits.length === 11 ? "cpf" : "telefone",
    matchesOwner: false,
    reason:
      "A chave PIX informada não corresponde ao CPF nem ao celular do cadastro.",
  };
}
