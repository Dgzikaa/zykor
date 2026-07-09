/**
 * Parser mínimo de BR Code (PIX "copia e cola" / EMV TLV).
 *
 * Extrai só o que ajuda a pré-preencher o pedido: nome do recebedor (campo 59),
 * cidade (60) e valor (54, quando presente). QR dinâmico (ex.: Meta Ads via Adyen)
 * NÃO traz valor — o campo 54 vem ausente e o valor é digitado à mão.
 *
 * Não valida CRC nem paga nada — é só leitura pra UX.
 */
export interface PixEmvInfo {
  valido: boolean;
  dinamico: boolean;        // Point of Initiation Method = 12 → dinâmico (sem valor fixo)
  nomeRecebedor?: string;
  cidade?: string;
  valor?: number;           // só quando o código traz valor fixo (estático)
}

/** Lê os campos TLV de nível superior (id 2 chars, len 2 chars, value). */
function parseTLV(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (!Number.isFinite(len)) break;
    const value = payload.slice(i + 4, i + 4 + len);
    out[id] = value;
    i += 4 + len;
  }
  return out;
}

export function parsePixCopiaCola(codigo: string): PixEmvInfo {
  const s = (codigo || '').trim().replace(/\s+/g, '');
  // Todo BR Code começa com "000201" (Payload Format Indicator = 01).
  if (!s.startsWith('000201') || s.length < 20) return { valido: false, dinamico: false };

  const t = parseTLV(s);
  const nome = t['59']?.trim() || undefined;
  const cidade = t['60']?.trim() || undefined;
  const valorRaw = t['54'];
  const valor = valorRaw ? Number(valorRaw) : undefined;
  // 01 = Point of Initiation Method: "12" = dinâmico, "11" = estático (sem esse campo = estático).
  const dinamico = t['01'] === '12';

  return {
    valido: true,
    dinamico,
    nomeRecebedor: nome,
    cidade,
    valor: Number.isFinite(valor) && (valor as number) > 0 ? valor : undefined,
  };
}
