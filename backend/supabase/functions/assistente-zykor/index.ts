/**
 * 💬 Zykor Assistente — Tool-Use v2 (2026-05-29)
 *
 * Fluxo:
 *   1. Whitelist sócio
 *   2. Detecta bar
 *   3. Snapshot inicial pequeno (visão geral)
 *   4. Loop tool-use Claude: IA pode chamar tools READ-ONLY pra consultar
 *      qualquer view/RPC liberada
 *   5. Resposta final salva no log
 *
 * Tools são DEFINIDAS aqui (whitelist explícita). Nada de SQL livre.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODELO = 'claude-sonnet-4-6';
const MAX_TOOL_TURNS = 6;

function normalizeTel(t: string): string { return t.replace(/\D/g, ''); }

function detectarBar(msg: string, baresAutorizados: number[]): number {
  const m = msg.toLowerCase();
  if (m.includes('debo') || m.includes('descubra')) return baresAutorizados.includes(4) ? 4 : baresAutorizados[0];
  if (m.includes('ord') || m.includes('ordinar')) return baresAutorizados.includes(3) ? 3 : baresAutorizados[0];
  return baresAutorizados[0];
}

// ------------- TOOLS --------------

const TOOLS = [
  {
    name: 'vendas_periodo',
    description: 'Faturamento e clientes do bar em um período. Use pra perguntas como "quanto faturamos no fim de semana?", "quanto foi sábado?". Retorna faturamento líquido, pessoas, ticket médio por dia.',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        data_inicio: { type: 'string', description: 'YYYY-MM-DD' },
        data_fim: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['bar_id', 'data_inicio', 'data_fim'],
    },
  },
  {
    name: 'clube_membros',
    description: 'Top membros do Clube Ordi por nível e segmento. Use pra "quem são os VIPs?", "ouros dormindo", "membros prata ativos". Ordenado por gasto total.',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        nivel: { type: 'string', enum: ['diamante', 'ouro', 'prata', 'bronze'] },
        segmento: { type: 'string', enum: ['vip', 'frequente', 'dormindo', 'novo', 'casual', 'perdido'] },
        limit: { type: 'integer', description: 'max 50, default 15' },
      },
      required: ['bar_id'],
    },
  },
  {
    name: 'clientes_em_queda',
    description: 'Clientes VIP em risco de churn — sinais de queda no ticket ou intervalo entre visitas. Use pra "quem tá caindo?", "vou perder algum diamante?".',
    input_schema: {
      type: 'object',
      properties: { bar_id: { type: 'integer' } },
      required: ['bar_id'],
    },
  },
  {
    name: 'garcom_performance',
    description: 'Performance dos garçons: faturamento, ticket médio, share drinks/comida, % desconto, % upsell bebida. Use pra "quem vende mais?", "qual garçom dá mais desconto?".',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        dias: { type: 'integer', description: 'default 30' },
      },
      required: ['bar_id'],
    },
  },
  {
    name: 'combos_que_convertem',
    description: 'Combinações de produtos que aparecem juntos na mesma comanda. Use pra "se cliente pediu chopp, qual o próximo item?", "que combos sugerir?".',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        produto: { type: 'string', description: 'opcional, filtra combos que envolvem esse produto' },
      },
      required: ['bar_id'],
    },
  },
  {
    name: 'aniversariantes',
    description: 'Clientes que fazem aniversário em janela futura. Use pra "quem faz aniver essa semana?", "lista de aniversariantes pra acionar".',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        dias: { type: 'integer', description: 'janela futura em dias, default 7' },
      },
      required: ['bar_id'],
    },
  },
  {
    name: 'no_show_reincidentes',
    description: 'Clientes que reservaram e faltaram repetidamente. Use pra "tem cliente que tá faltando muito?", "quem bloquear?".',
    input_schema: {
      type: 'object',
      properties: { bar_id: { type: 'integer' } },
      required: ['bar_id'],
    },
  },
  {
    name: 'previsao_demanda',
    description: 'Previsão de faturamento e público pros próximos dias. Use pra "qual previsão pra sexta?", "vamos bombar no fim de semana?".',
    input_schema: {
      type: 'object',
      properties: { bar_id: { type: 'integer' } },
      required: ['bar_id'],
    },
  },
  {
    name: 'alertas_integridade',
    description: 'Alertas de fraude/desvio detectados (descontos altos, cortesias volumosas, funcionários com taxa anormal). Use pra "tem algo estranho?", "como tá a integridade?".',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        dias: { type: 'integer', description: 'default 14' },
      },
      required: ['bar_id'],
    },
  },
  {
    name: 'consultar_dre',
    description: 'DRE (regime de competência) do bar por ano: receita, custos e despesas por categoria e mês. Use pra "de onde vem o lucro?", "DRE de maio", "quanto gastamos com marketing?", "qual o lucro do mês?". Retorna linhas mes/categoria_macro/categoria/valor (despesa negativa).',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        ano: { type: 'integer', description: 'ex 2026' },
        mes: { type: 'integer', description: 'opcional 1-12 pra filtrar um mês' },
      },
      required: ['bar_id', 'ano'],
    },
  },
  {
    name: 'consultar_dfc',
    description: 'DFC (fluxo de caixa, por DATA DE PAGAMENTO) do bar por ano: Operacional/Investimento/Financiamento e variação de caixa por mês. Use pra "como tá o caixa?", "quanto saiu de investimento?", "entrou ou saiu dinheiro no mês?".',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        ano: { type: 'integer' },
        mes: { type: 'integer', description: 'opcional 1-12' },
      },
      required: ['bar_id', 'ano'],
    },
  },
  {
    name: 'mudancas_conta_azul',
    description: 'Mudanças registradas nos lançamentos do Conta Azul (categoria/valor/competência/pagamento/exclusão), a partir de jun/2026. Use pra "o que mudou no CA?", "teve lançamento retroativo em maio?", "mexeram em mês já fechado?". Pode filtrar por mês de competência e/ou desde quando foi alterado.',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        mes_competencia: { type: 'string', description: 'opcional YYYY-MM (mês do lançamento)' },
        desde: { type: 'string', description: 'opcional YYYY-MM-DD (alteradas a partir de)' },
      },
      required: ['bar_id'],
    },
  },
  {
    name: 'dre_evolucao',
    description: 'Como uma linha da DRE (ou o total de um mês) evoluiu entre as fotos diárias guardadas. Use pra "o lucro de maio era 12k e agora tá 5k, o que houve?", "essa categoria mudou desde semana passada?". Retorna o valor por data de foto (pra ver o que mudou e quando).',
    input_schema: {
      type: 'object',
      properties: {
        bar_id: { type: 'integer' },
        mes: { type: 'integer', description: 'mês 1-12' },
        categoria: { type: 'string', description: 'opcional, nome da linha (ex: Marketing Mídia). Sem isso, traz as linhas que mais mudaram.' },
      },
      required: ['bar_id', 'mes'],
    },
  },
] as const;

// ------------- HANDLERS --------------

async function execTool(supabase: any, name: string, args: any): Promise<any> {
  const barId = Number(args.bar_id);
  switch (name) {
    case 'vendas_periodo': {
      const { data } = await supabase.schema('silver').from('vendas_diarias')
        .select('dt_gerencial, faturamento_liquido_r, total_pessoas, ticket_medio_pessoas_r')
        .eq('bar_id', barId).gte('dt_gerencial', args.data_inicio).lte('dt_gerencial', args.data_fim)
        .order('dt_gerencial');
      const total = (data ?? []).reduce((s: number, d: any) => s + Number(d.faturamento_liquido_r || 0), 0);
      const pessoas = (data ?? []).reduce((s: number, d: any) => s + Number(d.total_pessoas || 0), 0);
      return { dias: data, faturamento_total: total, pessoas_total: pessoas, ticket_medio_geral: pessoas > 0 ? Math.round(total / pessoas) : 0 };
    }
    case 'clube_membros': {
      let q = supabase.schema('crm').from('clube_ordi_membros')
        .select('cliente_fone_norm, cliente_nome, nivel, segmento, total_visitas, valor_total_consumo, ticket_medio_consumo, dias_inativo')
        .eq('bar_id', barId);
      if (args.nivel) q = q.eq('nivel', args.nivel);
      if (args.segmento) q = q.eq('segmento', args.segmento);
      const { data } = await q.order('valor_total_consumo', { ascending: false, nullsFirst: false }).limit(Math.min(args.limit ?? 15, 50));
      return { membros: data ?? [] };
    }
    case 'clientes_em_queda': {
      const { data } = await supabase.schema('crm').from('clientes_em_queda')
        .select('cliente_nome, nivel, total_visitas, ticket_ult4, ticket_ant4, variacao_ticket_pct, dias_inativo, score_risco, valor_anual_risco')
        .eq('bar_id', barId).order('score_risco', { ascending: false }).limit(15);
      return { clientes: data ?? [] };
    }
    case 'garcom_performance': {
      const { data } = await supabase.rpc('garcom_performance', { p_bar_id: barId, p_dias: args.dias ?? 30 });
      return { garcons: (data ?? []).slice(0, 15) };
    }
    case 'combos_que_convertem': {
      const { data } = await supabase.rpc('produto_combos', { p_bar_id: barId, p_dias: 60, p_min_pares: 25 });
      let combos = data ?? [];
      if (args.produto) {
        const p = String(args.produto).toLowerCase();
        combos = combos.filter((c: any) => c.produto_a?.toLowerCase().includes(p) || c.produto_b?.toLowerCase().includes(p));
      }
      combos = combos.filter((c: any) => !c.produto_a?.includes('[Banda]')).slice(0, 20);
      return { combos };
    }
    case 'aniversariantes': {
      const dias = args.dias ?? 7;
      const hoje = new Date().toISOString().split('T')[0];
      const fim = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0];
      const { data } = await supabase.schema('crm').from('aniversariantes')
        .select('cliente_nome, cliente_fone_norm, idade, nivel, total_visitas, valor_total_consumo, proximo_aniver')
        .eq('bar_id', barId).gte('proximo_aniver', hoje).lte('proximo_aniver', fim)
        .order('proximo_aniver').limit(30);
      return { aniversariantes: data ?? [] };
    }
    case 'no_show_reincidentes': {
      const [{ data: resumo }, { data: top }] = await Promise.all([
        supabase.schema('gold').from('noshow_resumo').select('*').eq('bar_id', barId).maybeSingle(),
        supabase.schema('gold').from('noshow_reincidentes').select('customer_name, customer_phone, reservas_totais, no_shows, noshow_pct').eq('bar_id', barId).limit(15),
      ]);
      return { resumo, reincidentes: top ?? [] };
    }
    case 'previsao_demanda': {
      const { data } = await supabase.schema('gold').from('demanda_previsoes')
        .select('data_evento, fat_previsto, publico_previsto, modelo_usado')
        .eq('bar_id', barId).order('data_evento').limit(14);
      return { previsoes: data ?? [] };
    }
    case 'alertas_integridade': {
      const desde = new Date(Date.now() - (args.dias ?? 14) * 86400000).toISOString().split('T')[0];
      const { data } = await supabase.schema('integridade').from('alertas')
        .select('data_referencia, tipo, severidade, titulo, entidade, valor_envolvido')
        .eq('bar_id', barId).gte('data_referencia', desde)
        .order('severidade', { ascending: false }).order('valor_envolvido', { ascending: false }).limit(30);
      return { alertas: data ?? [] };
    }
    case 'consultar_dre': {
      const { data } = await supabase.rpc('get_dre_por_ano', { p_bar_id: barId, p_ano: args.ano });
      const rows = data ?? [];
      if (args.mes) {
        const mm = String(args.mes).padStart(2, '0');
        const linhas = rows
          .filter((r: any) => String(r.mes).slice(5, 7) === mm)
          .map((r: any) => ({ macro: r.categoria_macro, categoria: r.categoria, valor: Math.round(Number(r.valor_com_sinal)) }))
          .filter((r: any) => r.valor !== 0);
        return { ano: args.ano, mes: args.mes, linhas };
      }
      const agg: Record<string, number> = {};
      for (const r of rows) { const k = `${String(r.mes).slice(0, 7)}|${r.categoria_macro}`; agg[k] = (agg[k] || 0) + Number(r.valor_com_sinal); }
      return { ano: args.ano, por_mes_macro: Object.entries(agg).map(([k, v]) => ({ mes: k.split('|')[0], macro: k.split('|')[1], valor: Math.round(v) })) };
    }
    case 'consultar_dfc': {
      const { data } = await supabase.rpc('get_dfc_por_ano', { p_bar_id: barId, p_ano: args.ano });
      const meses: Record<string, any> = {};
      for (const r of (data ?? [])) {
        if (args.mes && Number(String(r.mes).slice(5, 7)) !== args.mes) continue;
        const mm = String(r.mes).slice(0, 7);
        (meses[mm] ||= { mes: mm, OPERACIONAL: 0, INVESTIMENTO: 0, FINANCIAMENTO: 0 })[r.grupo_dfc] += Number(r.net);
      }
      const fluxo = Object.values(meses).map((m: any) => ({
        mes: m.mes, operacional: Math.round(m.OPERACIONAL), investimento: Math.round(m.INVESTIMENTO),
        financiamento: Math.round(m.FINANCIAMENTO), variacao_caixa: Math.round(m.OPERACIONAL + m.INVESTIMENTO + m.FINANCIAMENTO),
      }));
      return { ano: args.ano, fluxo };
    }
    case 'mudancas_conta_azul': {
      let q = supabase.schema('bronze').from('contaazul_lancamentos_historico')
        .select('contaazul_id, data_competencia, categoria_nome, evento, mudancas, alterado_em')
        .eq('bar_id', barId).order('alterado_em', { ascending: false }).limit(50);
      if (args.mes_competencia) {
        const [y, m] = String(args.mes_competencia).split('-').map(Number);
        const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
        q = q.gte('data_competencia', `${args.mes_competencia}-01`).lt('data_competencia', next);
      }
      if (args.desde) q = q.gte('alterado_em', args.desde);
      const { data } = await q;
      return { mudancas: data ?? [], obs: (data && data.length) ? null : 'O histórico de mudanças do CA começa a registrar em jun/2026 — pode estar vazio se ainda não houve sync com alteração.' };
    }
    case 'dre_evolucao': {
      const ano = new Date().getFullYear();
      const mesDate = `${ano}-${String(args.mes).padStart(2, '0')}-01`;
      let q = supabase.schema('financial').from('dre_dfc_snapshot')
        .select('snapshot_date, grupo, categoria, valor')
        .eq('bar_id', barId).eq('tipo', 'DRE').eq('mes', mesDate).order('snapshot_date');
      if (args.categoria) q = q.ilike('categoria', `%${args.categoria}%`);
      const { data } = await q;
      return { evolucao: data ?? [], obs: (data && data.length) ? null : 'Os snapshots diários começam em jun/2026 — precisa de pelo menos 2 dias de foto pra comparar.' };
    }
  }
  return { erro: `tool ${name} desconhecida` };
}

interface ClaudeUsage { input_tokens: number; output_tokens: number; }

async function chamarClaude(messages: any[], systemPrompt: string): Promise<{ content: any[]; stopReason: string; usage: ClaudeUsage }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente');
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODELO, max_tokens: 2000,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    }),
  });
  if (!r.ok) throw new Error(`Anthropic: ${await r.text()}`);
  const j = await r.json();
  return { content: j.content, stopReason: j.stop_reason, usage: j.usage };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = requireAuth(req);
  if (authError) return authError;

  const t0 = Date.now();
  try {
    const body = await req.json();
    const telefone = normalizeTel(body?.telefone || '');
    const mensagem: string = (body?.mensagem || '').trim();
    if (!telefone || !mensagem) {
      return new Response(JSON.stringify({ erro: 'telefone+mensagem obrigatorios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: socio } = await supabase.schema('integrations').from('whatsapp_assistente_socios')
      .select('*').eq('telefone', telefone).eq('ativo', true).maybeSingle();

    if (!socio) {
      const resposta = 'Desculpe, este número não está autorizado a usar o Assistente Zykor.';
      await supabase.schema('integrations').from('whatsapp_assistente_log').insert({
        telefone, pergunta: mensagem, resposta, tempo_ms: Date.now() - t0, erro_msg: 'nao_autorizado',
      });
      return new Response(JSON.stringify({ resposta }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const barId = detectarBar(mensagem, socio.bares_autorizados);
    const { data: bar } = await supabase.schema('operations').from('bares').select('id, nome').eq('id', barId).maybeSingle();

    const systemPrompt = `Você é o **Zykor Assistant**, assistente analítico do sócio **${socio.nome}** dos bares Grupo Menos e Mais.

Bar em foco: **${bar?.nome || `Bar ${barId}`}** (bar_id=${barId})
Data atual: ${new Date().toLocaleDateString('pt-BR')}
Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}.

Você tem acesso a TOOLS pra consultar o banco. Use-as livremente pra responder com dados reais.
Padrão: bar_id 3=Ordinário, 4=Deboche.
Finanças (DRE/DFC/auditoria, hoje sólidos só no Ordinário/bar 3):
  - consultar_dre: DRE por competência (de onde vem o lucro, gasto por categoria).
  - consultar_dfc: fluxo de caixa por pagamento (Operacional/Investimento/Financiamento).
  - mudancas_conta_azul: o que mudou nos lançamentos do CA (categoria/valor/exclusão), inclusive retroativo em mês fechado.
  - dre_evolucao: como uma linha/mês da DRE mudou entre as fotos diárias ("era 12k, virou 5k" — explique o que mudou cruzando com mudancas_conta_azul).
  Despesa na DRE vem com sinal negativo. Histórico/snapshots começaram em jun/2026 (podem estar rasos por enquanto).
Se a pergunta envolver um período mas o sócio não falou as datas, use bom senso:
  - "essa semana" = segunda da semana atual até ontem
  - "ontem" = ontem
  - "mês passado" = mês inteiro anterior
Responda em português direto e curto (max 8 linhas), tipo WhatsApp. Sem floreio. Use números reais.`;

    const messages: any[] = [{ role: 'user', content: mensagem }];
    let totalIn = 0, totalOut = 0;
    let turnos = 0;
    let respostaFinal = '';
    const toolCalls: any[] = [];

    while (turnos < MAX_TOOL_TURNS) {
      turnos++;
      const r = await chamarClaude(messages, systemPrompt);
      totalIn += r.usage.input_tokens;
      totalOut += r.usage.output_tokens;

      messages.push({ role: 'assistant', content: r.content });

      if (r.stopReason === 'tool_use') {
        const toolResults: any[] = [];
        for (const block of r.content) {
          if (block.type === 'tool_use') {
            const result = await execTool(supabase, block.name, block.input);
            toolCalls.push({ tool: block.name, input: block.input, result_preview: JSON.stringify(result).slice(0, 200) });
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
          }
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // end_turn ou max_tokens
      respostaFinal = r.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
      break;
    }

    await supabase.schema('integrations').from('whatsapp_assistente_log').insert({
      telefone, socio_nome: socio.nome, pergunta: mensagem, resposta: respostaFinal,
      bar_id_inferido: barId, tokens_input: totalIn, tokens_output: totalOut, tempo_ms: Date.now() - t0,
      erro_msg: turnos >= MAX_TOOL_TURNS ? 'max_turnos_atingido' : null,
    });

    return new Response(JSON.stringify({
      success: true, resposta: respostaFinal, bar_id: barId,
      tokens: { in: totalIn, out: totalOut }, turnos, tools_chamadas: toolCalls,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
