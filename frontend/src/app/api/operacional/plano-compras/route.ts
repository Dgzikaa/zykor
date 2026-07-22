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
// Média ponderada por recência (peso = posição+1). `ign[i]` = semana ignorada (fora da média).
const mediaPonderada = (s: number[], ign?: boolean[]) => { let n = 0, d = 0; s.forEach((v, i) => { if (ign?.[i]) return; if (v > 0) { n += v * (i + 1); d += (i + 1); } }); return d > 0 ? n / d : 0; };
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

  // ajustes manuais do histórico de saída por semana (valor na mão e/ou ignorar da média)
  const { data: ajs } = await (sb() as any).schema('operations').from('compras_plano_saida_ajuste')
    .select('insumo_codigo, semana_ini, valor_manual, ignorar').eq('bar_id', barId);
  const ajMap = new Map<string, { valor_manual: number | null; ignorar: boolean }>();
  (ajs || []).forEach((a: any) => ajMap.set(`${String(a.insumo_codigo).toUpperCase()}|${a.semana_ini}`,
    { valor_manual: a.valor_manual == null ? null : Number(a.valor_manual), ignorar: !!a.ignorar }));

  const itens = ((data || []) as any[]).map((r) => {
    const semanas: string[] = r.semanas || [];
    const saidasOrig = (r.saidas || []).map(num);
    // aplica os ajustes: valor_manual sobrescreve o calculado; ignorar tira a semana da média/desvio.
    const saidas: number[] = [];
    const ignorados: boolean[] = [];
    const manuais: boolean[] = [];
    semanas.forEach((wk, i) => {
      const aj = ajMap.get(`${String(r.insumo_codigo).toUpperCase()}|${wk}`);
      ignorados.push(!!aj?.ignorar);
      manuais.push(!!(aj && aj.valor_manual != null));
      saidas.push(aj && aj.valor_manual != null ? aj.valor_manual : (saidasOrig[i] ?? 0));
    });
    const media6 = mediaPonderada(saidas, ignorados);
    const desvpad = desvioPadrao(saidas.filter((_, i) => !ignorados[i]));
    // unidade-base + tamanho da embalagem: catálogo (override/seed) com fallback derivado do NOME —
    // MESMA fonte da tela de Insumos, pra os números baterem (lib compartilhado).
    const u = (r.base && num(r.embalagem) > 0) ? { base: r.base as string, embalagem: num(r.embalagem) } : deriveUnid(r.nome, r.unidade_medida);
    const embalagem = u.embalagem || 1;
    // ESTOQUE REAL = contagem (pacotes → base) − consumo de produções FINALIZADAS desde a contagem.
    // O estoque "anda" conforme as produções dão baixa, sem esperar a próxima contagem semanal.
    const estoqueContBase = num(r.estoque_cont) * embalagem;
    const consumoPos = num(r.consumo_pos);
    const estoque = Math.max(0, estoqueContBase - consumoPos); // contagem em pacotes → unidade-base
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
      estoque: r2(estoque), estoque_contagem: r2(estoqueContBase), consumo_pos: r2(consumoPos), ab: r2(ab), comprado: num(r.comprado),
      media6: r2(media6), desvpad: r2(desvpad), saidas, saidas_orig: saidasOrig, ignorados, manuais,
      semanas, ultima,
      nivel_servico: nivel, pr: r2(pr), sugestao_base: r2(sugestaoBase), sugestao_qtd: sugestaoQtd, nao_comprar: naoComprar,
    };
  }).sort((a, b) => b.sugestao_qtd - a.sugestao_qtd);

  // Faltas ATIVAS marcadas manualmente (pausa "acabou" / gestor): viram badge no item, mesmo
  // que a contagem semanal ainda mostre estoque. Chave por código (case-insensitive).
  const { data: faltasRows } = await (sb() as any).schema('operations').from('insumo_falta')
    .select('insumo_codigo, origem, marcado_por, marcado_em').eq('bar_id', barId).is('resolvido_em', null);
  const faltaMap = new Map<string, any>();
  (faltasRows || []).forEach((f: any) => faltaMap.set(String(f.insumo_codigo).toUpperCase(),
    { origem: f.origem, por: f.marcado_por, em: f.marcado_em }));
  itens.forEach((i: any) => { i.falta = faltaMap.get(String(i.codigo).toUpperCase()) || null; });

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

  // POST { action:'saida_ajuste', insumo_codigo, semana_ini, valor_manual?, ignorar? }
  // Ajusta o histórico de saída de uma semana: valor na mão (unidade-base) e/ou ignorar da média.
  // Sem valor manual e sem ignorar → remove o ajuste (volta ao automático).
  if (body.action === 'saida_ajuste') {
    const codigo = String(body.insumo_codigo || '').trim();
    const semana = String(body.semana_ini || '').trim();
    if (!codigo) return NextResponse.json({ success: false, error: 'insumo_codigo obrigatório' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(semana)) return NextResponse.json({ success: false, error: 'semana_ini inválida (AAAA-MM-DD)' }, { status: 400 });
    const ignorar = body.ignorar === true;
    const vm = body.valor_manual;
    const valorManual = (vm === null || vm === undefined || vm === '') ? null : Number(vm);
    if (valorManual != null && (!isFinite(valorManual) || valorManual < 0)) {
      return NextResponse.json({ success: false, error: 'valor_manual inválido' }, { status: 400 });
    }
    const ops = (sb() as any).schema('operations');
    if (!ignorar && valorManual == null) {
      const { error } = await ops.from('compras_plano_saida_ajuste').delete()
        .eq('bar_id', barId).eq('insumo_codigo', codigo).eq('semana_ini', semana);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, removido: true });
    }
    const { error } = await ops.from('compras_plano_saida_ajuste').upsert({
      bar_id: barId, insumo_codigo: codigo, semana_ini: semana,
      valor_manual: valorManual, ignorar, usuario: user.email || (user as any).nome || null,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'bar_id,insumo_codigo,semana_ini' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });
}
