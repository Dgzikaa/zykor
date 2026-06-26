import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// mesma regra de área da tela de estoque (categoria → área)
const DRINK_NAOALC = new Set(['i0298', 'i0085', 'i0328', 'i0191', 'i0563']);
function areaDe(categoria: string | null, cod: string | null): string {
  const c = (categoria || '').toUpperCase();
  if (cod && DRINK_NAOALC.has((cod || '').toLowerCase())) return 'Drinks';
  if (/\(F\)/.test(c)) return 'Alimentação';
  if (/\(C\)/.test(c) || c.includes('PÃES') || c.includes('PAES') || c.includes('FEIJOADA')) return 'Comidas';
  if (/\(S\)/.test(c) || c.includes('MERCADO (S)')) return 'Salão';
  if (/\(B\)/.test(c) || ['DESTILADOS', 'IMPÉRIO', 'IMPERIO', 'POLPAS', 'PRÉ-BATCH', 'PRE-BATCH', 'OUTROS'].some((k) => c.includes(k))) return 'Drinks';
  if (['ARTESANAL', 'LATA', 'LONG NECK', 'RETORNÁVEIS', 'RETORNAVEIS', 'VINHOS'].some((k) => c.includes(k))) return 'Salão';
  if (c.includes('ALCÓOLICOS') || c.includes('ALCOOLICOS')) return 'Salão';
  return 'Comidas';
}

/**
 * GET /api/operacional/desvios
 *  - sem ?ini&fim → retorna as datas de contagem (semanal) disponíveis p/ escolher o período.
 *  - com ?ini&fim → desvio por insumo no período: real (estoque+compras) × teórico (vendas×ficha).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const ini = sp.get('ini');
  const fim = sp.get('fim');

  // sem período → lista de datas de contagem (semanal) p/ o seletor
  if (!ini || !fim) {
    const { data: datas, error } = await (sb() as any).schema('operations')
      .rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: 'semanal' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, datas: (datas || []).map((d: any) => d.data_contagem) });
  }

  const { data, error } = await (sb() as any).schema('gold')
    .rpc('fn_desvios', { p_bar: user.bar_id, p_ini: ini, p_fim: fim });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const itens = (data || []).map((r: any) => {
    const teorico = Number(r.teorico_rs || 0);
    const real = Number(r.real_rs || 0);
    // suspeita de unidade errada: teórico absurdo vs real (≥10x e diferença grande)
    const unidade_suspeita = teorico > 200 && (real === 0 ? teorico > 1000 : teorico / Math.abs(real) >= 10);
    return {
      insumo_codigo: r.insumo_codigo,
      insumo_nome: r.insumo_nome,
      area: areaDe(r.categoria, r.insumo_codigo),
      valor_ini: Number(r.valor_ini || 0),
      valor_fim: Number(r.valor_fim || 0),
      compras_rs: Number(r.compras_rs || 0),
      real_rs: real,
      teorico_rs: teorico,
      desvio_rs: Number(r.desvio_rs || 0),
      unidade_suspeita,
    };
  });

  // headline ignora os suspeitos de unidade (senão o limão distorce tudo)
  const limpos = itens.filter((i: any) => !i.unidade_suspeita);
  const head = (arr: any[]) => ({
    real: arr.reduce((s, i) => s + i.real_rs, 0),
    teorico: arr.reduce((s, i) => s + i.teorico_rs, 0),
    desvio: arr.reduce((s, i) => s + i.desvio_rs, 0),
  });

  return NextResponse.json({
    success: true,
    ini, fim,
    itens: itens.sort((a: any, b: any) => Math.abs(b.desvio_rs) - Math.abs(a.desvio_rs)),
    headline: head(itens),
    headline_sem_suspeitos: head(limpos),
    n_suspeitos: itens.length - limpos.length,
  });
}
