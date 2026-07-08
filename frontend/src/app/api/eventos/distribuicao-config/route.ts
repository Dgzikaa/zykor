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

// GET — carrega a config da calculadora salva para (bar, ano, mes). null se não existe.
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
  const url = new URL(request.url);
  const ano = parseInt(url.searchParams.get('ano') || '', 10);
  const mes = parseInt(url.searchParams.get('mes') || '', 10);
  if (!ano || !mes) return NextResponse.json({ success: false, error: 'ano/mes obrigatórios' }, { status: 400 });

  const { data, error } = await (supabase as any)
    .schema('operations')
    .from('planejamento_distribuicao_config')
    .select('bar_id, ano, mes, target_m1, m2_pct, m3_pct, dias_venda, pesos, art_pct, art_fixo, prod_pct, atualizado_em')
    .eq('bar_id', barId).eq('ano', ano).eq('mes', mes)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // dias de operação do bar (fonte da verdade: operations.bares_config) → dow: 0=dom..6=sáb.
  // Bar fechado num dia (ex.: Deboche/bar 4 às segundas) não deve entrar na distribuição.
  const { data: op } = await (supabase as any)
    .schema('operations')
    .from('bares_config')
    .select('opera_domingo, opera_segunda, opera_terca, opera_quarta, opera_quinta, opera_sexta, opera_sabado')
    .eq('bar_id', barId)
    .maybeSingle();
  const opera = op
    ? {
        0: op.opera_domingo !== false,
        1: op.opera_segunda !== false,
        2: op.opera_terca !== false,
        3: op.opera_quarta !== false,
        4: op.opera_quinta !== false,
        5: op.opera_sexta !== false,
        6: op.opera_sabado !== false,
      }
    : null;

  return NextResponse.json({ success: true, config: data || null, opera });
}

// POST — salva (upsert) a config da calculadora para (bar, ano, mes).
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
  // apiCall (cliente) manda o body double-encoded → request.json() pode vir STRING.
  let body: any = {};
  try { const raw = await request.json(); body = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { body = {}; }
  const ano = parseInt(String(body.ano), 10);
  const mes = parseInt(String(body.mes), 10);
  if (!ano || !mes || mes < 1 || mes > 12) return NextResponse.json({ success: false, error: 'ano/mes inválidos' }, { status: 400 });

  // upsert PARCIAL: só inclui no payload as colunas realmente enviadas. Assim o autosave
  // (manda tudo) grava tudo, e o "Aplicar" (manda só target/pesos) não zera os custos —
  // colunas fora do payload não são tocadas no UPDATE do ON CONFLICT.
  const row: Record<string, any> = {
    bar_id: barId,
    ano,
    mes,
    atualizado_em: new Date().toISOString(),
    atualizado_por: request.headers.get('x-user-email') || null,
  };
  if (body.target_m1 != null) row.target_m1 = Number(body.target_m1);
  if (body.m2_pct != null) row.m2_pct = Number(body.m2_pct);
  if (body.m3_pct != null) row.m3_pct = Number(body.m3_pct);
  if (body.dias_venda != null) row.dias_venda = Math.round(Number(body.dias_venda));
  if (body.pesos && typeof body.pesos === 'object') row.pesos = body.pesos;
  if (body.art_pct && typeof body.art_pct === 'object') row.art_pct = body.art_pct;
  if (body.art_fixo && typeof body.art_fixo === 'object') row.art_fixo = body.art_fixo;
  if (body.prod_pct && typeof body.prod_pct === 'object') row.prod_pct = body.prod_pct;

  const { error } = await (supabase as any)
    .schema('operations')
    .from('planejamento_distribuicao_config')
    .upsert(row, { onConflict: 'bar_id,ano,mes' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
