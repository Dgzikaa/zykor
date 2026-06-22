import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/beneficiarios/artistas/detalhe?key=<artista_key>
 * Lista de shows de um artista + header agregado (derivado no servidor).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const key = (new URL(request.url).searchParams.get('key') || '').trim();
  if (!key) return NextResponse.json({ success: false, error: 'key obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('gold').rpc('artista_detalhe', { p_bar_id: user.bar_id, p_key: key });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const shows = (data || []).map((r: any) => ({
    evento_id: Number(r.evento_id),
    data: r.data_evento,
    dia_semana: r.dia_semana,
    nome_evento: r.nome_evento,
    genero: r.genero,
    nome: r.artista_label,
    c_art: Number(r.c_art) || 0,
    c_prod: Number(r.c_prod) || 0,
    custo_total: Number(r.custo_total) || 0,
    fat: Number(r.real_r) || 0,
    m1: Number(r.m1_r) || 0,
    publico: Number(r.cl_real) || 0,
    te: Number(r.te_real) || 0,
    tb: Number(r.tb_real) || 0,
    ticket: Number(r.ticket) || 0,
    pct_art_fat: Number(r.percent_art_fat) || 0,
    futuro: !!r.futuro,
  }));

  if (!shows.length) return NextResponse.json({ success: false, error: 'Artista não encontrado' }, { status: 404 });

  const feitos = shows.filter((s: any) => !s.futuro);
  const previstos = shows.filter((s: any) => s.futuro);
  const sum = (arr: any[], f: (x: any) => number) => arr.reduce((a, x) => a + f(x), 0);
  const fatTotal = sum(feitos, (s) => s.fat);
  const pubTotal = sum(feitos, (s) => s.publico);
  const custoFeito = sum(feitos, (s) => s.custo_total);

  const header = {
    nome: shows[0].nome,
    genero: shows[0].genero,
    shows_feitos: feitos.length,
    shows_previstos: previstos.length,
    custo_total: Math.round(sum(shows, (s) => s.custo_total)),
    custo_total_feito: Math.round(custoFeito),
    custo_medio: feitos.length ? Math.round(custoFeito / feitos.length) : 0,
    fat_total: Math.round(fatTotal),
    fat_medio: feitos.length ? Math.round(fatTotal / feitos.length) : 0,
    publico_total: pubTotal,
    publico_medio: feitos.length ? Math.round(pubTotal / feitos.length) : 0,
    ticket_medio: pubTotal ? Math.round((fatTotal / pubTotal) * 100) / 100 : 0,
    custo_pct_fat: fatTotal ? Math.round((custoFeito / fatTotal) * 1000) / 10 : 0,
    primeira: shows[0].data,
    ultima: feitos.length ? feitos[feitos.length - 1].data : null,
    proximo: previstos.length ? previstos[0].data : null,
  };

  return NextResponse.json({ success: true, header, shows });
}
