import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = () => (sb() as any).schema('operations');
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const num = (v: any) => Number(v || 0);
const r2 = (v: number) => Number(v.toFixed(2));
const areaDe = (cod: string) => (cod || '').toLowerCase().startsWith('pd') ? 'Bar' : 'Cozinha';

// De/para Nível de Serviço → Fator de Serviço (z-score da normal).
const NIVEL_Z: Record<number, number> = {
  50: 0, 60: 0.254, 70: 0.525, 80: 0.842, 85: 1.037, 90: 1.282,
  95: 1.645, 96: 1.751, 97: 1.88, 98: 2.055, 99: 2.325, 99.9: 3.1,
};
const zDe = (nivel: number) => NIVEL_Z[nivel] ?? 1.645;

/**
 * Dias entre a contagem (segunda) e a produção, quando o item não tem ajuste próprio.
 * 2 = a produção sai em média na quarta (Gonza, 22/08). Errar o dia em ±1 custa 1/7 da demanda
 * semanal, dentro da folga de segurança; o lead 0 de antes errava 2/7 e comia a folga inteira —
 * foi o que zerou o xarope de gengibre mesmo seguindo a sugestão.
 */
const LEAD_PADRAO = 2;

/**
 * `perda` = % de perda sistemática sobre a demanda teórica (ver migration 20260822).
 * Escala a demanda inteira — média E margem de segurança — o que é o mesmo que
 * `(media + desv×z) × (1+p)`: se o bar gasta 36% a mais do que a ficha diz, gasta 36% a mais
 * também nas semanas de pico. Não mexe no Nível de Serviço de propósito: NS é variância, perda
 * é viés, e misturar os dois esconde a perda do Desvio.
 */
/**
 * `consumoPais` = quanto os LOTES PLANEJADOS dos pais vão consumir deste preparo nesta semana.
 * Entra somando, não como aviso: é a metade "necessário para as produções" da conta do Gonza
 * — `uso direto + necessário nos pais planejados + indireto só dos pais SEM plano`. As duas
 * primeiras parcelas vêm daqui; a terceira já vem embutida em `media6`, que a rota monta a
 * partir de `saidas_base` (a explosão que NÃO atravessa produção planejada).
 */
function calcular(media6: number, desvpad: number, estoque: number, rendContagem: number, nivel: number, semanas: number, perda = 0, lead = LEAD_PADRAO, consumoPais = 0) {
  const k = 1 + (Number(perda) || 0) / 100;
  // Lead time: o estoque vem da contagem de SEGUNDA, mas a produção acontece dias depois. O PR
  // tem que cobrir a defasagem + o ciclo, senão os dias entre contagem e produção comem o estoque
  // que o plano contou como disponível. O desvpad fica na escala semanal de propósito (ver a
  // migration 20260822_plano_producao_lead_time).
  const janela = (7 + Math.max(0, Number(lead) || 0)) / 7;
  const mediaAj = media6 * janela * k;
  const pr = (media6 * janela + desvpad * zDe(nivel)) * k;
  const gap = pr + Math.max(0, Number(consumoPais) || 0) - estoque;
  const ae = gap < 0 ? gap : gap + mediaAj * ((semanas || 1) - 1); // semanas extras repõem a Média6s, não o PR cheio
  const naoProduzir = ae <= 0;
  const receitas = !naoProduzir && rendContagem > 0 ? Math.ceil(ae / rendContagem) : 0;
  return { pr: r2(pr), naoProduzir, receitas, sugestaoQtd: r2(receitas * rendContagem) };
}
function mediaPonderada(saidas: number[]) {
  let n = 0, d = 0;
  saidas.forEach((v, i) => { if (v > 0) { n += v * (i + 1); d += (i + 1); } });
  return d > 0 ? n / d : 0;
}
function desvioPadrao(saidas: number[]) {
  const k = saidas.length;
  if (k < 2) return 0;
  const m = saidas.reduce((s, v) => s + v, 0) / k;
  return Math.sqrt(saidas.reduce((s, v) => s + (v - m) ** 2, 0) / (k - 1));
}
// segunda-feira da semana que contém d
function semanaIniDe(d: Date) { const dow = (d.getDay() + 6) % 7; const m = new Date(d); m.setDate(d.getDate() - dow); return isoD(m); }
const addDias = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d + n)); return dt.toISOString().slice(0, 10); };

// Itens "ao vivo" da semana W: roda fn_plano_producao + aplica config + sugestão.
async function montarItensLive(barId: number, semanaIni: string) {
  const gold = (sb() as any).schema('gold');
  const [{ data }, { data: cfgs }] = await Promise.all([
    gold.rpc('fn_plano_producao', { p_bar: barId, p_semana: semanaIni }),
    ops().from('producao_plano_config').select('producao_id, nivel_servico, semanas_receita, fator_perda_pct, dias_ate_produzir').eq('bar_id', barId),
  ]);
  const cfgMap = new Map((cfgs || []).map((c: any) => [Number(c.producao_id), c]));
  return ((data || []) as any[]).map((r) => {
    // `saidas` = TOTAL (o que a venda puxa por qualquer caminho) — só leitura.
    // `saidas_base` = o que dimensiona: direto + indireto que NÃO atravessa produção planejada.
    //   Quando o pai está no plano, a necessidade do filho vem do lote dele (cascata), não das
    //   vendas passadas — senão o plano manda fazer recheio de coxinha sem fazer coxinha.
    const saidas = (r.saidas || []).map(num);
    const saidasBase = (r.saidas_base || r.saidas || []).map(num);
    // Recorte pedido pelo Gonza (22/08): quanto da saída é o que está escrito na ficha do produto
    // VENDIDO (nível 0) e quanto atravessa outro preparo. Não muda conta nenhuma — a média, o PR e
    // a sugestão seguem no TOTAL; isto é leitura.
    const saidasDiretas = (r.saidas_diretas || []).map(num);
    const media6 = mediaPonderada(saidasBase);
    const desvpad = desvioPadrao(saidasBase);
    const fator = num(r.fator_contagem) || 1;
    const rendContagem = r2(num(r.rendimento) / fator);
    const cfg = cfgMap.get(Number(r.producao_id)) as any;
    const nivel = cfg ? Number(cfg.nivel_servico) : 95;
    const semanas = cfg ? Number(cfg.semanas_receita) : 1;
    const perda = cfg ? num(cfg.fator_perda_pct) : 0;
    const lead = cfg ? num(cfg.dias_ate_produzir) : LEAD_PADRAO;
    const c = calcular(media6, desvpad, num(r.estoque_atual), rendContagem, nivel, semanas, perda, lead);
    return {
      producao_id: Number(r.producao_id), codigo: r.producao_cod, nome: r.producao_nome,
      unidade: r.unidade, curva_a: r.curva_a === true, controle_producao: r.controle_producao === true,
      rendimento: num(r.rendimento), fator, rend_contagem: rendContagem,
      estoque: num(r.estoque_atual), media6: r2(media6), desvpad: r2(desvpad),
      saidas, saidas_diretas: saidasDiretas, saidas_base: saidasBase,
      media6_direta: r2(mediaPonderada(saidasDiretas)),
      media6_indireta: r2(mediaPonderada(saidas.map((v: number, i: number) => Math.max(0, v - (saidasDiretas[i] || 0))))),
      media6_total: r2(mediaPonderada(saidas)),
      semanas: r.semanas || [],
      nivel_servico: nivel, semanas_receita: semanas, fator_perda_pct: perda, dias_ate_produzir: lead,
      pr: c.pr, sugestao_qtd: c.sugestaoQtd, sugestao_receitas: c.receitas, nao_produzir: c.naoProduzir,
    };
  });
}

/**
 * Lead MEDIDO: quantos dias, na prática, separam a contagem de segunda da PRIMEIRA produção da
 * semana. É o primeiro dia que importa — é ele que o estoque contado precisa alcançar; o que vier
 * depois já é reposição de um estoque recém-feito.
 *
 * Usa `inicio` (quando a produção ACONTECEU), nunca `criado_em` (quando lançaram): produção
 * lançada retroativa cairia na semana errada e inventaria um lead que não existe.
 *
 * Mediana, não média: uma semana em que produziram no domingo não pode puxar o item inteiro.
 */
async function leadMedido(barId: number, semanaIni: string): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const { data } = await ops().from('producao_execucao')
    .select('producao_id, inicio')
    .eq('bar_id', barId).eq('status', 'finalizada')
    .gte('inicio', `${addDias(semanaIni, -70)}T00:00:00`)
    .lt('inicio', `${addDias(semanaIni, 7)}T00:00:00`);

  // por produção → por semana → menor dia-da-semana visto
  const porProd = new Map<number, Map<string, number>>();
  for (const r of (data || []) as any[]) {
    if (!r.producao_id || !r.inicio) continue;
    // dia local (BRT) sem new Date() no formato ISO — o fuso jogaria produção da madrugada pro dia anterior
    const local = new Date(r.inicio).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const [y, m, d] = local.split('-').map(Number);
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = segunda
    const semana = addDias(local, -dow);
    const porSemana = porProd.get(Number(r.producao_id)) || new Map<string, number>();
    const atual = porSemana.get(semana);
    if (atual == null || dow < atual) porSemana.set(semana, dow);
    porProd.set(Number(r.producao_id), porSemana);
  }

  for (const [prodId, porSemana] of porProd) {
    const dias = [...porSemana.values()].sort((a, b) => a - b);
    if (dias.length < 2) continue;               // 1 semana só não é padrão, é acaso
    const meio = Math.floor(dias.length / 2);
    const mediana = dias.length % 2 ? dias[meio] : Math.round((dias[meio - 1] + dias[meio]) / 2);
    if (mediana > 0) out.set(prodId, mediana);
  }
  return out;
}

/**
 * Perda MEDIDA de cada produção: compara a demanda teórica com o consumo real de estoque numa
 * janela longa. É o número que a tela oferece pra preencher o "Perda %" — sem ele o campo vira
 * chute, e chute em ponto de ressuprimento é como o bar fica sem.
 *
 *   consumo_real = estoque_inicial + produzido − estoque_final     (o que sumiu do estoque)
 *   perda %      = (consumo_real − saída_teórica) / saída_teórica
 *
 * Janela longa (8 semanas) de propósito: semana a semana o número pula, porque a contagem é uma
 * foto de segunda e a produção pode cair do outro lado da fronteira. No agregado isso se anula.
 * `fn_desvios` usa a data de INÍCIO da produção (não a de lançamento) — produção lançada
 * retroativa entra na semana certa.
 */
async function perdaMedida(barId: number, semanaIni: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const ini = addDias(semanaIni, -56);
    const { data } = await (sb() as any).schema('gold')
      .rpc('fn_desvios', { p_bar: barId, p_ini: ini, p_fim: semanaIni });
    for (const r of (data || []) as any[]) {
      if (r.is_producao !== true) continue;
      const teorica = num(r.saida_teorica);
      const real = num(r.estoque_ini) + num(r.produzido) - num(r.estoque_fim_real);
      // Base pequena dá percentual selvagem: "Chá de Louro" com 0,12 L teóricos acusa 567% só
      // porque a contagem arredondou meio litro. Abaixo de 1 (na unidade de contagem) não mede.
      if (teorica < 1 || real <= 0) continue;
      const pct = ((real - teorica) / teorica) * 100;
      // Negativo = consumiu MENOS que o teórico. Não sugere nada: ou a ficha está folgada, ou
      // faltou registrar produção — e produção não registrada PUXA o real pra baixo. É por isso
      // que só o lado positivo é confiável: ele é um PISO da perda, não uma estimativa central.
      if (pct <= 0) continue;
      out.set(String(r.insumo_codigo).toUpperCase(), Math.round(Math.min(300, pct)));
    }
  } catch {
    // medir é um plus: se a RPC falhar, a tela mostra o campo sem sugestão em vez de quebrar
  }
  return out;
}

// BOM pai→filho (qtd do filho na un. contagem por receita do pai)
async function fetchBom(itens: any[]) {
  const idFator = new Map(itens.map((i) => [i.producao_id, i.fator]));
  const ids = new Set(itens.map((i) => i.producao_id));
  const { data: fichaProd } = await sb().from('producao_ficha_item')
    .select('producao_id, producao_ref, quantidade').eq('componente_tipo', 'producao').not('producao_ref', 'is', null);
  return ((fichaProd || []) as any[])
    .filter((f) => ids.has(Number(f.producao_id)) && ids.has(Number(f.producao_ref)))
    .map((f) => ({ pai: Number(f.producao_id), filho: Number(f.producao_ref), qtd_receita: r2(num(f.quantidade) / (Number(idFator.get(Number(f.producao_ref))) || 1)) }));
}
/**
 * Consumo que os LOTES dos pais puxam de cada filho. ITERA até convergir: uma passada só resolve
 * 1 nível, e Croquete → Massa Croquete → Carne de panela tem 2 — a Carne sairia zerada porque a
 * sugestão da Massa nasce 0 (uso direto zero) enquanto o consumo dela não estiver calculado.
 * Tem que bater com o `consumoMap` da tela: os dois números aparecem no mesmo lugar.
 */
function calcConsumo(itens: any[], bom: any[], decBy: Map<number, any>) {
  const receitasDe = (it: any, consumo: number) => {
    const d = decBy.get(it.producao_id);
    if (d?.decidido_receitas != null) return Number(d.decidido_receitas);
    return calcular(it.media6, it.desvpad, it.estoque, it.rend_contagem, it.nivel_servico,
      it.semanas_receita, it.fator_perda_pct, it.dias_ate_produzir, consumo).receitas;
  };
  let m = new Map<number, number>();
  for (let volta = 0; volta < 6; volta++) {
    const rec = new Map<number, number>(itens.map((it) => [it.producao_id, receitasDe(it, m.get(it.producao_id) || 0)]));
    const prox = new Map<number, number>();
    bom.forEach((b) => { const q = rec.get(b.pai) || 0; if (q > 0) prox.set(b.filho, (prox.get(b.filho) || 0) + q * b.qtd_receita); });
    const igual = prox.size === m.size && [...prox].every(([k, v]) => Math.abs((m.get(k) || 0) - v) < 0.0001);
    m = prox;
    if (igual) break;
  }
  return m;
}
// linha de snapshot (operations.producao_plano_item) → item da tela
const snapToItem = (s: any) => ({
  producao_id: Number(s.producao_id), codigo: s.producao_cod, nome: s.producao_nome,
  unidade: s.unidade, curva_a: s.curva_a === true, controle_producao: true,
  rend_contagem: num(s.rend_contagem), estoque: num(s.estoque),
  media6: num(s.media6), desvpad: num(s.desvpad), saidas: s.saidas || [], saidas_diretas: s.saidas_diretas || [],
  media6_direta: num(s.media6_direta), media6_indireta: num(s.media6_indireta), media6_total: num(s.media6_total),
  semanas: s.semanas_datas || [],
  nivel_servico: s.nivel_servico ?? 95, semanas_receita: num(s.semanas_receita) || 1,
  fator_perda_pct: num(s.fator_perda_pct), dias_ate_produzir: num(s.dias_ate_produzir),
  pr: num(s.ponto_ressupr), sugestao_qtd: num(s.sugestao_qtd), sugestao_receitas: s.sugestao_receitas ?? 0,
  nao_produzir: (s.sugestao_receitas ?? 0) <= 0, consumo: num(s.consumo), frozen: true,
  decisao: { decidido_receitas: s.decidido_receitas, decidido_qtd: s.decidido_qtd, dia_producao: s.dia_producao, seguiu_sugestao: s.seguiu_sugestao, motivo_override: s.motivo_override },
});

// ---------------------------------------------------------------------------
// GET: planejamento da semana selecionada (?semana=YYYY-MM-DD) + seletor de semanas.
//   ?hoje=1 → calendarização do dia (Controle de Produção).
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  if (sp.get('hoje')) {
    const hoje = isoD(new Date());
    const { data: planos } = await ops().from('producao_plano').select('id').eq('bar_id', barId).eq('status', 'encerrado').order('semana_ini', { ascending: false }).limit(8);
    const ids = (planos || []).map((p: any) => p.id);
    if (!ids.length) return NextResponse.json({ success: true, data: hoje, itens: [] });
    // itens de HOJE: por dia (multi-dia) + legado (dia_producao único). Produção com dia por
    // dia tem prioridade (usa a qtd do dia); o legado entra só se não houver linha por dia.
    const [{ data: itensLegado }, { data: diasHoje }] = await Promise.all([
      ops().from('producao_plano_item')
        .select('plano_id, producao_id, producao_cod, producao_nome, decidido_receitas, decidido_qtd, sugestao_qtd, dia_producao')
        .in('plano_id', ids).eq('dia_producao', hoje),
      ops().from('producao_plano_item_dia')
        .select('plano_id, producao_id, dia, decidido_receitas, decidido_qtd').in('plano_id', ids).eq('dia', hoje),
    ]);
    const nomeMap = new Map<string, any>();
    for (const it of (itensLegado || []) as any[]) nomeMap.set(`${it.plano_id}:${it.producao_id}`, it);
    // busca nome/cod das produções que só existem na tabela por-dia
    const faltamNome = (diasHoje || []).filter((d: any) => !nomeMap.has(`${d.plano_id}:${d.producao_id}`));
    if (faltamNome.length) {
      const { data: pais } = await ops().from('producao_plano_item')
        .select('plano_id, producao_id, producao_cod, producao_nome, sugestao_qtd')
        .in('plano_id', ids).in('producao_id', Array.from(new Set(faltamNome.map((d: any) => d.producao_id))));
      for (const p of (pais || []) as any[]) nomeMap.set(`${p.plano_id}:${p.producao_id}`, p);
    }
    const comDia = new Set((diasHoje || []).map((d: any) => `${d.plano_id}:${d.producao_id}`));
    const itensHoje: any[] = [];
    for (const d of (diasHoje || []) as any[]) {
      if (Number(d.decidido_receitas) <= 0) continue;
      const p = nomeMap.get(`${d.plano_id}:${d.producao_id}`) || {};
      itensHoje.push({ producao_id: d.producao_id, producao_cod: p.producao_cod ?? null, producao_nome: p.producao_nome ?? null, decidido_receitas: num(d.decidido_receitas), decidido_qtd: num(d.decidido_qtd), sugestao_qtd: p.sugestao_qtd ?? null, dia_producao: hoje });
    }
    // legado: só entra se a produção NÃO tem distribuição por dia
    for (const it of (itensLegado || []) as any[]) {
      if (comDia.has(`${it.plano_id}:${it.producao_id}`)) continue;
      itensHoje.push({ producao_id: it.producao_id, producao_cod: it.producao_cod, producao_nome: it.producao_nome, decidido_receitas: num(it.decidido_receitas), decidido_qtd: num(it.decidido_qtd), sugestao_qtd: it.sugestao_qtd, dia_producao: hoje });
    }
    return NextResponse.json({ success: true, data: hoje, itens: itensHoje });
  }

  // semanas com contagem (seletor)
  const gold = (sb() as any).schema('gold');
  const { data: semRows } = await gold.rpc('fn_semanas_com_contagem', { p_bar: barId });
  const comContagem: string[] = (semRows || []).map((r: any) => r.semana_ini);
  const latest = comContagem[0] || semanaIniDe(new Date());
  // lista do seletor: semanas com contagem + a próxima (bloqueada, aguardando contagem)
  const semanasDisponiveis = [
    { ini: addDias(latest, 7), fim: addDias(latest, 13), tem_contagem: false },
    ...comContagem.map((ini) => ({ ini, fim: addDias(ini, 6), tem_contagem: true })),
  ];
  // semana selecionada: ?semana= (se válida) senão a mais recente com contagem
  const pedida = sp.get('semana');
  const semanaSel = pedida && comContagem.includes(pedida) ? pedida : latest;
  const semana = { ini: semanaSel, fim: addDias(semanaSel, 6) };

  // Calendarização da semana p/ o Controle de Produção: itens dos planos ENCERRADOS
  // (o que foi finalizado e mandado produzir), com o dia e a quantidade decidida.
  if (sp.get('calendario')) {
    const { data: planos } = await ops().from('producao_plano')
      .select('id, area').eq('bar_id', barId).eq('semana_ini', semanaSel).eq('status', 'encerrado');
    const ids = (planos || []).map((p: any) => p.id);
    const areaDeId = new Map((planos || []).map((p: any) => [p.id, p.area]));
    let itensCal: any[] = [];
    if (ids.length) {
      const [{ data: its }, { data: diasRows }] = await Promise.all([
        ops().from('producao_plano_item')
          .select('plano_id, producao_id, producao_cod, producao_nome, decidido_receitas, decidido_qtd, dia_producao, unidade')
          .in('plano_id', ids),
        ops().from('producao_plano_item_dia')
          .select('plano_id, producao_id, dia, decidido_receitas, decidido_qtd').in('plano_id', ids),
      ]);
      // distribuição por dia por produção (multi-dia)
      const diasPorProd = new Map<string, any[]>();
      for (const d of (diasRows || []) as any[]) {
        const k = `${d.plano_id}:${d.producao_id}`;
        (diasPorProd.get(k) || diasPorProd.set(k, []).get(k)!).push(d);
      }
      // Cada item vira UMA entrada por dia (multi-dia) OU uma entrada no dia único (legado).
      // Toda entrada mantém 1 dia_producao → o Controle de Produção / cruzamentos não mudam.
      for (const it of (its || []) as any[]) {
        const dias = diasPorProd.get(`${it.plano_id}:${it.producao_id}`) || [];
        const area = areaDeId.get(it.plano_id) || 'Cozinha';
        if (dias.length) {
          for (const d of dias) {
            if (Number(d.decidido_receitas) <= 0) continue;
            itensCal.push({ ...it, area, dia_producao: d.dia, decidido_receitas: num(d.decidido_receitas), decidido_qtd: num(d.decidido_qtd) });
          }
        } else if (Number(it.decidido_receitas) > 0) {
          itensCal.push({ ...it, area });
        }
      }
    }
    return NextResponse.json({
      success: true, semana, semana_sel: semanaSel, semana_ativa: latest,
      semanas_disponiveis: semanasDisponiveis, itens: itensCal,
    });
  }

  const [{ data: evs }, { data: planosRows }] = await Promise.all([
    ops().from('feriados_eventos').select('data,nome').gte('data', semana.ini).lte('data', semana.fim),
    ops().from('producao_plano').select('*').eq('bar_id', barId).eq('semana_ini', semanaSel),
  ]);
  const planos: Record<string, any> = { Cozinha: null, Bar: null };
  (planosRows || []).forEach((p: any) => { planos[p.area || 'Cozinha'] = p; });

  const encerradoIds = (planosRows || []).filter((p: any) => p.status === 'encerrado').map((p: any) => p.id);
  const rascunhoIds = (planosRows || []).filter((p: any) => p.status === 'rascunho').map((p: any) => p.id);

  // itens: congelados (snapshot) p/ áreas encerradas; ao vivo p/ o resto
  const itens: any[] = [];
  if (encerradoIds.length) {
    const { data: snaps } = await ops().from('producao_plano_item').select('*').in('plano_id', encerradoIds);
    (snaps || []).forEach((s: any) => itens.push(snapToItem(s)));
  }
  const live = await montarItensLive(barId, semanaSel);
  const bom = await fetchBom(live);
  let decMap = new Map<number, any>();
  if (rascunhoIds.length) {
    const { data: items } = await ops().from('producao_plano_item').select('*').in('plano_id', rascunhoIds);
    decMap = new Map((items || []).map((it: any) => [Number(it.producao_id), it]));
  }
  for (const it of live) {
    if (planos[areaDe(it.codigo)]?.status === 'encerrado') continue; // já veio do snapshot
    itens.push({ ...it, decisao: decMap.get(it.producao_id) || null });
  }

  // distribuição por dia (multi-dia): anexa dias[] a cada item, por produção
  const planoIds = (planosRows || []).map((p: any) => p.id);
  if (planoIds.length) {
    const { data: diasRows } = await ops().from('producao_plano_item_dia')
      .select('producao_id, dia, decidido_receitas, decidido_qtd').in('plano_id', planoIds).order('dia', { ascending: true });
    const diasMap = new Map<number, any[]>();
    for (const d of (diasRows || []) as any[]) {
      const arr = diasMap.get(Number(d.producao_id)) || [];
      arr.push({ dia: d.dia, decidido_receitas: num(d.decidido_receitas), decidido_qtd: num(d.decidido_qtd) });
      diasMap.set(Number(d.producao_id), arr);
    }
    for (const it of itens) it.dias = diasMap.get(Number(it.producao_id)) || [];
  } else {
    for (const it of itens) it.dias = [];
  }

  const [medida, leads] = await Promise.all([perdaMedida(barId, semanaSel), leadMedido(barId, semanaSel)]);
  for (const it of itens) {
    it.perda_medida_pct = medida.get(String(it.codigo || '').toUpperCase()) ?? null;
    it.lead_medido = leads.get(Number(it.producao_id)) ?? null;
  }

  return NextResponse.json({
    success: true,
    semana, semana_sel: semanaSel, semana_ativa: latest, semanas_disponiveis: semanasDisponiveis,
    contagem: { data: comContagem.includes(semanaSel) ? semanaSel : null },
    planos,
    eventos: (evs || []).map((e: any) => ({ data: e.data, nome: e.nome })),
    bom, itens,
  });
}

// ---------------------------------------------------------------------------
// POST: config / flag / iniciar / decidir / encerrar / reabrir
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const barId = Number(user.bar_id);
  if (!barId) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const quem = user.email ?? user.nome ?? null;

  switch (body.action) {
    case 'config': {
      const producaoId = Number(body.producao_id);
      if (!producaoId) return NextResponse.json({ success: false, error: 'producao_id obrigatório' }, { status: 400 });
      const patch: any = { bar_id: barId, producao_id: producaoId, producao_cod: body.producao_cod ?? null, atualizado_em: new Date().toISOString(), atualizado_por: quem };
      if (body.nivel_servico != null) patch.nivel_servico = Number(body.nivel_servico);
      if (body.semanas_receita != null) patch.semanas_receita = Number(body.semanas_receita);
      if (body.dias_ate_produzir != null) {
        patch.dias_ate_produzir = Math.min(14, Math.max(0, Math.round(Number(body.dias_ate_produzir) || 0)));
      }
      if (body.fator_perda_pct != null) {
        // clamp defensivo: o check do banco recusa fora de 0..300 e o erro sairia cru na tela
        patch.fator_perda_pct = Math.min(300, Math.max(0, Number(body.fator_perda_pct) || 0));
      }
      const { error } = await ops().from('producao_plano_config').upsert(patch, { onConflict: 'bar_id,producao_id' });
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'flag': {
      const id = Number(body.producao_id);
      if (!id) return NextResponse.json({ success: false, error: 'producao_id obrigatório' }, { status: 400 });
      const { error } = await sb().from('producao_base').update({ controle_producao: !!body.controle_producao, atualizado_em: new Date().toISOString() }).eq('id', id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'iniciar': {
      const area = body.area === 'Bar' ? 'Bar' : 'Cozinha';
      const semanaIni = String(body.semana || '');
      if (!semanaIni) return NextResponse.json({ success: false, error: 'semana obrigatória' }, { status: 400 });
      // gate: só dá pra planejar a semana ATIVA (a mais recente com contagem). Anteriores = só consulta.
      const { data: sem } = await (sb() as any).schema('gold').rpc('fn_semanas_com_contagem', { p_bar: barId });
      const weeks = (sem || []).map((s: any) => s.semana_ini);
      if (!weeks.includes(semanaIni)) return NextResponse.json({ success: false, error: `A semana ${semanaIni.split('-').reverse().join('/')} ainda não fechou (sem contagem).` }, { status: 409 });
      if (semanaIni !== weeks[0]) return NextResponse.json({ success: false, error: `Só dá pra planejar a semana mais recente (${String(weeks[0]).split('-').reverse().join('/')}). Semanas anteriores são só consulta.` }, { status: 409 });
      const { data: plano, error } = await ops().from('producao_plano')
        .upsert({ bar_id: barId, semana_ini: semanaIni, area, status: 'rascunho', contagem_data: semanaIni, iniciado_por: quem }, { onConflict: 'bar_id,semana_ini,area' })
        .select().single();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, plano });
    }
    case 'decidir': {
      const planoId = Number(body.plano_id);
      const producaoId = Number(body.producao_id);
      if (!planoId || !producaoId) return NextResponse.json({ success: false, error: 'plano_id e producao_id obrigatórios' }, { status: 400 });
      const row: any = {
        plano_id: planoId, producao_id: producaoId,
        producao_cod: body.producao_cod ?? null, producao_nome: body.producao_nome ?? null,
        media6: body.media6 ?? null, desvpad: body.desvpad ?? null,
        nivel_servico: body.nivel_servico ?? null, fator_servico: body.nivel_servico != null ? zDe(Number(body.nivel_servico)) : null,
        fator_perda_pct: body.fator_perda_pct ?? null,
        dias_ate_produzir: body.dias_ate_produzir ?? null,
        ponto_ressupr: body.ponto_ressupr ?? null, estoque: body.estoque ?? null,
        sugestao_qtd: body.sugestao_qtd ?? null, sugestao_receitas: body.sugestao_receitas ?? null,
        decidido_receitas: body.decidido_receitas != null ? Number(body.decidido_receitas) : null,
        decidido_qtd: body.decidido_qtd != null ? Number(body.decidido_qtd) : null,
        seguiu_sugestao: body.seguiu_sugestao != null ? !!body.seguiu_sugestao : true,
        motivo_override: body.motivo_override ?? null, dia_producao: body.dia_producao ?? null,
        atualizado_em: new Date().toISOString(),
      };
      const { error } = await ops().from('producao_plano_item').upsert(row, { onConflict: 'plano_id,producao_id' });
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    // decidir MULTI-DIA: distribui a produção da semana em vários dias (qtd por dia).
    // O item-pai vira o TOTAL (soma dos dias); a distribuição vai pra producao_plano_item_dia.
    case 'decidir_dias': {
      const planoId = Number(body.plano_id);
      const producaoId = Number(body.producao_id);
      if (!planoId || !producaoId) return NextResponse.json({ success: false, error: 'plano_id e producao_id obrigatórios' }, { status: 400 });
      const rend = num(body.rend_contagem);
      // dias válidos: { dia: 'YYYY-MM-DD', receitas: n>0 }
      const dias = (Array.isArray(body.dias) ? body.dias : [])
        .map((d: any) => ({ dia: String(d.dia || ''), receitas: Math.max(0, Number(d.receitas) || 0) }))
        .filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d.dia) && d.receitas > 0);
      const totalRec = dias.reduce((s: number, d: any) => s + d.receitas, 0);
      const diaUnico = dias.length === 1 ? dias[0].dia : null; // legado: 1 dia mantém dia_producao preenchido
      const row: any = {
        plano_id: planoId, producao_id: producaoId,
        producao_cod: body.producao_cod ?? null, producao_nome: body.producao_nome ?? null,
        media6: body.media6 ?? null, desvpad: body.desvpad ?? null,
        nivel_servico: body.nivel_servico ?? null, fator_servico: body.nivel_servico != null ? zDe(Number(body.nivel_servico)) : null,
        fator_perda_pct: body.fator_perda_pct ?? null,
        dias_ate_produzir: body.dias_ate_produzir ?? null,
        ponto_ressupr: body.ponto_ressupr ?? null, estoque: body.estoque ?? null,
        sugestao_qtd: body.sugestao_qtd ?? null, sugestao_receitas: body.sugestao_receitas ?? null,
        decidido_receitas: totalRec, decidido_qtd: r2(totalRec * rend),
        seguiu_sugestao: body.sugestao_receitas != null ? totalRec === Number(body.sugestao_receitas) : true,
        motivo_override: body.motivo_override ?? null, dia_producao: diaUnico,
        atualizado_em: new Date().toISOString(),
      };
      const { error: eItem } = await ops().from('producao_plano_item').upsert(row, { onConflict: 'plano_id,producao_id' });
      if (eItem) return NextResponse.json({ success: false, error: eItem.message }, { status: 500 });
      // substitui a distribuição por dia (apaga + reinsere)
      const { error: eDel } = await ops().from('producao_plano_item_dia').delete().eq('plano_id', planoId).eq('producao_id', producaoId);
      if (eDel) return NextResponse.json({ success: false, error: eDel.message }, { status: 500 });
      if (dias.length) {
        const diaRows = dias.map((d: any) => ({ plano_id: planoId, producao_id: producaoId, dia: d.dia, decidido_receitas: d.receitas, decidido_qtd: r2(d.receitas * rend), atualizado_em: new Date().toISOString() }));
        const { error: eIns } = await ops().from('producao_plano_item_dia').insert(diaRows);
        if (eIns) return NextResponse.json({ success: false, error: eIns.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, total_receitas: totalRec, dias: dias.length });
    }
    case 'encerrar': {
      const planoId = Number(body.plano_id);
      if (!planoId) return NextResponse.json({ success: false, error: 'plano_id obrigatório' }, { status: 400 });
      const { data: plano } = await ops().from('producao_plano').select('*').eq('id', planoId).eq('bar_id', barId).single();
      if (!plano) return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
      // congela TODOS os itens da área: snapshot completo (sem recalcular depois)
      const live = await montarItensLive(barId, plano.semana_ini);
      const bom = await fetchBom(live);
      const { data: decs } = await ops().from('producao_plano_item').select('*').eq('plano_id', planoId);
      const decBy = new Map<number, any>((decs || []).map((d: any) => [Number(d.producao_id), d]));
      const consumo = calcConsumo(live, bom, decBy);
      const rows = live.filter((it) => areaDe(it.codigo) === plano.area).map((it) => {
        const d = decBy.get(it.producao_id) as any;
        // Recalcula a sugestão COM o consumo dos pais planejados: o `it` veio de montarItensLive,
        // que roda antes do bom existir. Sem isto o snapshot congelaria um número diferente do
        // que a reunião viu na tela.
        const cp = consumo.get(it.producao_id) || 0;
        const rec = calcular(it.media6, it.desvpad, it.estoque, it.rend_contagem, it.nivel_servico,
          it.semanas_receita, it.fator_perda_pct, it.dias_ate_produzir, cp);
        const decididoRec = d?.decidido_receitas != null ? Number(d.decidido_receitas) : rec.receitas;
        return {
          plano_id: planoId, producao_id: it.producao_id, producao_cod: it.codigo, producao_nome: it.nome,
          media6: it.media6, desvpad: it.desvpad, nivel_servico: it.nivel_servico, fator_servico: zDe(it.nivel_servico),
          fator_perda_pct: it.fator_perda_pct ?? 0, dias_ate_produzir: it.dias_ate_produzir ?? 0,
          ponto_ressupr: rec.pr, estoque: it.estoque, sugestao_qtd: rec.sugestaoQtd, sugestao_receitas: rec.receitas,
          decidido_receitas: decididoRec, decidido_qtd: r2(decididoRec * it.rend_contagem),
          seguiu_sugestao: decididoRec === rec.receitas, motivo_override: d?.motivo_override ?? null,
          dia_producao: d?.dia_producao ?? null,
          unidade: it.unidade, rend_contagem: it.rend_contagem, semanas_receita: it.semanas_receita, curva_a: it.curva_a,
          consumo: r2(consumo.get(it.producao_id) || 0), saidas: it.saidas, semanas_datas: it.semanas,
          saidas_diretas: it.saidas_diretas, media6_direta: it.media6_direta,
          media6_indireta: it.media6_indireta, media6_total: it.media6_total,
          atualizado_em: new Date().toISOString(),
        };
      });
      if (rows.length) {
        const { error: e1 } = await ops().from('producao_plano_item').upsert(rows, { onConflict: 'plano_id,producao_id' });
        if (e1) return NextResponse.json({ success: false, error: e1.message }, { status: 500 });
      }
      const { error } = await ops().from('producao_plano').update({ status: 'encerrado', encerrado_por: quem, encerrado_em: new Date().toISOString() }).eq('id', planoId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'reabrir': {
      const planoId = Number(body.plano_id);
      if (!planoId) return NextResponse.json({ success: false, error: 'plano_id obrigatório' }, { status: 400 });
      const { error } = await ops().from('producao_plano').update({ status: 'rascunho', encerrado_por: null, encerrado_em: null }).eq('id', planoId).eq('bar_id', barId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'cancelar': {
      const planoId = Number(body.plano_id);
      if (!planoId) return NextResponse.json({ success: false, error: 'plano_id obrigatório' }, { status: 400 });
      // apaga o plano e seus itens (cascade); usado p/ descartar um planejamento iniciado por engano
      const { error } = await ops().from('producao_plano').delete().eq('id', planoId).eq('bar_id', barId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
  }
}
