import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const num = (v: any) => Number(v || 0);
const r1 = (v: number) => Number(v.toFixed(1));

// Planejamento Semanal da Produção: sugere quantas porções/fornadas fazer na próxima semana,
// a partir da saída média das últimas 6 semanas (vendas×ficha) + tendência + eventos − estoque atual.
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const gold = (sb() as any).schema('gold');
  const { data, error } = await gold.rpc('fn_plano_producao', { p_bar: user.bar_id });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // próxima semana (segunda → domingo)
  const hoje = new Date();
  const dow = (hoje.getDay() + 6) % 7;
  const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow + 7);
  const fim = new Date(ini); fim.setDate(ini.getDate() + 6);

  // eventos na próxima semana → maior ajuste (multiplicador) do bar
  const { data: evs } = await (sb() as any).schema('operations').from('feriados_eventos')
    .select('data,nome,ajuste_ord,ajuste_deb').gte('data', isoD(ini)).lte('data', isoD(fim));
  const col = user.bar_id === 4 ? 'ajuste_deb' : 'ajuste_ord';
  const fatorEvento = (evs || []).reduce((m: number, e: any) => Math.max(m, Number(e[col] || 1)), 1);

  const itens = ((data || []) as any[]).map((r) => {
    const saidas = (r.saidas || []).map(num);
    const n = saidas.length || 1;
    const media6 = saidas.reduce((s: number, v: number) => s + v, 0) / n;
    const last2 = saidas.length >= 2 ? (saidas[saidas.length - 1] + saidas[saidas.length - 2]) / 2 : media6;
    const trend = media6 > 0 ? last2 / media6 : 1;
    const trendAdj = Math.max(-0.3, Math.min(0.5, 0.5 * (trend - 1))); // recência moderada (cap −30%/+50%)
    const projetada = media6 * (1 + trendAdj) * fatorEvento;
    const estoque = num(r.estoque_atual);
    const aProduzir = Math.max(0, projetada * 1.15 - estoque); // 15% de segurança
    const fator = num(r.fator_contagem) || 1;
    const rendContagem = num(r.rendimento) / fator; // rendimento na unidade de contagem (igual estoque)
    const fornadas = rendContagem > 0 ? Math.ceil(aProduzir / rendContagem) : null;
    const coberturaDias = media6 > 0 ? r1(estoque / (media6 / 7)) : null;
    return {
      codigo: r.producao_cod, nome: r.producao_nome, unidade: r.unidade, curva_a: r.curva_a === true,
      rendimento: num(r.rendimento), fator,
      media6: r1(media6), tendencia_pct: Math.round((trend - 1) * 100),
      estoque, projetada: r1(projetada), a_produzir: r1(aProduzir), fornadas,
      cobertura_dias: coberturaDias, saidas,
    };
  }).sort((a, b) => (b.fornadas || 0) - (a.fornadas || 0));

  return NextResponse.json({ success: true, semana: { ini: isoD(ini), fim: isoD(fim) }, eventos: evs || [], fator_evento: fatorEvento, itens });
}
