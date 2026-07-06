import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { deriveUnid } from '@/lib/insumo-unidade';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const num = (v: any) => Number(v || 0);
const r2 = (v: number) => Number(v.toFixed(2));

const NIVEL_Z: Record<number, number> = { 50: 0, 60: 0.254, 70: 0.525, 80: 0.842, 85: 1.037, 90: 1.282, 95: 1.645, 96: 1.751, 97: 1.88, 98: 2.055, 99: 2.325, 99.9: 3.1 };
const zDe = (n: number) => NIVEL_Z[n] ?? 1.645;
const mediaPonderada = (s: number[]) => { let n = 0, d = 0; s.forEach((v, i) => { if (v > 0) { n += v * (i + 1); d += (i + 1); } }); return d > 0 ? n / d : 0; };
const desvioPadrao = (s: number[]) => { const k = s.length; if (k < 2) return 0; const m = s.reduce((a, v) => a + v, 0) / k; return Math.sqrt(s.reduce((a, v) => a + (v - m) ** 2, 0) / (k - 1)); };
const semanaIniDe = (d: Date) => { const dow = (d.getDay() + 6) % 7; const m = new Date(d); m.setDate(d.getDate() - dow); return isoD(m); };
const addDias = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

// Planejamento de Compras por insumo. Espelha o de produção; termina em sugestão de compra.
// Sugestão de Compra = PR − Estoque + AB (necessidade da produção planejada); Qtde = ceil(sugestão / embalagem).
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const gold = (sb() as any).schema('gold');
  const { data: semRows } = await gold.rpc('fn_semanas_com_contagem', { p_bar: barId });
  const comContagem: string[] = (semRows || []).map((r: any) => r.semana_ini);
  const latest = comContagem[0] || semanaIniDe(new Date());
  const semanasDisponiveis = [
    { ini: addDias(latest, 7), fim: addDias(latest, 13), tem_contagem: false },
    ...comContagem.map((ini) => ({ ini, fim: addDias(ini, 6), tem_contagem: true })),
  ];
  const pedida = sp.get('semana');
  const semanaSel = pedida && comContagem.includes(pedida) ? pedida : latest;
  const semana = { ini: semanaSel, fim: addDias(semanaSel, 6) };

  const { data, error } = await gold.rpc('fn_plano_compras', { p_bar: barId, p_semana: semanaSel });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // existe plano de produção encerrado nessa semana? (AB depende disso)
  const { data: planosProd } = await (sb() as any).schema('operations').from('producao_plano')
    .select('area').eq('bar_id', barId).eq('semana_ini', semanaSel).eq('status', 'encerrado');
  const producaoEncerrada = (planosProd || []).map((p: any) => p.area);

  // nível de serviço por insumo (config); sem config = 95%
  const { data: cfgs } = await (sb() as any).schema('operations').from('compras_plano_config')
    .select('insumo_codigo, nivel_servico').eq('bar_id', barId);
  const cfgMap = new Map<string, number>();
  (cfgs || []).forEach((c: any) => cfgMap.set(String(c.insumo_codigo).toUpperCase(), Number(c.nivel_servico)));

  const itens = ((data || []) as any[]).map((r) => {
    const saidas = (r.saidas || []).map(num);
    const media6 = mediaPonderada(saidas);
    const desvpad = desvioPadrao(saidas);
    // unidade-base + tamanho da embalagem: catálogo (override/seed) com fallback derivado do NOME —
    // MESMA fonte da tela de Insumos, pra os números baterem (lib compartilhado).
    const u = (r.base && num(r.embalagem) > 0) ? { base: r.base as string, embalagem: num(r.embalagem) } : deriveUnid(r.nome, r.unidade_medida);
    const embalagem = u.embalagem || 1;
    const estoque = num(r.estoque_cont) * embalagem; // contagem vem em pacotes → unidade-base
    const ab = num(r.ab);
    const nivel = cfgMap.get(String(r.insumo_codigo).toUpperCase()) ?? 95;
    const pr = media6 + desvpad * zDe(nivel);
    const sugestaoBase = pr - estoque + ab;                 // AC = Z − AA + AB (unidade-base)
    const naoComprar = sugestaoBase <= 0;
    const sugestaoQtd = !naoComprar ? Math.ceil(sugestaoBase / embalagem) : 0; // AD = ROUNDUP(AC/embalagem) = nº de embalagens
    const ultima = saidas.length ? saidas[saidas.length - 1] : null;
    return {
      codigo: r.insumo_codigo, nome: r.nome, fornecedor: r.fornecedor, categoria: r.categoria,
      secao_vmarket: r.secao_vmarket || null,
      embalagem, base: u.base, unidade: u.base, custo: num(r.custo), curva_a: r.curva_a === true,
      estoque: r2(estoque), ab: r2(ab), comprado: num(r.comprado),
      media6: r2(media6), desvpad: r2(desvpad), saidas, semanas: r.semanas || [], ultima,
      nivel_servico: nivel, pr: r2(pr), sugestao_base: r2(sugestaoBase), sugestao_qtd: sugestaoQtd, nao_comprar: naoComprar,
    };
  }).sort((a, b) => b.sugestao_qtd - a.sugestao_qtd);

  return NextResponse.json({
    success: true, semana, semana_sel: semanaSel, semana_ativa: latest, semanas_disponiveis: semanasDisponiveis,
    contagem: { data: comContagem.includes(semanaSel) ? semanaSel : null },
    producao_encerrada: producaoEncerrada, itens,
  });
}

// POST { action:'config', insumo_codigo, nivel_servico } → salva o nível de serviço do insumo.
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  if (body.action === 'config') {
    const codigo = String(body.insumo_codigo || '').trim();
    const ns = Number(body.nivel_servico);
    if (!codigo) return NextResponse.json({ success: false, error: 'insumo_codigo obrigatório' }, { status: 400 });
    if (!(String(ns) in NIVEL_Z)) return NextResponse.json({ success: false, error: 'nível de serviço inválido' }, { status: 400 });
    const { error } = await (sb() as any).schema('operations').from('compras_plano_config')
      .upsert({ bar_id: barId, insumo_codigo: codigo, nivel_servico: ns, atualizado_em: new Date().toISOString() }, { onConflict: 'bar_id,insumo_codigo' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });
}
