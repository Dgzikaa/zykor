import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
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

/** GET /api/financeiro/balanco?bar_id=3&ano=2026&mes=5 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = Number(sp.get('ano'));
    const mes = Number(sp.get('mes'));
    if (!barId || !ano || !mes) return NextResponse.json({ error: 'bar_id, ano, mes obrigatórios' }, { status: 400 });

    const mesAnt = mes === 1 ? 12 : mes - 1;
    const anoAnt = mes === 1 ? ano - 1 : ano;
    const [ca, manual, caAnt, manualAnt] = await Promise.all([
      caDe(barId, ano, mes), manualDe(barId, ano, mes), caDe(barId, anoAnt, mesAnt), manualDe(barId, anoAnt, mesAnt),
    ]);

    return NextResponse.json({ ca, manual, caAnt, manualAnt });
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
    const permitidos = new Set(['caixa_investimentos','emprestimos_cp_receber','estoques','imobilizado_inicial','imobilizado_liq','investimentos_aprovados_a_fazer','financiamentos_lp','provisoes_fiscais_eventos','provisoes_trabalhistas','patrimonio_liquido','investimentos_aprovados']);
    if (!permitidos.has(campo)) return NextResponse.json({ error: 'campo não permitido' }, { status: 400 });

    const row: any = { bar_id, ano, mes, [campo]: Number(valor) || 0, atualizado_em: new Date().toISOString() };
    const { error } = await fin().from('balanco_manual').upsert(row, { onConflict: 'bar_id,ano,mes' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
