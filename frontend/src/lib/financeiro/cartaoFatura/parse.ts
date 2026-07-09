/**
 * Parser multi-banco de fatura de cartão em ABERTO.
 *
 * Detecta o banco/formato pelo conteúdo e devolve SEMPRE o mesmo formato
 * normalizado (CartaoLinhaNormalizada), pra tela ser idêntica independente da fonte:
 *   - Itaú  → Excel (.xls antigo ou .xlsx) via SheetJS
 *   - Nubank → OFX (preferido: tem FITID único p/ dedupe) ou CSV
 *
 * ⚠️ Os SINAIS divergem entre fontes — normalizamos por SEMÂNTICA, nunca pelo sinal cru:
 *   - Itaú:      compra = valor positivo; "Pagamento Efetuado"/negativo = pagamento
 *   - Nubank CSV: compra = positivo;      negativo = pagamento recebido
 *   - Nubank OFX: compra = DEBIT (negativo); CREDIT (positivo) = pagamento/estorno
 */
import * as XLSX from 'xlsx';
import crypto from 'crypto';

export type CartaoBanco = 'itau' | 'nubank';
export type CartaoFormato = 'xls' | 'csv' | 'ofx';
export type CartaoTipoLinha = 'compra' | 'pagamento' | 'estorno';

export interface CartaoLinhaNormalizada {
  banco: CartaoBanco;
  origem_formato: CartaoFormato;
  fitid: string | null;
  data_transacao: string;      // YYYY-MM-DD
  descricao: string;
  valor: number;               // magnitude POSITIVA da compra
  tipo: CartaoTipoLinha;
  parcela: string | null;      // "11/12"
  cartao_final: string | null; // 4 últimos dígitos
  titular_nome: string | null;
  dedupe_hash: string;         // FITID quando existe, senão hash estável
}

export interface CartaoParseResult {
  banco: CartaoBanco;
  formato: CartaoFormato;
  linhas: CartaoLinhaNormalizada[];
}

// ----------------------------- helpers -------------------------------------

/** Excel serial (base 1899-12-30) → 'YYYY-MM-DD'. */
function excelSerialToISO(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** 'YYYYMMDD...' (OFX DTPOSTED) → 'YYYY-MM-DD'. */
function ofxDateToISO(s: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec((s || '').trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Número pt-BR ("1.234,56", "- 623,06") → number (com sinal). */
function parsePtBrNumber(s: string): number {
  const t = String(s || '').replace(/\s/g, '').replace(/R\$/gi, '');
  const neg = /^-/.test(t) || /-$/.test(t);
  const digits = t.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(digits);
  if (!Number.isFinite(n)) return NaN;
  return neg ? -Math.abs(n) : n;
}

/** Extrai "11/12" de um texto de lançamento parcelado. */
function extractParcela(texto: string): string | null {
  const m = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(texto || '');
  return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}` : null;
}

function last4(s: string | null | undefined): string | null {
  const d = String(s || '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : null;
}

/** Hash estável quando não há FITID: banco+cartão+data+valor+descrição+parcela. */
function hashLinha(l: Omit<CartaoLinhaNormalizada, 'dedupe_hash'>): string {
  const base = [l.banco, l.cartao_final || '', l.data_transacao, l.valor.toFixed(2), l.descricao.trim().toLowerCase(), l.parcela || ''].join('|');
  return crypto.createHash('sha1').update(base).digest('hex');
}

function comHash(l: Omit<CartaoLinhaNormalizada, 'dedupe_hash'>): CartaoLinhaNormalizada {
  return { ...l, dedupe_hash: l.fitid || hashLinha(l) };
}

// ----------------------------- Itaú (.xls/.xlsx) ---------------------------

function parseItauXls(buffer: Buffer): CartaoLinhaNormalizada[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const linhas: CartaoLinhaNormalizada[] = [];

  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });

    // Acha a linha de cabeçalho: col B = "Data" e col C começa com "Lan".
    let head = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      if (String(r[1] || '').trim().toLowerCase() === 'data' && String(r[2] || '').toLowerCase().startsWith('lan')) {
        head = i;
        break;
      }
    }
    if (head < 0) continue;

    // Colunas por posição (0-indexed): B=1 Data, C=2 Lançamento, D=3 Parcelamento,
    // E=4 Valor, G=6 Titularidade, H=7 Nome, I=8 Tipo cartão, J=9 Número cartão.
    for (let i = head + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const rawData = r[1];
      const descricao = String(r[2] || '').trim();
      if (!descricao && rawData == null) continue; // linha em branco = fim/gap

      const data = typeof rawData === 'number' ? excelSerialToISO(rawData) : (String(rawData || '').match(/\d{4}-\d{2}-\d{2}/)?.[0] || null);
      if (!data || !descricao) continue;

      const valorNum = typeof r[4] === 'number' ? r[4] : parsePtBrNumber(String(r[4] || ''));
      if (!Number.isFinite(valorNum)) continue;

      const ehPagamento = /pagamento efetuado|pagamento recebido/i.test(descricao) || valorNum < 0;
      const tipo: CartaoTipoLinha = ehPagamento ? 'pagamento' : 'compra';
      const parcela = String(r[3] || '').trim() || extractParcela(descricao);

      linhas.push(comHash({
        banco: 'itau',
        origem_formato: 'xls',
        fitid: null,
        data_transacao: data,
        descricao,
        valor: Math.round(Math.abs(valorNum) * 100) / 100,
        tipo,
        parcela: parcela || null,
        cartao_final: last4(r[9]),
        titular_nome: String(r[7] || '').trim() || null,
      }));
    }
  }
  return linhas;
}

// ----------------------------- Nubank OFX ----------------------------------

function tag(block: string, name: string): string | null {
  // OFX SGML: <TAG>valor  (sem fechamento). Pega até o próximo '<' ou fim de linha.
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block);
  return m ? m[1].trim() : null;
}

function parseNubankOfx(text: string): CartaoLinhaNormalizada[] {
  const linhas: CartaoLinhaNormalizada[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const b of blocks) {
    const trnType = (tag(b, 'TRNTYPE') || '').toUpperCase();
    const amt = parseFloat(tag(b, 'TRNAMT') || '');
    const data = ofxDateToISO(tag(b, 'DTPOSTED') || '');
    const memo = tag(b, 'MEMO') || tag(b, 'NAME') || '';
    const fitid = tag(b, 'FITID');
    if (!data || !Number.isFinite(amt)) continue;

    // Nubank: DEBIT (negativo) = compra; CREDIT (positivo) = pagamento/estorno.
    let tipo: CartaoTipoLinha;
    if (trnType === 'CREDIT' || amt > 0) {
      tipo = /pagamento/i.test(memo) ? 'pagamento' : 'estorno';
    } else {
      tipo = 'compra';
    }

    linhas.push(comHash({
      banco: 'nubank',
      origem_formato: 'ofx',
      fitid: fitid || null,
      data_transacao: data,
      descricao: memo.trim() || 'Lançamento',
      valor: Math.round(Math.abs(amt) * 100) / 100,
      tipo,
      parcela: extractParcela(memo),
      cartao_final: null,
      titular_nome: null,
    }));
  }
  return linhas;
}

// ----------------------------- Nubank CSV ----------------------------------

/** CSV simples com aspas (date,title,amount). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseNubankCsv(text: string): CartaoLinhaNormalizada[] {
  const linhas: CartaoLinhaNormalizada[] = [];
  const rows = text.split(/\r?\n/).filter(r => r.trim());
  if (!rows.length) return linhas;

  const header = splitCsvLine(rows[0]).map(h => h.toLowerCase());
  const iDate = header.indexOf('date');
  const iTitle = header.indexOf('title');
  const iAmount = header.indexOf('amount');
  if (iDate < 0 || iTitle < 0 || iAmount < 0) return linhas;

  for (let i = 1; i < rows.length; i++) {
    const c = splitCsvLine(rows[i]);
    const data = (c[iDate] || '').match(/\d{4}-\d{2}-\d{2}/)?.[0] || null;
    const title = (c[iTitle] || '').trim();
    const amt = parsePtBrNumber(c[iAmount] || '');
    if (!data || !title || !Number.isFinite(amt)) continue;

    // Nubank CSV: compra = positivo; negativo = pagamento recebido.
    const tipo: CartaoTipoLinha = amt < 0 ? (/pagamento/i.test(title) ? 'pagamento' : 'estorno') : 'compra';

    linhas.push(comHash({
      banco: 'nubank',
      origem_formato: 'csv',
      fitid: null,
      data_transacao: data,
      descricao: title,
      valor: Math.round(Math.abs(amt) * 100) / 100,
      tipo,
      parcela: extractParcela(title),
      cartao_final: null,
      titular_nome: null,
    }));
  }
  return linhas;
}

// ----------------------------- detecção + dispatch -------------------------

/**
 * Detecta banco/formato pelo nome e conteúdo, e devolve linhas normalizadas.
 * `filename` ajuda mas a decisão final é pelo conteúdo (mais robusto).
 */
export function parseFaturaCartao(buffer: Buffer, filename: string): CartaoParseResult {
  const nome = (filename || '').toLowerCase();
  const head = buffer.slice(0, 512).toString('latin1');

  // OFX: extensão .ofx OU cabeçalho OFX no conteúdo.
  if (nome.endsWith('.ofx') || /OFXHEADER|<OFX>/i.test(head)) {
    const text = buffer.toString('latin1'); // OFX Nubank vem em CP1252/USASCII
    return { banco: 'nubank', formato: 'ofx', linhas: parseNubankOfx(text) };
  }

  // CSV: extensão .csv OU primeira linha "date,title,amount".
  if (nome.endsWith('.csv') || /^\s*date\s*,\s*title\s*,\s*amount/i.test(head)) {
    const text = buffer.toString('utf8');
    return { banco: 'nubank', formato: 'csv', linhas: parseNubankCsv(text) };
  }

  // Excel (Itaú): .xls (BIFF antigo) ou .xlsx — SheetJS lê os dois.
  if (nome.endsWith('.xls') || nome.endsWith('.xlsx') || head.startsWith('PK') || head.charCodeAt(0) === 0xd0) {
    return { banco: 'itau', formato: 'xls', linhas: parseItauXls(buffer) };
  }

  throw new Error('Formato não reconhecido. Envie .xls/.xlsx (Itaú) ou .csv/.ofx (Nubank).');
}
