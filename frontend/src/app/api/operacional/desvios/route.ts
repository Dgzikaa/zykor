import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
 *  - sem ?ini&fim → datas de contagem do tipo (?tipo=diaria|semanal|mensal) p/ o seletor.
 *  - com ?ini&fim → desvio por insumo: Saída Real (estoque_ini+compras−estoque_fim) × Saída Teórica (vendas×ficha).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const ini = sp.get('ini');
  const fim = sp.get('fim');
  const tipo = ['diaria', 'semanal', 'mensal'].includes(sp.get('tipo') || '') ? sp.get('tipo') : 'semanal';

  if (!ini || !fim) {
    const { data: datas, error } = await (sb() as any).schema('operations')
      .rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, datas: (datas || []).map((d: any) => d.data_contagem) });
  }

  const { data, error } = await (sb() as any).schema('gold')
    .rpc('fn_desvios', { p_bar: user.bar_id, p_ini: ini, p_fim: fim });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const itens = (data || []).map((r: any) => {
    const real = Number(r.saida_real || 0);
    const teorica = Number(r.saida_teorica || 0);
    // suspeita de ficha/unidade: saída teórica muito acima da real (mas já não distorce, pois é por qtd)
    const suspeita = Math.abs(teorica) > Math.abs(real) * 5 && Math.abs(Number(r.desvio_rs || 0)) > 200;
    return {
      insumo_codigo: r.insumo_codigo,
      insumo_nome: r.insumo_nome,
      area: areaDe(r.categoria, r.insumo_codigo),
      estoque_ini: Number(r.estoque_ini || 0),
      compra: Number(r.compra || 0),
      estoque_fim: Number(r.estoque_fim || 0),
      saida_real: real,
      saida_teorica: teorica,
      desvio_qtd: Number(r.desvio_qtd || 0),
      preco: r.preco == null ? null : Number(r.preco),
      desvio_rs: Number(r.desvio_rs || 0),
      suspeita,
    };
  });

  const desvio_total = itens.reduce((s: number, i: any) => s + i.desvio_rs, 0);
  const perdas = itens.reduce((s: number, i: any) => s + (i.desvio_rs > 0 ? i.desvio_rs : 0), 0);
  const sobras = itens.reduce((s: number, i: any) => s + (i.desvio_rs < 0 ? i.desvio_rs : 0), 0);

  return NextResponse.json({
    success: true,
    ini, fim,
    itens: itens.sort((a: any, b: any) => Math.abs(b.desvio_rs) - Math.abs(a.desvio_rs)),
    headline: { desvio_total, perdas, sobras },
  });
}
