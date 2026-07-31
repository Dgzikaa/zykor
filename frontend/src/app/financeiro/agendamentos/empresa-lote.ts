/**
 * Resolução da coluna "Empresa" da planilha de pagamento em lote → bar_id.
 *
 * Existe porque a folha do Descubra inteira foi parar no Ordinário (30/07/2026): até então a
 * importação carimbava TODA linha com o bar selecionado na tela, e não havia como dizer a empresa.
 *
 * Fica em arquivo separado (e sem React) de propósito: é a regra que decide para onde vai dinheiro,
 * então precisa ser lida e testada sem abrir a tela.
 */

export type BarBasico = { id: number; nome: string };

/** Sem acento, sem caixa, sem pontuação e sem espaço repetido — "Ordinário Bar" → "ordinario bar". */
export function normalizarEmpresa(valor: string | null | undefined): string {
  return (valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Razão social / apelido que o financeiro digita na planilha e que NÃO bate com o nome do bar no
 * Zykor. "Descubra" é a razão social do Deboche — é como aparece na folha e no Conta Azul.
 * Chave e valor normalizados; o valor precisa casar com o nome de algum bar do usuário.
 */
const APELIDOS: Record<string, string> = {
  descubra: 'deboche',
  'descubra bar': 'deboche',
};

/** Só dígitos — compara CNPJ digitado de qualquer jeito ("12.345.678/0001-90" ≡ "12345678000190"). */
const soDigitos = (s: string) => s.replace(/\D+/g, '');

/**
 * Acha o bar da linha. Aceita, nesta ordem: id numérico, nome exato, apelido conhecido, e
 * finalmente prefixo/contido (pra "ORDINARIO" casar com "Ordinário Bar").
 *
 * Devolve `null` quando não dá pra afirmar — inclusive quando o texto casa com MAIS DE UM bar.
 * Chutar aqui manda pagamento pra empresa errada, que é justamente o que se quer evitar.
 */
export function resolverBarDaEmpresa(
  empresa: string | null | undefined,
  bares: BarBasico[]
): number | null {
  const bruto = String(empresa ?? '').trim();
  if (!bruto || bares.length === 0) return null;

  // id direto ("3", "4") — o financeiro raramente usa, mas é inequívoco quando usa.
  if (/^\d+$/.test(bruto)) {
    const porId = bares.find(b => b.id === Number(bruto));
    if (porId) return porId.id;
  }

  const alvo = normalizarEmpresa(bruto);
  if (!alvo) return null;

  const comNome = bares.map(b => ({ bar: b, nome: normalizarEmpresa(b.nome) }));

  const exato = comNome.filter(x => x.nome === alvo);
  if (exato.length === 1) return exato[0].bar.id;

  const apelido = APELIDOS[alvo];
  if (apelido) {
    const porApelido = comNome.filter(x => x.nome === apelido || x.nome.startsWith(`${apelido} `));
    if (porApelido.length === 1) return porApelido[0].bar.id;
  }

  // "ordinario" ↔ "ordinario bar". Exige que um contenha o outro por PALAVRA inteira, senão
  // "bar" sozinho casaria com todos.
  const parcial = comNome.filter(
    x => x.nome === alvo || x.nome.startsWith(`${alvo} `) || alvo.startsWith(`${x.nome} `)
  );
  if (parcial.length === 1) return parcial[0].bar.id;

  return null;
}

/**
 * Mesma ideia, mas por CNPJ — a planilha da contabilidade costuma trazer o CNPJ em vez do nome.
 * `cnpjPorBar` vem do cadastro dos bares; sem ele a função simplesmente não resolve.
 */
export function resolverBarDoCnpj(
  valor: string | null | undefined,
  cnpjPorBar: Array<{ id: number; cnpj?: string | null }>
): number | null {
  const alvo = soDigitos(String(valor ?? ''));
  if (alvo.length !== 14) return null;
  const achados = cnpjPorBar.filter(b => soDigitos(String(b.cnpj ?? '')) === alvo);
  return achados.length === 1 ? achados[0].id : null;
}

/** Agrupa as linhas por bar de destino, preservando a ordem original dentro de cada grupo. */
export function agruparPorBar<T>(
  linhas: T[],
  barDaLinha: (linha: T, index: number) => number
): Map<number, T[]> {
  const grupos = new Map<number, T[]>();
  linhas.forEach((linha, i) => {
    const bar = barDaLinha(linha, i);
    const atual = grupos.get(bar);
    if (atual) atual.push(linha);
    else grupos.set(bar, [linha]);
  });
  return grupos;
}
