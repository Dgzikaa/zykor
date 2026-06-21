import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const supabase = createServiceRoleClient();

const fin = () => (supabase as any).schema('financial');

async function caDe(barId: number, ano: number, mes: number) {
  const { data } = await (supabase as any).rpc('get_balanco_ca', { p_bar_id: barId, p_ano: ano, p_mes: mes });
  return (Array.isArray(data) ? data[0] : data) || null;
}
async function manualDe(barId: number, ano: number, mes: number) {
  const { data } = await fin().from('balanco_manual').select('*').eq('bar_id', barId).eq('ano', ano).eq('mes', mes).maybeSingle();
  return data || null;
}
async function imobDe(barId: number, ano: number, mes: number) {
  const { data } = await (supabase as any).rpc('get_imobilizado', { p_bar_id: barId, p_ano: ano, p_mes: mes });
  return (Array.isArray(data) ? data[0] : data) || null;
}
async function estoqueDe(barId: number, ano: number, mes: number) {
  const { data } = await (supabase as any).rpc('get_estoque_cmv', { p_bar_id: barId, p_ano: ano, p_mes: mes });
  return Number(data) || 0;
}
async function realizadosDe(barId: number, ano: number, mes: number) {
  const { data } = await (supabase as any).rpc('get_investimentos_realizados', { p_bar_id: barId, p_ano: ano, p_mes: mes });
  return Number(data) || 0;
}
async function afazerDe(barId: number, ano: number, mes: number) {
  const { data } = await (supabase as any).rpc('get_inv_aprovados_a_fazer', { p_bar_id: barId, p_ano: ano, p_mes: mes });
  return Number(data) || 0;
}
async function snapDe(barId: number, ano: number, mes: number) {
  // saldo de caixa+investimentos puxado automático do CA (snapshot mensal); null se não houver
  const { data } = await fin().from('saldo_snapshot_mensal').select('caixa, investimentos, total, capturado_em')
    .eq('bar_id', barId).eq('ano', ano).eq('mes', mes).maybeSingle();
  return data || null;
}

/** Lista de N meses (ano,mes) terminando em (ano,mes), do mais antigo p/ o mais novo. */
function janelaMeses(ano: number, mes: number, n: number) {
  const out: { ano: number; mes: number }[] = [];
  let a = ano, m = mes;
  for (let i = 0; i < n; i++) {
    out.unshift({ ano: a, mes: m });
    m -= 1; if (m === 0) { m = 12; a -= 1; }
  }
  return out;
}

/**
 * GET /api/financeiro/balanco?bar_id=3&ano=2026&mes=5&n=6
 * Retorna { meses: [{ ano, mes, ca, manual }] } — N meses fechados terminando em ano/mes,
 * do mais antigo (esquerda) ao mais novo (direita), pra visão comparativa lado a lado.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = Number(sp.get('ano'));
    const mes = Number(sp.get('mes'));
    const n = Math.min(Math.max(Number(sp.get('n')) || 6, 1), 12);
    if (!barId || !ano || !mes) return NextResponse.json({ error: 'bar_id, ano, mes obrigatórios' }, { status: 400 });

    const janela = janelaMeses(ano, mes, n);
    const meses = await Promise.all(
      janela.map(async ({ ano, mes }) => ({
        ano, mes,
        ca: await caDe(barId, ano, mes),
        manual: await manualDe(barId, ano, mes),
        imob: await imobDe(barId, ano, mes),
        estoque: await estoqueDe(barId, ano, mes),
        realizados: await realizadosDe(barId, ano, mes),
        afazer: await afazerDe(barId, ano, mes),
        snap: await snapDe(barId, ano, mes),
      })),
    );

    return NextResponse.json({ meses });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

/** POST { bar_id, ano, mes, campo, valor } — salva 1 input manual */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const { bar_id, ano, mes, campo, valor } = b;
    if (!bar_id || !ano || !mes || !campo) return NextResponse.json({ error: 'dados inválidos' }, { status: 400 });
    const permitidos = new Set(['caixa_investimentos','emprestimos_cp_receber','estoques','imobilizado_inicial','imobilizado_liq','investimentos_aprovados_a_fazer','financiamentos_lp','provisoes_trabalhistas','patrimonio_liquido','investimentos_aprovados']);
    if (!permitidos.has(campo)) return NextResponse.json({ error: 'campo não permitido' }, { status: 400 });

    const row: any = { bar_id, ano, mes, [campo]: Number(valor) || 0, atualizado_em: new Date().toISOString() };
    const { error } = await fin().from('balanco_manual').upsert(row, { onConflict: 'bar_id,ano,mes' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
