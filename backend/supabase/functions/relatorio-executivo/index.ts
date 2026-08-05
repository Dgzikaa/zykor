/**
 * 📋 Relatório Executivo Cross-Área (H1)
 *
 * Coleta de cada bar ativo, na semana indicada:
 *   - Vendas (gold.desempenho)
 *   - CMV semanal + comparativo
 *   - CMO (mão de obra)
 *   - IG snapshot (followers, reach, engagement)
 *   - NPS médio (salao, digital, reservas, geral)
 *   - Quality Scorecard
 *   - Stockout médio
 *   - Alertas IG ativos
 *   - Clube Ordi (VIPs dormindo)
 *   - Previsões próximas
 *
 * Manda pro Claude Sonnet 4.6 → 5-7 paragrafos executivos.
 *
 * Salva em gold.relatorios_executivos.
 * Body: { bar_id?, semana_ini?, semana_fim?, enviar_discord? }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireInternalAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODELO = 'claude-sonnet-5';

async function coletarSnapshot(supabase: any, barId: number, di: string, df: string) {
  // 1) Desempenho semanal (atual + anterior)
  const { data: desempenho } = await supabase
    .schema('gold').from('desempenho')
    .select('numero_semana, ano, data_inicio, data_fim, faturamento_total, clientes_atendidos, ticket_medio, nps_geral, nps_salao, nps_digital, nps_reservas, stockout_total_perc, atrasos_comida_perc, atrasos_drinks_perc, cmv_global_real, cmo, reservas_quebra_pct, nota_felicidade_equipe, tempo_cozinha, tempo_drinks')
    .eq('bar_id', barId).eq('granularidade', 'semanal')
    .gte('data_inicio', di).lte('data_fim', df).order('data_fim');

  const atual = desempenho?.[0] ?? null;

  // 2) Semana anterior pra comparativo
  const diAnt = new Date(new Date(di).getTime() - 7 * 86400000).toISOString().split('T')[0];
  const dfAnt = new Date(new Date(df).getTime() - 7 * 86400000).toISOString().split('T')[0];
  const { data: anteriorArr } = await supabase
    .schema('gold').from('desempenho')
    .select('faturamento_total, clientes_atendidos, ticket_medio, nps_geral, stockout_total_perc, cmv_global_real')
    .eq('bar_id', barId).eq('granularidade', 'semanal')
    .gte('data_inicio', diAnt).lte('data_fim', dfAnt).limit(1);
  const anterior = anteriorArr?.[0] ?? null;

  // 3) Quality score
  const { data: quality } = await supabase
    .schema('gold').from('quality_scorecard')
    .select('score, comp_nps_geral, comp_stockout, comp_atrasos, comp_reservas')
    .eq('bar_id', barId).gte('data_inicio', di).lte('data_fim', df).maybeSingle();

  // 4) IG snapshot
  const { data: ig } = await supabase
    .schema('integrations').from('instagram_conta_metricas')
    .select('data_snapshot, followers_count, reach, impressions, profile_views, total_interactions, accounts_engaged')
    .eq('bar_id', barId).order('data_snapshot', { ascending: false }).limit(2);

  // 5) Top posts da semana
  const { data: posts } = await supabase
    .schema('integrations').from('instagram_posts')
    .select('ig_media_id, media_type, media_product_type, caption, like_count, comments_count')
    .eq('bar_id', barId).gte('timestamp_post', `${di}T00:00:00`).lte('timestamp_post', `${df}T23:59:59`);

  // 6) Alertas IG ativos
  const { data: alertas } = await supabase
    .schema('integrations').from('instagram_alertas')
    .select('tipo, severidade, titulo').eq('bar_id', barId).eq('resolvido', false)
    .gte('criado_em', `${di}T00:00:00`).order('criado_em', { ascending: false }).limit(10);

  // 7) Clube: VIPs dormindo
  const { data: vipsDormindo } = await supabase
    .schema('crm').from('clube_ordi_membros')
    .select('cliente_fone_norm, cliente_nome, nivel, dias_inativo, valor_total_consumo, ultima_visita')
    .eq('bar_id', barId).in('nivel', ['diamante', 'ouro']).eq('segmento', 'dormindo')
    .order('valor_total_consumo', { ascending: false }).limit(10);

  // 8) Previsão prox 7 dias
  const { data: previsoes } = await supabase
    .schema('gold').from('demanda_previsoes')
    .select('data_evento, fat_previsto, publico_previsto').eq('bar_id', barId)
    .gte('data_evento', df).order('data_evento').limit(7);

  return {
    periodo: { ini: di, fim: df },
    desempenho_atual: atual,
    desempenho_anterior: anterior,
    quality_score: quality?.score ?? null,
    instagram_d_anterior: ig?.[0] ?? null,
    instagram_d_anterior_minus_1: ig?.[1] ?? null,
    posts_semana_total: posts?.length ?? 0,
    alertas_ig_ativos: alertas ?? [],
    vips_dormindo_top10: vipsDormindo ?? [],
    previsoes_proximos_7d: previsoes ?? [],
  };
}

/**
 * Prompt unico do relatorio. Usado tanto pela geracao semanal quanto pelo
 * reprocessamento dos vazios — os dois PRECISAM sair no mesmo formato.
 */
function montarPrompt(nomeBar: string, di: string, df: string, snap: any): string {
  return `Você é o **Diretor de BI** dos bares Grupo Menos e Mais. Gere um RELATÓRIO EXECUTIVO SEMANAL pro **${nomeBar}** com base em DADOS REAIS.

Período: **${di} a ${df}**

⚠️ UNIDADES E CONVENÇÕES IMPORTANTES (não interpretar errado):
- **tempo_cozinha** e **tempo_drinks** estão em **SEGUNDOS** (não minutos). Ex: 546 = ~9 minutos, 153 = ~2,5 minutos.
- **NPS Geral está MORTO** (não existe mais). Não cite "NPS Geral sem dado". Use **NPS Digital** como NPS principal (peso 25% no Quality Score).
- **NPS Salão** tem volume pequeno (poucas respostas) — se for menos de 5 respostas, mencione amostra pequena, evite afirmar "100" como verdade.
- Faturamento em R$. Atrasos/stockout em %. CMV global real em decimal (0.32 = 32%).
- Se métrica está NULL no snapshot, diga "não medido nesta semana" e NÃO use no peso do score.

DADOS BRUTOS (snapshot da semana do relatório):
${JSON.stringify(snap, null, 2)}

ESTRUTURA OBRIGATÓRIA do relatório (markdown, parágrafos curtos):

## 📊 Resumo do Período
Frase única com o headline da semana (subiu/caiu, melhor/pior).

## 💰 Vendas e Faturamento
Número absoluto + comparativo % vs semana anterior. Ticket médio. Público.

## 🍔 Eficiência Operacional
CMV real vs teórico. CMO. Stockout. Atrasos cozinha + drinks.

## 😊 Satisfação e Qualidade
NPS geral + por canal. Quality Score atual. Felicidade equipe.

## 📱 Instagram e Marketing
Followers, reach, engagement, top posts. Alertas se houver.

## 🚨 Atenções e Riscos
Liste 2-4 problemas reais com gravidade. Use dados específicos.

## 🎯 Recomendações da Semana
3 ações concretas, mensuráveis, pra esta semana. Aponte responsável quando possível.

## 🔮 O que esperar
Use as previsões pros próximos dias.

Tom: direto, números reais, sem floreio, máximo 800 palavras. Pt-BR.`;
}

async function chamarClaude(prompt: string): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente');
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODELO,
      // No Sonnet 5 o thinking conta dentro do max_tokens: 3500 (o valor antigo, de
      // quando nao havia thinking) corta o relatorio no meio. Effort medium ja da
      // conta de um resumo de 800 palavras sem gastar demais.
      max_tokens: 12000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic: ${await r.text()}`);
  const j = await r.json();
  // A resposta vem em BLOCOS. No Sonnet 5 o thinking eh ligado por padrao, entao
  // content[0] eh o bloco de raciocinio (texto vazio) e nao o relatorio — era isso
  // que gravava resumo_executivo vazio desde a migracao pro Sonnet 5 (06/07/2026).
  const text = (j.content ?? [])
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b.text ?? '')
    .join('\n')
    .trim();
  if (!text) {
    throw new Error(`Claude nao retornou texto (stop_reason=${j.stop_reason ?? '?'})`);
  }
  return { text, tokensIn: j.usage?.input_tokens || 0, tokensOut: j.usage?.output_tokens || 0 };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = await requireInternalAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const filterBarId: number | undefined = body?.bar_id;

    const hoje = new Date();
    // Default: semana corrente (seg até dom)
    const dow = hoje.getDay();
    const segundaUltima = new Date(hoje.getTime() - ((dow + 6) % 7) * 86400000);
    const di = body?.semana_ini ?? new Date(segundaUltima.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const df = body?.semana_fim ?? new Date(segundaUltima.getTime() - 86400000).toISOString().split('T')[0];

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ── Modo reprocessamento ──────────────────────────────────────────────
    // Refaz o TEXTO dos relatorios que ficaram gravados vazios (bug do Sonnet 5,
    // 06/07 a 03/08/2026) reaproveitando o dados_brutos ja salvo na linha — ou
    // seja, os numeros REAIS daquela semana, e nao os de hoje. Nao cria linha
    // nova: faz UPDATE na existente. Rode quantas vezes precisar; a cada rodada
    // ele pega os que ainda estao vazios e devolve quantos sobraram.
    if (body?.regerar_vazios) {
      const limite = Math.min(Number(body?.limite) || 10, 30);
      const inicioMs = Date.now();

      const { data: todos } = await supabase.schema('gold').from('relatorios_executivos')
        .select('id, bar_id, periodo_ini, periodo_fim, resumo_executivo')
        .order('periodo_fim', { ascending: false });

      const vazios = (todos ?? []).filter((r: any) => !(r.resumo_executivo ?? '').trim());
      const alvo = vazios.slice(0, limite);

      if (alvo.length === 0) {
        return new Response(JSON.stringify({ success: true, modo: 'regerar_vazios', processados: 0, restantes: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: linhas } = await supabase.schema('gold').from('relatorios_executivos')
        .select('id, bar_id, periodo_ini, periodo_fim, dados_brutos')
        .in('id', alvo.map((r: any) => r.id));

      const { data: todosBares } = await supabase.schema('operations').from('bares').select('id, nome');
      const nomePorBar = new Map<number, string>((todosBares ?? []).map((b: any) => [b.id, b.nome]));

      const feitos: any[] = [];

      // Em lotes de 5 em paralelo: um relatorio leva ~40s, entao serial estouraria
      // o tempo maximo da edge function. O guarda de tempo para antes do limite e
      // devolve o que faltou, pra proxima chamada continuar.
      for (let i = 0; i < (linhas ?? []).length; i += 5) {
        if (Date.now() - inicioMs > 240_000) break;
        const lote = (linhas ?? []).slice(i, i + 5);
        const saidas = await Promise.allSettled(lote.map(async (row: any) => {
          const snap = row.dados_brutos;
          if (!snap) throw new Error('sem dados_brutos — nao da pra refazer o texto');
          const nome = nomePorBar.get(row.bar_id) ?? `Bar ${row.bar_id}`;
          const claude = await chamarClaude(montarPrompt(nome, row.periodo_ini, row.periodo_fim, snap));
          const { error } = await supabase.schema('gold').from('relatorios_executivos').update({
            resumo_executivo: claude.text,
            modelo_usado: MODELO,
            tokens_input: claude.tokensIn,
            tokens_output: claude.tokensOut,
          }).eq('id', row.id);
          if (error) throw new Error(`update falhou: ${error.message}`);
          return { id: row.id, bar_id: row.bar_id, periodo: row.periodo_fim, chars: claude.text.length };
        }));
        saidas.forEach((s, idx) => {
          if (s.status === 'fulfilled') feitos.push(s.value);
          else {
            console.error('[relatorio-executivo][regerar]', lote[idx]?.id, s.reason);
            feitos.push({ id: lote[idx]?.id, erro: String(s.reason?.message ?? s.reason) });
          }
        });
      }

      const ok = feitos.filter((f) => !f.erro).length;
      return new Response(JSON.stringify({
        success: true, modo: 'regerar_vazios',
        processados: ok, falhas: feitos.length - ok,
        restantes: Math.max(0, vazios.length - ok),
        detalhe: feitos,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let q = supabase.schema('operations').from('bares').select('id, nome').eq('ativo', true);
    if (filterBarId) q = q.eq('id', filterBarId);
    const { data: bares } = await q;

    const resultados: any[] = [];

    for (const bar of (bares ?? [])) {
      try {
      const snap = await coletarSnapshot(supabase, bar.id, di, df);

      const prompt = montarPrompt(bar.nome, di, df, snap);

      const claude = await chamarClaude(prompt);

      const payload = {
        bar_id: bar.id, tipo: 'semanal',
        periodo_ini: di, periodo_fim: df,
        resumo_executivo: claude.text,
        dados_brutos: snap,
        modelo_usado: MODELO,
        tokens_input: claude.tokensIn,
        tokens_output: claude.tokensOut,
      };

      // Regerar a MESMA semana substitui a linha, nao empilha outra. Sem isso cada
      // clique em "Gerar agora" criava um card repetido na tela (a semana 27/07 a
      // 02/08 chegou a ter 15 linhas pra 5 bares). Nao ha unique constraint na
      // tabela, entao a checagem e' feita aqui.
      const { data: existente } = await supabase.schema('gold').from('relatorios_executivos')
        .select('id').eq('bar_id', bar.id).eq('tipo', 'semanal')
        .eq('periodo_ini', di).eq('periodo_fim', df)
        .order('id', { ascending: false }).limit(1).maybeSingle();

      const { data: rel } = existente?.id
        ? await supabase.schema('gold').from('relatorios_executivos')
            .update(payload).eq('id', existente.id).select('id').single()
        : await supabase.schema('gold').from('relatorios_executivos')
            .insert(payload).select('id').single();

      resultados.push({
        bar_id: bar.id, nome: bar.nome, relatorio_id: rel?.id,
        tokens: { in: claude.tokensIn, out: claude.tokensOut },
      });
      } catch (err: any) {
        // Um bar que falha nao derruba os outros — antes o erro subia e nenhum
        // relatorio da rodada era gravado.
        console.error(`[relatorio-executivo] bar ${bar.id} (${bar.nome}):`, err);
        resultados.push({ bar_id: bar.id, nome: bar.nome, erro: err?.message ?? String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, periodo: { ini: di, fim: df }, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[relatorio-executivo]', e);
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
