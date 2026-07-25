/**
 * 🚨 Detector de Fraude/Desvio (H3)
 *
 * Roda diário pela noite. Pra cada bar ativo + dia D-1 detecta:
 *
 *   1. desconto_alto: itens com desconto > 30% do valorfinal
 *   2. desconto_funcionario: usr_lancou com soma_desc/soma_valor > 8% (média típica deve ser <3%)
 *   3. item_negativo: itens com qtd < 0 (remoção tardia)
 *   4. mesa_longa: vd_mesadesc com último lançamento > 12h após primeiro
 *
 * Insere alertas em integridade.alertas.
 * Manda pro Discord os críticos (severidade='alta'|'critica').
 *
 * Body: { bar_id?, data?, discord? }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireInternalAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const DISCORD_WEBHOOK = Deno.env.get('DISCORD_WEBHOOK_INTEGRIDADE');

interface Alerta {
  bar_id: number;
  data_referencia: string;
  tipo: string;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  titulo: string;
  descricao?: string;
  entidade?: string;
  valor_envolvido?: number;
  detalhes?: any;
}

async function detectarParaBar(supabase: any, barId: number, data: string): Promise<Alerta[]> {
  const alertas: Alerta[] = [];

  // Whitelist de funcionarios autorizados a dar desconto (recepcao, admin, etc)
  const { data: whitelistRows } = await supabase
    .schema('integridade').from('funcionarios_whitelist')
    .select('usr_lancou').eq('bar_id', barId).eq('ativo', true);
  const whitelist = new Set<string>((whitelistRows ?? []).map((r: any) => r.usr_lancou));

  // Limiares POR BAR. Era 8% fixo pra todo mundo, com a premissa de "media tipica ~3%".
  // Medindo 57 dias: a mediana do Ordinario e' 3,3% (premissa certa) mas a do Deboche e' 7,4%,
  // ou seja, o limiar caia praticamente em cima da mediana e 46% dos dias-funcionario passavam.
  // Alerta que dispara pra metade da operacao ninguem lê. Semeado com o p95 de cada casa.
  const { data: paramRow } = await supabase
    .schema('integridade').from('parametros_bar')
    .select('limiar_desconto, limiar_cortesia_qtd, limiar_cortesia_valor, fator_dia_evento')
    .eq('bar_id', barId).maybeSingle();
  const LIMIAR_DESCONTO = Number(paramRow?.limiar_desconto ?? 0.08);

  // Dia de evento grande tem cortesia por natureza (entrada franca, lista, produção, convidado).
  // Marcador: houve venda Yuzer no dia. Medido em 57 dias no Ordinário — dia normal faz 24,6
  // cortesias e NUNCA passou de 60; dia com Yuzer faz 157,8 em média. Sem esse contexto o
  // detector acusava todo evento grande como anomalia (os "outliers" de 13/06 a 05/07 eram
  // todos dias de Yuzer entre R$ 87 mil e R$ 112 mil — operação normal, não desvio).
  const { data: yuzerDia } = await supabase
    .schema('silver').from('yuzer_pagamentos_evento')
    .select('faturamento_bruto').eq('bar_id', barId).eq('data_evento', data)
    .gt('faturamento_bruto', 1000).limit(1);
  const diaDeEvento = Array.isArray(yuzerDia) && yuzerDia.length > 0;
  const fator = diaDeEvento ? Number(paramRow?.fator_dia_evento ?? 6) : 1;

  const LIMIAR_CORT_QTD = Number(paramRow?.limiar_cortesia_qtd ?? 5) * fator;
  const LIMIAR_CORT_VLR = Number(paramRow?.limiar_cortesia_valor ?? 500) * fator;
  if (diaDeEvento) console.log(`[fraude] bar ${barId} ${data}: dia de evento (Yuzer) — limiar de cortesia x${fator}`);

  // Itens do dia — PAGINADO.
  //
  // Aqui havia um `.limit(20000)` que nao servia pra nada: o PostgREST tem teto proprio de 1000
  // linhas por resposta e ignora limite maior. Num dia normal o Ordinario tem ~3.200 itens, ou
  // seja, o detector analisava 31% do movimento e concluia que estava tudo bem. Como o erro da
  // query tambem nao era checado, o resultado era sempre "0 alertas" com status de sucesso —
  // ficou assim de 29/05 a 25/07/2026 sem ninguem perceber.
  //
  // Truncar aqui e' pior do que parece: as regras 2 e 4 sao AGREGADAS por funcionario/mesa, entao
  // uma amostra parcial nao "acha menos", ela acha errado — dilui quem concentra desconto.
  const PAGINA = 1000;
  const itens: any[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data: lote, error } = await supabase
      .schema('gold').from('gold_contahub_avendas_porproduto_analitico')
      .select('id, vd_mesadesc, itm, trn, trn_desc, usr_lancou, prd_desc, qtd, desconto, valorfinal, comandaorigem')
      .eq('bar_id', barId).eq('trn_dtgerencial', data)
      .order('id', { ascending: true })
      .range(inicio, inicio + PAGINA - 1);

    if (error) {
      // Falhar alto: melhor o job acusar erro do que jurar que o dia esta limpo.
      console.error(`[fraude] bar ${barId} ${data}: erro lendo itens`, error);
      throw new Error(`falha lendo itens do bar ${barId}: ${error.message}`);
    }
    if (!lote || lote.length === 0) break;
    itens.push(...lote);
    if (lote.length < PAGINA) break;
  }

  if (itens.length === 0) return alertas;
  console.log(`[fraude] bar ${barId} ${data}: ${itens.length} itens analisados`);

  // 1) Cortesias por funcionario: alerta apenas se MESMO gar deu > 5 OU cortesia individual > R$ 200
  const cortesiasPorUsr: Record<string, { qtd: number; valor: number; items: any[] }> = {};
  const descontosAltosNaoCortesia: any[] = [];

  for (const i of itens) {
    const v = Number(i.valorfinal) || 0;
    const d = Number(i.desconto) || 0;
    if (d < 30) continue;
    const usr = i.usr_lancou || 'desconhecido';
    if (whitelist.has(usr)) continue; // ignora autorizados

    if (v === 0) {
      // Cortesia 100%
      cortesiasPorUsr[usr] ??= { qtd: 0, valor: 0, items: [] };
      cortesiasPorUsr[usr].qtd++;
      cortesiasPorUsr[usr].valor += d;
      cortesiasPorUsr[usr].items.push(i);
      // Cortesia GIGANTE individual (>R$200) gera alerta direto
      if (d > 200) {
        alertas.push({
          bar_id: barId, data_referencia: data,
          tipo: 'cortesia_alta',
          severidade: d > 500 ? 'alta' : 'media',
          titulo: `Cortesia grande: ${i.prd_desc} (R$ ${d.toFixed(2)})`,
          descricao: `Mesa ${i.vd_mesadesc} · ${usr}`,
          entidade: usr, valor_envolvido: d, detalhes: i,
        });
      }
    } else if (d / v > 0.3) {
      descontosAltosNaoCortesia.push(i);
    }
  }

  // Cortesias acumuladas: limiar por bar (integridade.parametros_bar)
  for (const [usr, stat] of Object.entries(cortesiasPorUsr)) {
    if (stat.qtd > LIMIAR_CORT_QTD || stat.valor > LIMIAR_CORT_VLR) {
      alertas.push({
        bar_id: barId, data_referencia: data,
        tipo: 'cortesia_volume',
        severidade: stat.valor > 1000 ? 'alta' : 'media',
        titulo: `${usr} deu ${stat.qtd} cortesias (R$ ${stat.valor.toFixed(2)})`,
        descricao: `${stat.qtd} cortesias 100% off. Items: ${stat.items.slice(0,3).map(i => i.prd_desc).join(', ')}${stat.items.length > 3 ? '...' : ''}`,
        entidade: usr, valor_envolvido: stat.valor,
        detalhes: { qtd: stat.qtd, valor: stat.valor, items_sample: stat.items.slice(0, 10) },
      });
    }
  }

  // Descontos altos NAO cortesia (>30% do valor) — alerta direto pra >R$80
  for (const i of descontosAltosNaoCortesia.filter((x: any) => Number(x.desconto) > 80).slice(0, 30)) {
    const v = Number(i.valorfinal) || 0;
    const d = Number(i.desconto) || 0;
    const pct = (d / v * 100).toFixed(1);
    alertas.push({
      bar_id: barId, data_referencia: data,
      tipo: 'desconto_alto',
      severidade: d > 200 ? 'alta' : 'media',
      titulo: `Desconto ${pct}% no item ${i.prd_desc}`,
      descricao: `Mesa ${i.vd_mesadesc} · ${i.usr_lancou} · R$ ${d.toFixed(2)} de R$ ${(d + v).toFixed(2)}`,
      entidade: i.usr_lancou, valor_envolvido: d, detalhes: i,
    });
  }

  // 2) Funcionário com taxa de desconto anormal (ignora whitelist)
  const porUsr: Record<string, { soma_valor: number; soma_desc: number; itens: number }> = {};
  for (const i of itens) {
    const u = i.usr_lancou || 'desconhecido';
    if (whitelist.has(u)) continue;
    porUsr[u] ??= { soma_valor: 0, soma_desc: 0, itens: 0 };
    porUsr[u].soma_valor += Number(i.valorfinal) || 0;
    porUsr[u].soma_desc += Number(i.desconto) || 0;
    porUsr[u].itens++;
  }
  for (const [usr, stat] of Object.entries(porUsr)) {
    if (stat.soma_valor < 500 || stat.itens < 20) continue;
    const taxa = stat.soma_desc / stat.soma_valor;
    if (taxa > LIMIAR_DESCONTO) {
      alertas.push({
        bar_id: barId, data_referencia: data,
        tipo: 'desconto_funcionario',
        severidade: taxa > LIMIAR_DESCONTO * 1.9 ? 'critica' : 'alta',
        titulo: `${usr} aplicou ${(taxa * 100).toFixed(1)}% de desconto`,
        descricao: `R$ ${stat.soma_desc.toFixed(2)} em descontos de R$ ${stat.soma_valor.toFixed(2)} em vendas (${stat.itens} itens). Limite deste bar: ${(LIMIAR_DESCONTO * 100).toFixed(1)}%.`,
        entidade: usr,
        valor_envolvido: stat.soma_desc,
        detalhes: { ...stat, taxa_pct: taxa * 100 },
      });
    }
  }

  // 3) Itens negativos (qtd<0 = remoção tardia)
  const negativos = itens.filter((i: any) => Number(i.qtd) < 0);
  if (negativos.length >= 5) {
    const porUsrNeg: Record<string, number> = {};
    let valorTotal = 0;
    for (const i of negativos) {
      const u = i.usr_lancou || 'desconhecido';
      porUsrNeg[u] = (porUsrNeg[u] ?? 0) + (Math.abs(Number(i.valorfinal)) || 0);
      valorTotal += Math.abs(Number(i.valorfinal)) || 0;
    }
    const topUsr = Object.entries(porUsrNeg).sort((a, b) => b[1] - a[1])[0];
    alertas.push({
      bar_id: barId, data_referencia: data,
      tipo: 'item_negativo',
      severidade: negativos.length > 30 || valorTotal > 1000 ? 'alta' : 'media',
      titulo: `${negativos.length} itens removidos (R$ ${valorTotal.toFixed(2)})`,
      descricao: `Maior responsável: ${topUsr?.[0]} com R$ ${topUsr?.[1].toFixed(2)}.`,
      entidade: topUsr?.[0],
      valor_envolvido: valorTotal,
      detalhes: { total_removidos: negativos.length, por_usr: porUsrNeg },
    });
  }

  // 4) Mesa longa - usa trn_desc se conter horário, ou inferimos por id sequencial
  // (Sem timestamp granular nessa tabela; pulamos por agora)

  return alertas;
}

async function discord(alertas: Alerta[]) {
  if (!DISCORD_WEBHOOK) return;
  const criticos = alertas.filter(a => a.severidade === 'alta' || a.severidade === 'critica');
  if (!criticos.length) return;
  const embeds = criticos.slice(0, 8).map(a => ({
    title: `🚨 ${a.titulo}`,
    description: a.descricao,
    color: a.severidade === 'critica' ? 0xff0000 : 0xff9900,
    fields: [
      { name: 'Bar', value: String(a.bar_id), inline: true },
      { name: 'Data', value: a.data_referencia, inline: true },
      { name: 'Valor', value: `R$ ${a.valor_envolvido?.toFixed(2) ?? '?'}`, inline: true },
    ],
  }));
  await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `**${criticos.length} alertas de integridade críticos**`, embeds }),
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = await requireInternalAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const filterBarId: number | undefined = body?.bar_id;
    const data: string = body?.data ?? new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const usarDiscord: boolean = body?.discord ?? true;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let q = supabase.schema('operations').from('bares').select('id, nome').eq('ativo', true);
    if (filterBarId) q = q.eq('id', filterBarId);
    const { data: bares } = await q;

    const resultados: any[] = [];

    for (const bar of (bares ?? [])) {
      const alertas = await detectarParaBar(supabase, bar.id, data);

      if (alertas.length > 0) {
        await supabase.schema('integridade').from('alertas').insert(alertas);
      }
      if (usarDiscord) await discord(alertas);

      resultados.push({
        bar_id: bar.id, nome: bar.nome,
        alertas_total: alertas.length,
        criticos: alertas.filter(a => a.severidade === 'critica' || a.severidade === 'alta').length,
      });
    }

    return new Response(JSON.stringify({ success: true, data, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
