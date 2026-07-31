import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Drill-down do REALIZADO da Orçamentação: lista os lançamentos do Conta Azul
// que compõem o valor de uma linha (subcategoria) ou de um bloco %.
//
// Fonte: silver.lancamento_classificado (1 row por lançamento, já mapeado
// CA -> categoria_zykor / bloco_dre). Aplica os MESMOS filtros do gold
// (gold.fn_refresh_gold_orcamento): exclui antecipação Stone e ignorados, pra
// a soma dos lançamentos bater com o realizado exibido na tela.
//
// Params:
//   bar_id (obrigatório), ano (obrigatório), mes (obrigatório)
//   categorias=CSV de categoria_zykor  (linhas normais)  OU
//   bloco=bloco_dre                    (blocos % Custos Variáveis / CMV / Receita)

async function fetchAll(
  base: any,
  table: string,
  columns: string,
  apply: (q: any) => any
): Promise<any[]> {
  const out: any[] = [];
  const limit = 1000;
  let from = 0;
  for (let i = 0; i < 50; i++) {
    let q = base.from(table).select(columns).range(from, from + limit - 1);
    q = apply(q);
    const { data, error } = await q;
    if (error) {
      console.error('❌ lancamentos orcamentacao:', error);
      break;
    }
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < limit) break;
    from += limit;
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ano = searchParams.get('ano');
    const mes = searchParams.get('mes');
    const categoriasParam = searchParams.get('categorias'); // CSV de categoria_zykor
    const bloco = searchParams.get('bloco');                // bloco_dre

    if (!barId || !ano || !mes) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros obrigatórios: bar_id, ano, mes' },
        { status: 400 }
      );
    }
    const categorias = (categoriasParam || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    if (categorias.length === 0 && !bloco) {
      return NextResponse.json(
        { success: false, error: 'Informe categorias ou bloco' },
        { status: 400 }
      );
    }

    const anoN = parseInt(ano);
    const mesN = parseInt(mes);
    const ini = `${anoN}-${String(mesN).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anoN, mesN, 0).getDate();
    const fim = `${anoN}-${String(mesN).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const silver = (supabase as any).schema('silver');

    const rows = await fetchAll(
      silver,
      'lancamento_classificado',
      'data_competencia, data_pagamento, descricao, pessoa_nome, valor_bruto, status, tipo_ca, categoria_ca, categoria_zykor, bloco_dre, tipo_zykor',
      (q: any) => {
        q = q
          .eq('bar_id', parseInt(barId))
          .gte('data_competencia', ini)
          .lte('data_competencia', fim)
          // Mesmos filtros do gold pra a soma bater com o realizado da tela.
          .eq('is_antecipacao_stone', false)
          .eq('is_ignorado', false);
        if (categorias.length > 0) q = q.in('categoria_zykor', categorias);
        else if (bloco) q = q.eq('bloco_dre', bloco);
        return q;
      }
    );

    // Ordena por data e, dentro do dia, por valor desc.
    rows.sort((a, b) => {
      const d = String(a.data_competencia).localeCompare(String(b.data_competencia));
      if (d !== 0) return d;
      return (parseFloat(b.valor_bruto) || 0) - (parseFloat(a.valor_bruto) || 0);
    });

    let totalDespesa = 0;
    let totalReceita = 0;
    // NET por categoria, com a MESMA fórmula do gold (gold.fn_refresh_gold_orcamento):
    // numa categoria de despesa, um lançamento de RECEITA (estorno, devolução) ABATE em
    // vez de somar — e vice-versa. Somar despesa+receita mostrava um total maior que o
    // realizado da linha (ex.: Materiais Operação com estorno: 4.722 no popup vs 2.811
    // na tela). O tipo vem do próprio lançamento, então não depende de a tela mandar nada.
    const netPorCategoria = new Map<string, { receita: number; despesa: number; tipo: string }>();
    for (const r of rows) {
      const v = parseFloat(r.valor_bruto) || 0;
      const ehReceita = String(r.tipo_ca).toUpperCase() === 'RECEITA';
      if (ehReceita) totalReceita += v;
      else totalDespesa += v;

      const cat = r.categoria_zykor || '(sem categoria)';
      const acc = netPorCategoria.get(cat) ?? {
        receita: 0,
        despesa: 0,
        tipo: String(r.tipo_zykor || 'despesa').toLowerCase(),
      };
      if (ehReceita) acc.receita += v;
      else acc.despesa += v;
      // Igual ao MAX(tipo_zykor) do gold: qualquer linha da categoria marcada como
      // receita define a categoria como receita.
      if (String(r.tipo_zykor || '').toLowerCase() === 'receita') acc.tipo = 'receita';
      netPorCategoria.set(cat, acc);
    }

    let totalNet = 0;
    for (const { receita, despesa, tipo } of netPorCategoria.values()) {
      totalNet += tipo === 'receita' ? receita - despesa : despesa - receita;
    }

    return NextResponse.json({
      success: true,
      periodo: { inicio: ini, fim },
      total_lancamentos: rows.length,
      total_despesa: Math.round(totalDespesa * 100) / 100,
      total_receita: Math.round(totalReceita * 100) / 100,
      total_net: Math.round(totalNet * 100) / 100,
      lancamentos: rows,
    });
  } catch (error: any) {
    console.error('❌ Erro no drill-down de lançamentos da orçamentação:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
