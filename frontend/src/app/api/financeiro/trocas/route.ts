import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Trocas de insumo entre bares (item 2). Quem ENVIA registra (bar_origem = bar do usuário);
 * escolhe o bar contraparte (bar_destino) e os insumos + qtd. O valor = Σ custo dos insumos.
 * A troca reflete NA HORA no Desvio de Consumo (saída no emissor, entrada no recebedor) —
 * gold.fn_desvios/fn_desvios_proteina leem financial.trocas. O lançamento no Conta Azul
 * (receita a receber no emissor / despesa a pagar no recebedor) é um passo separado (TODO).
 *
 *  GET  ?de&ate            → trocas do bar (como origem OU destino) no período
 *  POST { bar_destino, data_competencia, descricao?, itens:[{insumo_codigo,quantidade,custo_unitario}] }
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const de = sp.get('de'); const ate = sp.get('ate');
  const fin = (sb() as any).schema('financial');

  let q = fin.from('trocas')
    .select('id,bar_origem,bar_destino,data_competencia,descricao,valor,status,inter_codigo_solicitacao,inter_pix_erro,criado_por,created_at,troca_itens(insumo_codigo,quantidade,custo_unitario,subtotal)')
    .or(`bar_origem.eq.${user.bar_id},bar_destino.eq.${user.bar_id}`)
    .order('data_competencia', { ascending: false }).order('created_at', { ascending: false }).limit(200);
  if (de) q = q.gte('data_competencia', de);
  if (ate) q = q.lte('data_competencia', ate);
  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // marca o sentido em relação ao bar atual (enviou/recebeu)
  const trocas = (data || []).map((t: any) => ({
    ...t,
    sentido: t.bar_origem === user.bar_id ? 'enviou' : 'recebeu',
  }));

  // Resolve o NOME do insumo pra mostrar na coluna "Itens" (a tabela só guarda o código).
  // Código i0XXX é reusado entre bares → resolve pelo catálogo do bar de ORIGEM (quem enviou).
  const paresBarCod = new Set<string>();
  for (const t of trocas) for (const it of (t.troca_itens || [])) if (it.insumo_codigo) paresBarCod.add(`${t.bar_origem}:${it.insumo_codigo}`);
  if (paresBarCod.size) {
    const bares = Array.from(new Set(trocas.map((t: any) => t.bar_origem)));
    const cods = Array.from(new Set(trocas.flatMap((t: any) => (t.troca_itens || []).map((i: any) => i.insumo_codigo).filter(Boolean))));
    const { data: cat } = await (sb() as any).schema('silver').from('insumo_catalogo')
      .select('bar_id,codigo,nome').in('bar_id', bares).in('codigo', cods);
    const nomePorBarCod = new Map<string, string>();
    for (const c of (cat || [])) nomePorBarCod.set(`${c.bar_id}:${c.codigo}`, c.nome);
    for (const t of trocas) for (const it of (t.troca_itens || [])) it.nome = nomePorBarCod.get(`${t.bar_origem}:${it.insumo_codigo}`) || null;
  }

  // Status REAL do PIX (fonte: financial.pix_enviados, mantido pelo webhook do Inter).
  const refs = trocas.map((t: any) => `troca:${t.id}`);
  if (refs.length) {
    const { data: pixs } = await fin.from('pix_enviados')
      .select('pagamento_zykor_id, inter_status, inter_codigo_solicitacao, data_envio')
      .in('pagamento_zykor_id', refs)
      .order('data_envio', { ascending: false });
    const byRef = new Map<string, any>();
    for (const p of (pixs || [])) if (!byRef.has(p.pagamento_zykor_id)) byRef.set(p.pagamento_zykor_id, p);
    for (const t of trocas) {
      const p = byRef.get(`troca:${t.id}`);
      t.pix_status = p?.inter_status || null;   // ENVIADO/AGENDADO/REPROVADO/EFETUADO...
      t.pix_codigo = p?.inter_codigo_solicitacao || null;
    }
  }
  return NextResponse.json({ success: true, trocas });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const barDestino = Number(body.bar_destino);
  const dataComp = String(body.data_competencia || '').slice(0, 10);
  const itens = Array.isArray(body.itens) ? body.itens : [];

  if (!Number.isFinite(barDestino) || barDestino <= 0) return NextResponse.json({ success: false, error: 'bar_destino obrigatório' }, { status: 400 });
  if (barDestino === user.bar_id) return NextResponse.json({ success: false, error: 'O bar de destino deve ser diferente do seu' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataComp)) return NextResponse.json({ success: false, error: 'data_competencia (YYYY-MM-DD) obrigatória' }, { status: 400 });

  // normaliza/valida itens
  const norm = itens
    .map((i: any) => {
      const cod = String(i.insumo_codigo || '').trim();
      const qtd = Number(i.quantidade);
      const custo = Number(i.custo_unitario) || 0;
      return { insumo_codigo: cod, quantidade: qtd, custo_unitario: custo, subtotal: Math.round(qtd * custo * 100) / 100 };
    })
    .filter((i: any) => i.insumo_codigo && Number.isFinite(i.quantidade) && i.quantidade > 0);
  if (norm.length === 0) return NextResponse.json({ success: false, error: 'Inclua ao menos um insumo com quantidade > 0' }, { status: 400 });

  const valor = Math.round(norm.reduce((s: number, i: any) => s + i.subtotal, 0) * 100) / 100;
  const fin = (sb() as any).schema('financial');

  const { data: troca, error: eT } = await fin.from('trocas').insert({
    bar_origem: user.bar_id, bar_destino: barDestino, data_competencia: dataComp,
    descricao: body.descricao ? String(body.descricao) : null, valor,
    criado_por: user.email || 'app',
  }).select('id').single();
  if (eT) return NextResponse.json({ success: false, error: eT.message }, { status: 500 });

  const { error: eI } = await fin.from('troca_itens').insert(norm.map((i: any) => ({ ...i, troca_id: troca.id })));
  if (eI) {
    await fin.from('trocas').delete().eq('id', troca.id); // rollback do cabeçalho
    return NextResponse.json({ success: false, error: eI.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: troca.id, valor });
}
