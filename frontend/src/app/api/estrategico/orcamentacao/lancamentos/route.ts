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
      'data_competencia, data_pagamento, descricao, pessoa_nome, valor_bruto, status, tipo_ca, categoria_ca, categoria_zykor, bloco_dre',
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

    // Totais por tipo (despesa/receita) — o net depende do tipo da linha, mas a
    // tela só precisa exibir a lista; devolvemos os dois pra contexto.
    let totalDespesa = 0;
    let totalReceita = 0;
    for (const r of rows) {
      const v = parseFloat(r.valor_bruto) || 0;
      if (String(r.tipo_ca).toUpperCase() === 'RECEITA') totalReceita += v;
      else totalDespesa += v;
    }

    return NextResponse.json({
      success: true,
      periodo: { inicio: ini, fim },
      total_lancamentos: rows.length,
      total_despesa: Math.round(totalDespesa * 100) / 100,
      total_receita: Math.round(totalReceita * 100) / 100,
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
