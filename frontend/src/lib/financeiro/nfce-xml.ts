// Parser + classificação de bebida fria (monofásico) das NFC-e, a partir do XML que vai pra
// contabilidade. Roda no NAVEGADOR (usa DOMParser). Cada nota tem, na mesma XML, o CNPJ do
// emitente + o NCM/CST de PIS/COFINS por item — é isso que permite separar por CNPJ de verdade
// e classificar bebida fria pelo critério fiscal correto (e não pelo chute "categoria BEBIDA/DRINK").
//
// Aqui só extraímos e AGREGAMOS; o servidor guarda os agregados e resolve o cnpj_indice.

// Monofásico (PIS/COFINS) na revenda: CST 04 (tributável monofásica), 05 (ST) e 06 (alíquota zero).
// É o conjunto que aparece nas bebidas industrializadas (cerveja 2203, refri 2202, água 2201,
// vinho 2204, energético 2202.99…). Ajustável num lugar só se a contabilidade pedir.
export const MONOFASICO_CST_COFINS = new Set(['04', '05', '06']);

export function isMonofasico(cstCofins: string | null | undefined): boolean {
  return !!cstCofins && MONOFASICO_CST_COFINS.has(cstCofins.padStart(2, '0'));
}

export type NfceItem = { ncm: string; cst_cofins: string; valor: number; monofasico: boolean };
export type NfceNota = {
  kind: 'nota';
  chave: string;        // 44 dígitos
  cnpj: string;         // 14 dígitos do emitente
  ano: number;
  mes: number;
  valor_total: number;  // vNF (ou Σ vProd)
  valor_monofasico: number;
  itens: NfceItem[];
};
export type NfceCancelamento = { kind: 'cancelamento'; chave: string };
export type NfceIgnore = { kind: 'ignore'; motivo: string };
export type ParsedNfce = NfceNota | NfceCancelamento | NfceIgnore;

/** CNPJ do emitente embutido na chave de acesso (dígitos 7–20). */
export function cnpjFromChave(chave: string): string | null {
  const d = (chave || '').replace(/\D/g, '');
  return d.length === 44 ? d.substring(6, 20) : null;
}

// helpers de DOM tolerantes a namespace/prefixo (NFe usa namespace default, sem prefixo)
function els(root: Element | Document, local: string): Element[] {
  const byNs = (root as any).getElementsByTagNameNS?.('*', local);
  if (byNs && byNs.length) return Array.from(byNs) as Element[];
  return Array.from(root.getElementsByTagName(local));
}
function firstText(root: Element | Document, local: string): string {
  const e = els(root, local)[0];
  return e ? (e.textContent || '').trim() : '';
}
function num(s: string): number {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Interpreta uma XML de NFC-e (autorizada) ou de evento (cancelamento). */
export function parseNfceXml(xml: string): ParsedNfce {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch {
    return { kind: 'ignore', motivo: 'xml inválido' };
  }
  if (doc.getElementsByTagName('parsererror').length) return { kind: 'ignore', motivo: 'xml inválido' };

  // Evento de cancelamento (procEventoNFe / tpEvento 110111)
  const tpEvento = firstText(doc, 'tpEvento');
  if (tpEvento === '110111') {
    const ch = (firstText(doc, 'chNFe') || '').replace(/\D/g, '');
    return ch.length === 44 ? { kind: 'cancelamento', chave: ch } : { kind: 'ignore', motivo: 'evento sem chave' };
  }

  const infNFe = els(doc, 'infNFe')[0];
  if (!infNFe) return { kind: 'ignore', motivo: 'sem infNFe' };

  const chave = (infNFe.getAttribute('Id') || '').replace(/\D/g, '');
  if (chave.length !== 44) return { kind: 'ignore', motivo: 'chave inválida' };

  // Nota cancelada/denegada pelo status do protocolo (cStat 101/135/151/155/301/302/303)
  const cStat = firstText(doc, 'cStat');
  if (['101', '135', '151', '155', '301', '302', '303'].includes(cStat)) {
    return { kind: 'cancelamento', chave };
  }

  const emit = els(infNFe, 'emit')[0];
  const cnpj = ((emit && firstText(emit, 'CNPJ')) || cnpjFromChave(chave) || '').replace(/\D/g, '');

  // competência: da chave (AAMM, dígitos 3-6) — robusto e igual ao que a SEFAZ usa
  const aamm = chave.substring(2, 6);
  const ano = 2000 + Number(aamm.substring(0, 2));
  const mes = Number(aamm.substring(2, 4));

  const itens: NfceItem[] = [];
  let valorMonofasico = 0;
  for (const det of els(infNFe, 'det')) {
    const prod = els(det, 'prod')[0];
    const imposto = els(det, 'imposto')[0];
    if (!prod) continue;
    const ncm = firstText(prod, 'NCM');
    const valor = num(firstText(prod, 'vProd'));
    const cofins = imposto ? els(imposto, 'COFINS')[0] : undefined;
    const cst = cofins ? (firstText(cofins, 'CST') || '').padStart(2, '0') : '';
    const mono = isMonofasico(cst);
    if (mono) valorMonofasico += valor;
    itens.push({ ncm, cst_cofins: cst, valor, monofasico: mono });
  }

  const vNF = num(firstText(doc, 'vNF'));
  const valorTotal = vNF > 0 ? vNF : itens.reduce((s, i) => s + i.valor, 0);

  return { kind: 'nota', chave, cnpj, ano, mes, valor_total: valorTotal, valor_monofasico: valorMonofasico, itens };
}

// ---- Agregação (o que o cliente envia pro servidor) ----
export type CnpjResumo = { cnpj: string; faturamento: number; valor_monofasico: number; qtd_notas: number };
export type NcmResumo = { cnpj: string; ncm: string; cst_cofins: string; monofasico: boolean; valor: number; qtd_itens: number };
export type NfceAgregado = {
  ano: number | null;
  mes: number | null;
  qtd_notas: number;
  qtd_canceladas: number;
  valor_total: number;
  valor_monofasico: number;
  por_cnpj: CnpjResumo[];
  por_ncm: NcmResumo[];
  meses_encontrados: string[];   // ['2026-06', ...] — alerta se o lote misturar meses
};

/**
 * Junta as notas parseadas em agregados por CNPJ e por CNPJ×NCM.
 * Dedupe por chave (última vence) e remove chaves canceladas antes de somar.
 */
export function agregarNotas(parsed: ParsedNfce[]): NfceAgregado {
  const canceladas = new Set<string>();
  const notas = new Map<string, NfceNota>();
  for (const p of parsed) {
    if (p.kind === 'cancelamento') canceladas.add(p.chave);
    else if (p.kind === 'nota') notas.set(p.chave, p);
  }
  for (const ch of canceladas) notas.delete(ch);

  const cnpjMap = new Map<string, CnpjResumo>();
  const ncmMap = new Map<string, NcmResumo>();
  const meses = new Set<string>();
  let valorTotal = 0, valorMono = 0;

  for (const n of notas.values()) {
    if (n.ano && n.mes) meses.add(`${n.ano}-${String(n.mes).padStart(2, '0')}`);
    valorTotal += n.valor_total;
    valorMono += n.valor_monofasico;

    const c = cnpjMap.get(n.cnpj) || { cnpj: n.cnpj, faturamento: 0, valor_monofasico: 0, qtd_notas: 0 };
    c.faturamento += n.valor_total; c.valor_monofasico += n.valor_monofasico; c.qtd_notas += 1;
    cnpjMap.set(n.cnpj, c);

    for (const it of n.itens) {
      const k = `${n.cnpj}|${it.ncm}|${it.cst_cofins}`;
      const r = ncmMap.get(k) || { cnpj: n.cnpj, ncm: it.ncm, cst_cofins: it.cst_cofins, monofasico: it.monofasico, valor: 0, qtd_itens: 0 };
      r.valor += it.valor; r.qtd_itens += 1;
      ncmMap.set(k, r);
    }
  }

  const round2 = (v: number) => Math.round(v * 100) / 100;
  const por_cnpj = Array.from(cnpjMap.values()).map((c) => ({ ...c, faturamento: round2(c.faturamento), valor_monofasico: round2(c.valor_monofasico) }));
  const por_ncm = Array.from(ncmMap.values()).map((r) => ({ ...r, valor: round2(r.valor) })).sort((a, b) => b.valor - a.valor);
  const mesesArr = Array.from(meses).sort();
  // competência do lote = mês mais frequente (na prática, único)
  const [ano, mes] = mesesArr.length ? mesesArr[mesesArr.length - 1].split('-').map(Number) : [null, null];

  return {
    ano, mes,
    qtd_notas: notas.size, qtd_canceladas: canceladas.size,
    valor_total: round2(valorTotal), valor_monofasico: round2(valorMono),
    por_cnpj, por_ncm, meses_encontrados: mesesArr,
  };
}
