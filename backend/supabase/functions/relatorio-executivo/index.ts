/**
 * 📋 Relatório Executivo Semanal (tela /ferramentas/analises/relatorio-ia)
 *
 * QUEM entra: bares com `config.relatorio_ia` em operations.bares —
 *   'completo' → vendas (gold.desempenho), CMV (financial.cmv_semanal), NPS,
 *                Quality Score, stockout, atrasos, Instagram, clube, previsões
 *   'midia'    → só Instagram (bar que ainda não abriu)
 *   ausente    → não gera
 *
 * Manda pro Claude Sonnet 5 → relatório em markdown, salvo em
 * gold.relatorios_executivos (uma linha por bar/semana: regerar faz UPDATE).
 *
 * Body:
 *   { bar_id?, semana_ini?, semana_fim? }        gera a semana (default: a passada)
 *   { regerar_vazios: true, limite? }            refaz texto dos gravados vazios
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireInternalAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODELO = 'claude-sonnet-5';

/**
 * Quem entra no relatorio, e em que profundidade, vem de `config.relatorio_ia`
 * no operations.bares:
 *   'completo' → bar em operacao: vendas + operacao + satisfacao + midia (3, 4)
 *   'midia'    → bar que ainda NAO abriu e so tem Instagram rodando (5)
 *   ausente    → nao gera relatorio (6 Prefeitura, 7 Escritorio Central)
 *
 * Ficar de fora e' o default de proposito: bar sem operacao gerava um relatorio
 * com tudo zerado e a IA gritava "CRITICO: falha de integracao" — ruido puro.
 * Quando o Primo Pobre abrir, e' so trocar pra 'completo' — sem deploy.
 */
type ModoRelatorio = 'completo' | 'midia';

async function coletarSnapshot(supabase: any, barId: number, di: string, df: string, modo: ModoRelatorio = 'completo') {
  if (modo === 'midia') return await coletarSnapshotMidia(supabase, barId, di, df);
  return await coletarSnapshotCompleto(supabase, barId, di, df);
}

/** Bar que ainda nao abriu: so o que existe de verdade — Instagram. */
async function coletarSnapshotMidia(supabase: any, barId: number, di: string, df: string) {
  const { data: ig } = await supabase
    .schema('integrations').from('instagram_conta_metricas')
    .select('data_snapshot, followers_count, reach, impressions, profile_views, total_interactions, accounts_engaged')
    // `.lte(data_snapshot, df)`: sem isso, relatorio de semana passada vinha com o
    // numero de seguidores de HOJE (a busca pegava os 2 snapshots mais recentes da
    // conta, sem olhar o periodo) — as 7 semanas do Primo Pobre saiam todas com
    // "78.623 (+7)". Cada semana tem que ver a conta como ela estava naquela data.
    .eq('bar_id', barId).lte('data_snapshot', df)
    .order('data_snapshot', { ascending: false }).limit(2);

  const { data: posts } = await supabase
    .schema('integrations').from('instagram_posts')
    .select('ig_media_id, media_type, media_product_type, caption, like_count, comments_count')
    .eq('bar_id', barId).gte('timestamp_post', `${di}T00:00:00`).lte('timestamp_post', `${df}T23:59:59`)
    .order('like_count', { ascending: false });

  const { data: alertas } = await supabase
    .schema('integrations').from('instagram_alertas')
    .select('tipo, severidade, titulo').eq('bar_id', barId).eq('resolvido', false)
    .gte('criado_em', `${di}T00:00:00`).order('criado_em', { ascending: false }).limit(10);

  return {
    modo: 'midia',
    periodo: { ini: di, fim: df },
    instagram_ultimo_snapshot: ig?.[0] ?? null,
    instagram_snapshot_anterior: ig?.[1] ?? null,
    posts_da_semana: posts ?? [],
    posts_semana_total: posts?.length ?? 0,
    alertas_ig_ativos: alertas ?? [],
  };
}

async function coletarSnapshotCompleto(supabase: any, barId: number, di: string, df: string) {
  // 1) Desempenho semanal (atual + anterior)
  const { data: desempenho } = await supabase
    .schema('gold').from('desempenho')
    // NAO usar cmv_global_real: coluna MORTA (0,00 em 31/31 semanas de 2026, em
    // todos os bares). O CMV de verdade vem de financial.cmv_semanal, igual a tela.
    .select('numero_semana, ano, data_inicio, data_fim, faturamento_total, clientes_atendidos, ticket_medio, nps_geral, nps_salao, nps_digital, nps_reservas, stockout_total_perc, atrasos_comida_perc, atrasos_drinks_perc, cmo, reservas_quebra_pct, nota_felicidade_equipe, tempo_cozinha, tempo_drinks')
    .eq('bar_id', barId).eq('granularidade', 'semanal')
    .gte('data_inicio', di).lte('data_fim', df).order('data_fim');

  const atual = desempenho?.[0] ?? null;

  // 2) Semana anterior pra comparativo
  const diAnt = new Date(new Date(di).getTime() - 7 * 86400000).toISOString().split('T')[0];
  const dfAnt = new Date(new Date(df).getTime() - 7 * 86400000).toISOString().split('T')[0];
  const { data: anteriorArr } = await supabase
    .schema('gold').from('desempenho')
    // sem cmv_global_real aqui tambem: coluna morta, ia virar "CMV da semana
    // anterior = 0" no comparativo
    .select('faturamento_total, clientes_atendidos, ticket_medio, nps_geral, stockout_total_perc')
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
    // `.lte(data_snapshot, df)`: sem isso, relatorio de semana passada vinha com o
    // numero de seguidores de HOJE (a busca pegava os 2 snapshots mais recentes da
    // conta, sem olhar o periodo) — as 7 semanas do Primo Pobre saiam todas com
    // "78.623 (+7)". Cada semana tem que ver a conta como ela estava naquela data.
    .eq('bar_id', barId).lte('data_snapshot', df)
    .order('data_snapshot', { ascending: false }).limit(2);

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

  // 9) CMV semanal — MESMA fonte da tela /estrategico/desempenho.
  // O gold.desempenho.cmv_global_real esta morto (sempre 0); quem tem o numero
  // e' financial.cmv_semanal, e o % global e' calculado na hora (cmv_real / fat).
  let cmvBloco: any = null;
  if (atual?.ano && atual?.numero_semana) {
    const { data: cmvSem } = await supabase
      .schema('financial').from('cmv_semanal')
      .select('cmv_real, cmv_limpo_percentual, faturamento_cmvivel')
      .eq('bar_id', barId).eq('ano', atual.ano).eq('semana', atual.numero_semana)
      .maybeSingle();
    const fat = Number(atual.faturamento_total) || 0;
    const cmvReal = Number(cmvSem?.cmv_real) || 0;
    cmvBloco = cmvSem ? {
      cmv_real_rs: cmvReal,
      cmv_global_percent: fat > 0 && cmvReal > 0 ? Number(((cmvReal / fat) * 100).toFixed(2)) : null,
      cmv_limpo_percent: cmvSem.cmv_limpo_percentual ?? null,
      faturamento_cmvivel: cmvSem.faturamento_cmvivel ?? null,
    } : null;
  }

  // Folha: o ETL soma lancamentos do Conta Azul de salario/vale-transporte POR DATA
  // DE PAGAMENTO. Semanalmente isso e' desembolso, nao custo de mao de obra da
  // semana (semana sem data de pagamento da 0). Vai com nome que nao deixa duvida.
  const folhaPaga = Number(atual?.cmo) || 0;
  const fatSemana = Number(atual?.faturamento_total) || 0;

  return {
    periodo: { ini: di, fim: df },
    desempenho_atual: atual,
    desempenho_anterior: anterior,
    cmv_semanal: cmvBloco,
    folha_paga_na_semana: {
      valor_rs: folhaPaga,
      percent_do_faturamento: fatSemana > 0 && folhaPaga > 0
        ? Number(((folhaPaga / fatSemana) * 100).toFixed(2)) : null,
      observacao: 'Desembolso de folha lancado no periodo (salario/vale-transporte por data de pagamento). NAO e o custo de mao de obra da semana.',
    },
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
function montarPrompt(nomeBar: string, di: string, df: string, snap: any, modo: ModoRelatorio = 'completo'): string {
  if (modo === 'midia') return montarPromptMidia(nomeBar, di, df, snap);

  return `Você é o **Diretor de BI**. Gere um RELATÓRIO EXECUTIVO SEMANAL pro **${nomeBar}** com base em DADOS REAIS.

Período: **${di} a ${df}**

⚠️ UNIDADES E CONVENÇÕES IMPORTANTES (não interpretar errado):
- **tempo_cozinha** e **tempo_drinks** estão em **SEGUNDOS** (não minutos). Ex: 546 = ~9 minutos, 153 = ~2,5 minutos.
- **NPS Geral está MORTO** (não existe mais). Não cite "NPS Geral sem dado". Use **NPS Digital** como NPS principal (peso 25% no Quality Score).
- **NPS Salão** tem volume pequeno (poucas respostas) — se for menos de 5 respostas, mencione amostra pequena, evite afirmar "100" como verdade.
- Faturamento em R$. Atrasos/stockout em %.
- **CMV**: use APENAS o bloco \`cmv_semanal\` (\`cmv_global_percent\` e \`cmv_limpo_percent\` já vêm em %, ex.: 32.09 = 32,09%). Se \`cmv_semanal\` vier null, o CMV da semana ainda não fechou — diga isso, e NÃO conclua "CMV zerado".
- **folha_paga_na_semana** é DESEMBOLSO de folha lançado no período (salário/vale-transporte por data de pagamento), NÃO o custo de mão de obra da semana. Semana sem data de pagamento vem 0 — isso é normal e **não é** economia nem falha. Cite no máximo como "folha paga na semana"; se quiser falar de CMO de verdade, diga que é indicador mensal.
- Se métrica está NULL no snapshot, diga "não medido nesta semana" e NÃO use no peso do score.

DADOS BRUTOS (snapshot da semana do relatório):
${JSON.stringify(snap, null, 2)}

ESTRUTURA OBRIGATÓRIA do relatório (markdown, parágrafos curtos):

## 📊 Resumo do Período
Frase única com o headline da semana (subiu/caiu, melhor/pior).

## 💰 Vendas e Faturamento
Número absoluto + comparativo % vs semana anterior. Ticket médio. Público.

## 🍔 Eficiência Operacional
CMV do bloco cmv_semanal (global % e limpo %). Stockout. Atrasos cozinha + drinks. Folha paga na semana só se houver valor, com a ressalva de que é desembolso.

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

/**
 * Bar que ainda NAO abriu (hoje: Primo Pobre). So existe Instagram — pedir
 * vendas/CMV/NPS aqui produzia um relatorio de tudo zerado com alarme falso de
 * "CRITICO: falha de integracao". Aqui o assunto e' so a construcao de audiencia.
 */
function montarPromptMidia(nomeBar: string, di: string, df: string, snap: any): string {
  return `Você é o **Diretor de BI**. Gere um RELATÓRIO SEMANAL DE MÍDIA pro **${nomeBar}** com base em DADOS REAIS.

Período: **${di} a ${df}**

⚠️ CONTEXTO OBRIGATÓRIO — leia antes de escrever:
- Este bar **AINDA NÃO ABRIU**. Não existe operação, faturamento, CMV, NPS, cozinha ou reservas.
- **NÃO** mencione vendas, faturamento, ticket médio, CMV, CMO, NPS, stockout ou atrasos — nem para dizer que estão zerados. Não é falha de integração: simplesmente não existe ainda.
- O objetivo da fase é **construir audiência antes da inauguração**. Avalie por esse critério.
- \`instagram_ultimo_snapshot\` é a foto mais recente da conta e \`instagram_snapshot_anterior\` a anterior — use as duas para variação. Se só houver uma, diga que ainda não há base de comparação.
- Se não houve post na semana, isso É o achado principal.

DADOS BRUTOS (snapshot da semana do relatório):
${JSON.stringify(snap, null, 2)}

ESTRUTURA OBRIGATÓRIA (markdown, parágrafos curtos):

## 📊 Resumo da Semana
Uma frase: a audiência avançou, ficou parada ou recuou?

## 📱 Instagram
Seguidores e variação vs snapshot anterior. Alcance, contas engajadas, visitas ao perfil. Quantos posts saíram e quais performaram melhor (cite a legenda encurtada e os números).

## 🚨 Atenções
1-3 pontos reais desta fase (ex.: semana sem post, alcance caindo, engajamento concentrado em um único conteúdo). Se estiver tudo bem, diga que está tudo bem — não invente problema.

## 🎯 Recomendações da Semana
3 ações concretas de conteúdo/audiência para a próxima semana, pensando na inauguração.

Tom: direto, números reais, sem floreio, máximo 400 palavras. Pt-BR.`;
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

      const { data: todosBares } = await supabase.schema('operations').from('bares').select('id, nome, config');
      const nomePorBar = new Map<number, string>((todosBares ?? []).map((b: any) => [b.id, b.nome]));
      const modoPorBar = new Map<number, ModoRelatorio>(
        (todosBares ?? []).map((b: any) => [b.id, (b?.config?.relatorio_ia === 'midia' ? 'midia' : 'completo') as ModoRelatorio])
      );

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
          const claude = await chamarClaude(
            montarPrompt(nome, row.periodo_ini, row.periodo_fim, snap, modoPorBar.get(row.bar_id) ?? 'completo')
          );
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

    let q = supabase.schema('operations').from('bares').select('id, nome, config').eq('ativo', true);
    if (filterBarId) q = q.eq('id', filterBarId);
    const { data: baresAtivos } = await q;

    // So entram os bares marcados em config.relatorio_ia (ver ModoRelatorio no topo).
    // Bar ativo != bar com operacao: Prefeitura e Escritorio Central sao ativos no
    // sistema e geravam relatorio de tudo zerado.
    const bares = (baresAtivos ?? [])
      .map((b: any) => ({ id: b.id, nome: b.nome, modo: b?.config?.relatorio_ia as ModoRelatorio | undefined }))
      .filter((b: any) => b.modo === 'completo' || b.modo === 'midia');

    if (bares.length === 0) {
      return new Response(JSON.stringify({
        success: true, periodo: { ini: di, fim: df }, resultados: [],
        aviso: 'Nenhum bar com config.relatorio_ia = completo|midia',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resultados: any[] = [];

    for (const bar of (bares ?? [])) {
      try {
      const snap = await coletarSnapshot(supabase, bar.id, di, df, bar.modo);

      const prompt = montarPrompt(bar.nome, di, df, snap, bar.modo);

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
