import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// categorias do Conta Azul que compõem cada custo (mesma regra do calculate_evento_metrics)
const CAT_ART = ['Atrações Programação', 'Atrações/Eventos'];
const CAT_PROD = ['Produção Eventos'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIAS_SA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

/**
 * Composição de um custo do dia na tela de Planejamento Comercial (debug).
 * ?data=YYYY-MM-DD&tipo=art|prod|consumacao  (bar via header x-selected-bar-id)
 *
 * - art/prod: lança 1 linha por lançamento do Conta Azul (bronze_contaazul_lancamentos)
 *   com data_competencia = data e categoria correspondente. valor = COALESCE(NULLIF(valor_pago,0), valor_bruto).
 *   Marca `dia_errado` quando a descrição cita um dia da semana != do evento (cachê caiu no dia errado).
 *   Também devolve a cascata (real CA / override manual / projeção) pra explicar QUAL fonte venceu.
 * - consumacao: 1 linha por venda do ContaHub com desconto motivo 'Artistas' no dia (vd_vrdescontos).
 */
export async function GET(request: NextRequest) {
  await authenticateUser(request); // popula ator p/ auditoria — é leitura, sem 401
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const data = searchParams.get('data') || '';
  const tipo = (searchParams.get('tipo') || 'art') as 'art' | 'prod' | 'consumacao';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ success: false, error: 'data inválida (YYYY-MM-DD)' }, { status: 400 });
  }
  const dowEvento = new Date(`${data}T12:00:00Z`).getUTCDay();

  try {
    if (tipo === 'consumacao') {
      const { data: rows, error } = await (supabase as any).schema('bronze')
        .from('bronze_contahub_avendas_vendasperiodo')
        .select('vd_vrdescontos, vd_mesadesc, cli_nome, vd_pessoas')
        .eq('bar_id', barId).eq('vd_motivodesconto', 'Artistas').eq('vd_dtgerencial', data);
      if (error) throw error;
      const itens = ((rows || []) as any[])
        .map((r) => ({
          descricao: r.cli_nome || r.vd_mesadesc || 'Desconto',
          mesa: r.vd_mesadesc || null,
          pessoas: Number(r.vd_pessoas) || null,
          valor_usado: Number(r.vd_vrdescontos) || 0,
        }))
        .filter((x) => x.valor_usado > 0)
        .sort((a, b) => b.valor_usado - a.valor_usado);
      const total = itens.reduce((s, x) => s + x.valor_usado, 0);
      return NextResponse.json({ success: true, tipo, data, fonte: 'contahub', valor_total: total, count: itens.length, itens });
    }

    const cats = tipo === 'prod' ? CAT_PROD : CAT_ART;

    // cascata da tela: real do CA (c_art) > override manual (c_*_plan) > projeção auto (c_*_projecao)
    const { data: evb } = await (supabase as any).schema('operations')
      .from('eventos_base')
      .select('c_art, c_artistico_plan, c_art_projecao, c_prod, c_prod_plan, c_prod_projecao')
      .eq('bar_id', barId).eq('data_evento', data).maybeSingle();
    const real = tipo === 'prod' ? Number(evb?.c_prod) || 0 : Number(evb?.c_art) || 0;
    const override = tipo === 'prod' ? Number(evb?.c_prod_plan) || 0 : Number(evb?.c_artistico_plan) || 0;
    const projecao = tipo === 'prod' ? Number(evb?.c_prod_projecao) || 0 : Number(evb?.c_art_projecao) || 0;
    const fonte = real > 0 ? 'real_ca' : override > 0 ? 'override' : projecao > 0 ? 'projecao' : 'vazio';

    const { data: rows, error } = await (supabase as any).schema('bronze')
      .from('bronze_contaazul_lancamentos')
      .select('descricao, pessoa_nome, categoria_nome, valor_bruto, valor_pago, data_competencia, data_pagamento, status_traduzido')
      .eq('bar_id', barId).eq('tipo', 'DESPESA').is('excluido_em', null)
      .in('categoria_nome', cats).eq('data_competencia', data);
    if (error) throw error;

    const itens = ((rows || []) as any[]).map((r) => {
      const bruto = Number(r.valor_bruto) || 0;
      const pago = Number(r.valor_pago) || 0;
      const usado = pago !== 0 ? pago : bruto;
      const desc = String(r.descricao || '').toLowerCase();
      let dia_errado = false;
      for (let d = 0; d < 7; d++) {
        if (d === dowEvento) continue;
        if (desc.includes(DIAS[d]) || desc.includes(DIAS_SA[d])) { dia_errado = true; break; }
      }
      return {
        descricao: r.descricao, pessoa: r.pessoa_nome, categoria: r.categoria_nome,
        valor_bruto: bruto, valor_pago: pago, valor_usado: usado,
        status: r.status_traduzido, pago_flag: pago !== 0, dia_errado,
      };
    }).sort((a, b) => b.valor_usado - a.valor_usado);
    const somaLancamentos = itens.reduce((s, x) => s + x.valor_usado, 0);

    return NextResponse.json({
      success: true, tipo, data, fonte,
      candidatos: { real, override, projecao },
      valor_total: fonte === 'real_ca' ? somaLancamentos : fonte === 'override' ? override : projecao,
      soma_lancamentos: somaLancamentos, count: itens.length, itens,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erro' }, { status: 500 });
  }
}
