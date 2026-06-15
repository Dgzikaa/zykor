// Versao de BP = abreviacao do mes + ano de 2 digitos. Ex.: "Mai26" = Maio/2026.

export const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Extrai (mes 1-12, ano 4 digitos) de uma versao tipo "Mai26". Null se nao casar.
export function parseVersao(versao: string): { mes: number; ano: number } | null {
  const m = /^([A-Za-zçÇ]{3})\s*(\d{2,4})$/.exec((versao || '').trim());
  if (!m) return null;
  const abbr = m[1].slice(0, 3).toLowerCase();
  const idx = MESES_ABBR.findIndex(x => x.toLowerCase() === abbr);
  if (idx < 0) return null;
  const yy = Number(m[2]);
  const ano = yy < 100 ? 2000 + yy : yy;
  return { mes: idx + 1, ano };
}

// Ordinal cronologico pra ordenar versoes. Usa o ano/versao da linha quando a
// versao nao for parseavel (ex.: nomes custom).
export function versaoOrdinal(versao: string, anoLinha: number): number {
  const p = parseVersao(versao);
  if (p) return p.ano * 12 + (p.mes - 1);
  return anoLinha * 12; // fallback: ordena pelo ano da linha
}

// Monta o nome da versao a partir de (mes, ano). Ex.: (6, 2026) -> "Jun26".
export function formatVersao(mes: number, ano: number): string {
  const abbr = MESES_ABBR[(mes - 1 + 12) % 12];
  return `${abbr}${String(ano).slice(-2)}`;
}

// Sugere o proximo mes a partir de uma versao. Ex.: "Mai26" -> { versao: "Jun26", ano: 2026, mes: 6 }.
export function proximaVersao(versao: string, anoFallback: number): { versao: string; ano: number; mes: number } {
  const p = parseVersao(versao) ?? { mes: new Date().getMonth() + 1, ano: anoFallback };
  let mes = p.mes + 1;
  let ano = p.ano;
  if (mes > 12) { mes = 1; ano += 1; }
  return { versao: formatVersao(mes, ano), ano, mes };
}

// Escolhe a versao mais recente de uma lista de { ano, versao }.
export function versaoMaisRecente(
  versoes: { ano: number; versao: string }[],
): { ano: number; versao: string } | null {
  if (!versoes.length) return null;
  return [...versoes].sort(
    (a, b) => versaoOrdinal(b.versao, b.ano) - versaoOrdinal(a.versao, a.ano),
  )[0];
}
