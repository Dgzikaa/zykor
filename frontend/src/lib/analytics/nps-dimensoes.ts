// Canonicalização dos sub-critérios (ratings) do Falae em dimensões da experiência.
// Os rótulos variam MUITO entre bares/pesquisas ("Tempo de Espera", "TEMPO DE ENTREGA",
// "TEMPO DE ESPERA DOS PEDIDOS", "Limpeza" vs "Limpeza do espaço", "MÚSICA"...) — aqui viram
// um punhado de dimensões estáveis. Vive no TS (não no SQL) pra casar com o resto da canonicalização.

export interface DimensaoAgg { dimensao: string; nota_media: number; n: number }

export function dimensaoDe(criterioRaw: string): string | null {
  const s = String(criterioRaw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/atendimento|garcom|garcon/.test(s)) return 'Atendimento';
  if (/musica|som\b|dj\b|banda/.test(s)) return 'Música';
  if (/cardapio|comida|prato|petisco/.test(s)) return 'Comida';
  if (/drink|bebida|chopp|cerveja/.test(s)) return 'Drinks';
  if (/ambiente|clima|espaco|estrutura/.test(s)) return 'Ambiente';
  if (/limpeza|banheiro|higiene/.test(s)) return 'Limpeza';
  if (/custo|benef|preco/.test(s)) return 'Custo-benefício';
  if (/entrada|saida|fila\b|acesso/.test(s)) return 'Entrada/Saída';
  if (/espera|entrega|pedido|tempo/.test(s)) return 'Tempo de espera';
  return null;
}

// [{criterio_raw, nota}] -> [{dimensao, nota_media, n}] ordenado do PIOR pro melhor (gargalo 1º).
export function agregarDimensoes(rows: Array<{ criterio_raw: string; nota: number }>, minN = 3): DimensaoAgg[] {
  const m = new Map<string, { soma: number; n: number }>();
  for (const r of rows) {
    const d = dimensaoDe(r.criterio_raw);
    if (!d) continue;
    const a = m.get(d) || { soma: 0, n: 0 };
    a.soma += Number(r.nota) || 0; a.n++;
    m.set(d, a);
  }
  return [...m.entries()]
    .map(([dimensao, a]) => ({ dimensao, nota_media: Math.round((a.soma / a.n) * 100) / 100, n: a.n }))
    .filter((x) => x.n >= minN)
    .sort((a, b) => a.nota_media - b.nota_media);
}
