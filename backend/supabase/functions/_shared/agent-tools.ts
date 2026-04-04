/**
 * 🛠️ Agent Tools - Definições e Executores para Tool Use
 * 
 * Este módulo define as ferramentas que o Gemini pode chamar
 * via function calling para buscar dados e executar ações.
 * 
 * TOOLS DE CONSULTA (12):
 * - consultar_faturamento, consultar_clientes, consultar_cmv
 * - consultar_metas, consultar_produtos_top, comparar_periodos
 * - consultar_tendencia, consultar_estoque, consultar_calendario
 * - consultar_tempos_producao, consultar_mix_vendas, consultar_desempenho_semanal
 * 
 * TOOLS DE AÇÃO (4):
 * - criar_alerta: Cria alerta para o time
 * - disparar_recalculo_desempenho: Recalcula métricas semanais
 * - enviar_notificacao_discord: Envia mensagem ao Discord
 * - registrar_insight: Salva insight no banco
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ToolDefinition, FunctionCall } from './gemini-client.ts';

// ============================================================
// TOOL DEFINITIONS (o que o Gemini pode chamar)
// ============================================================

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'consultar_faturamento',
    description: 'Consulta faturamento (receita) do bar em um período. Retorna faturamento total, número de eventos, público total e ticket médio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data_inicio: { type: 'STRING', description: 'Data início no formato YYYY-MM-DD' },
        data_fim: { type: 'STRING', description: 'Data fim no formato YYYY-MM-DD' },
      },
      required: ['data_inicio', 'data_fim']
    }
  },
  {
    name: 'consultar_clientes',
    description: 'Consulta dados de clientes/público do bar em um período. Retorna total de clientes, ticket médio e detalhes por dia.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data_inicio: { type: 'STRING', description: 'Data início YYYY-MM-DD' },
        data_fim: { type: 'STRING', description: 'Data fim YYYY-MM-DD' },
      },
      required: ['data_inicio', 'data_fim']
    }
  },
  {
    name: 'consultar_cmv',
    description: 'Consulta CMV (Custo de Mercadoria Vendida) recente. Retorna percentual CMV e custo total das últimas semanas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limite_semanas: { type: 'NUMBER', description: 'Número de semanas para buscar (default 4)' },
      },
      required: []
    }
  },
  {
    name: 'consultar_metas',
    description: 'Consulta progresso das metas do bar. Retorna metas diárias (M1/TE/TB) e progresso do mês atual.',
    parameters: {
      type: 'OBJECT',
      properties: {
        mes: { type: 'NUMBER', description: 'Mês (1-12). Se não informado, usa o mês atual.' },
      },
      required: []
    }
  },
  {
    name: 'consultar_produtos_top',
    description: 'Consulta os produtos mais vendidos do bar em um período.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data_inicio: { type: 'STRING', description: 'Data início YYYY-MM-DD' },
        data_fim: { type: 'STRING', description: 'Data fim YYYY-MM-DD' },
        limite: { type: 'NUMBER', description: 'Número máximo de produtos (default 10)' },
      },
      required: ['data_inicio', 'data_fim']
    }
  },
  {
    name: 'comparar_periodos',
    description: 'Compara métricas entre dois períodos (ex: esta semana vs semana passada). Retorna variações de faturamento, público e ticket.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo1_inicio: { type: 'STRING', description: 'Início do período 1 YYYY-MM-DD' },
        periodo1_fim: { type: 'STRING', description: 'Fim do período 1 YYYY-MM-DD' },
        periodo2_inicio: { type: 'STRING', description: 'Início do período 2 YYYY-MM-DD' },
        periodo2_fim: { type: 'STRING', description: 'Fim do período 2 YYYY-MM-DD' },
      },
      required: ['periodo1_inicio', 'periodo1_fim', 'periodo2_inicio', 'periodo2_fim']
    }
  },
  {
    name: 'consultar_tendencia',
    description: 'Consulta tendência das últimas 4 semanas. Retorna se faturamento/público está subindo, caindo ou estável.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'consultar_estoque',
    description: 'Consulta rupturas de estoque (stockout) recentes. Retorna produtos que ficaram em falta.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data: { type: 'STRING', description: 'Data para consultar YYYY-MM-DD. Default: ontem.' },
      },
      required: []
    }
  },
  {
    name: 'consultar_calendario',
    description: 'Consulta próximos eventos agendados no calendário operacional.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limite: { type: 'NUMBER', description: 'Número máximo de eventos (default 10)' },
      },
      required: []
    }
  },
  {
    name: 'consultar_tempos_producao',
    description: 'Consulta tempos médios de produção (bar e cozinha) em um período. Retorna tempo médio de saída e quantidade de atrasos.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data_inicio: { type: 'STRING', description: 'Data início YYYY-MM-DD' },
        data_fim: { type: 'STRING', description: 'Data fim YYYY-MM-DD' },
      },
      required: ['data_inicio', 'data_fim']
    }
  },
  {
    name: 'consultar_mix_vendas',
    description: 'Consulta o mix de vendas (percentual de bebidas, drinks e comida) em um período.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data_inicio: { type: 'STRING', description: 'Data início YYYY-MM-DD' },
        data_fim: { type: 'STRING', description: 'Data fim YYYY-MM-DD' },
      },
      required: ['data_inicio', 'data_fim']
    }
  },
  {
    name: 'consultar_desempenho_semanal',
    description: 'Consulta dados consolidados de desempenho semanal. Retorna todas métricas semanais: faturamento, clientes, ticket, mix, tempos, NPS.',
    parameters: {
      type: 'OBJECT',
      properties: {
        semanas: { type: 'NUMBER', description: 'Número de semanas para buscar (default 4)' },
      },
      required: []
    }
  },

  // ============================================================
  // TOOLS DE AÇÃO
  // ============================================================
  {
    name: 'criar_alerta',
    description: 'Cria um alerta para o time do bar. Use quando detectar uma anomalia ou oportunidade importante.',
    parameters: {
      type: 'OBJECT',
      properties: {
        titulo: { type: 'STRING', description: 'Título curto do alerta' },
        mensagem: { type: 'STRING', description: 'Descrição detalhada do alerta' },
        prioridade: { type: 'STRING', description: 'Prioridade: critico, alto, medio, baixo' },
        acao_sugerida: { type: 'STRING', description: 'Ação recomendada para resolver' },
      },
      required: ['titulo', 'mensagem', 'prioridade']
    }
  },
  {
    name: 'disparar_recalculo_desempenho',
    description: 'Dispara recálculo do desempenho semanal. Use quando detectar dados inconsistentes ou após sync de dados.',
    parameters: {
      type: 'OBJECT',
      properties: {
        semana: { type: 'STRING', description: 'Data da semana a recalcular (YYYY-MM-DD, segunda-feira). Se vazio, recalcula semana atual.' },
      },
      required: []
    }
  },
  {
    name: 'enviar_notificacao_discord',
    description: 'Envia uma notificação personalizada para o Discord do bar. Use para insights importantes ou alertas urgentes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        titulo: { type: 'STRING', description: 'Título da notificação' },
        mensagem: { type: 'STRING', description: 'Conteúdo da mensagem' },
        cor: { type: 'STRING', description: 'Cor do embed: verde, vermelho, amarelo, azul' },
      },
      required: ['titulo', 'mensagem']
    }
  },
  {
    name: 'registrar_insight',
    description: 'Salva um insight ou padrão detectado no banco para consulta futura. Use quando encontrar algo relevante que vale guardar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tipo: { type: 'STRING', description: 'Tipo do insight: anomalia, oportunidade, padrao, risco' },
        titulo: { type: 'STRING', description: 'Título curto do insight' },
        descricao: { type: 'STRING', description: 'Descrição completa do insight com dados' },
        data_referencia: { type: 'STRING', description: 'Data a qual o insight se refere (YYYY-MM-DD)' },
      },
      required: ['tipo', 'titulo', 'descricao']
    }
  },
];

// ============================================================
// TOOL EXECUTORS (as queries reais)
// ============================================================

interface EventoBase {
  data_evento: string;
  real_r: number | null;
  cl_real: number | null;
  t_medio: number | null;
  nome?: string;
}

interface VendaItem {
  produto_desc: string;
  quantidade: number | null;
  valor: number | null;
}

interface ProdutoAgrupado {
  produto: string;
  quantidade: number;
  valor: number;
}

export function createToolExecutor(supabase: SupabaseClient, barId: number) {
  return async (call: FunctionCall): Promise<Record<string, unknown>> => {
    console.log(`🔧 Executando tool: ${call.name}`, call.args);
    
    switch (call.name) {
      case 'consultar_faturamento': {
        const { data_inicio, data_fim } = call.args as { data_inicio: string; data_fim: string };
        
        // Validar período máximo de 90 dias
        const inicio = new Date(data_inicio);
        const fim = new Date(data_fim);
        const diffDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias > 90) {
          return { error: 'Período máximo permitido: 90 dias' };
        }
        
        const { data } = await supabase
          .from('eventos_base')
          .select('data_evento, real_r, cl_real, t_medio, nome')
          .eq('bar_id', barId)
          .gte('data_evento', data_inicio)
          .lte('data_evento', data_fim)
          .order('data_evento', { ascending: false });

        const eventos = (data || []) as EventoBase[];
        const total = eventos.reduce((s, e) => s + (e.real_r || 0), 0);
        const publico = eventos.reduce((s, e) => s + (e.cl_real || 0), 0);
        return {
          faturamento_total: total,
          publico_total: publico,
          ticket_medio: publico > 0 ? total / publico : 0,
          num_eventos: eventos.length,
          eventos: eventos.slice(0, 10),
        };
      }

      case 'consultar_clientes': {
        const { data_inicio, data_fim } = call.args as { data_inicio: string; data_fim: string };
        
        // Validar período máximo de 90 dias
        const inicio = new Date(data_inicio);
        const fim = new Date(data_fim);
        const diffDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias > 90) {
          return { error: 'Período máximo permitido: 90 dias' };
        }
        
        const { data } = await supabase
          .from('eventos_base')
          .select('data_evento, cl_real, t_medio, real_r, nome')
          .eq('bar_id', barId)
          .gte('data_evento', data_inicio)
          .lte('data_evento', data_fim)
          .order('data_evento', { ascending: false });

        const eventos = (data || []) as EventoBase[];
        const totalClientes = eventos.reduce((s, e) => s + (e.cl_real || 0), 0);
        const totalFat = eventos.reduce((s, e) => s + (e.real_r || 0), 0);
        return {
          total_clientes: totalClientes,
          ticket_medio: totalClientes > 0 ? totalFat / totalClientes : 0,
          media_por_dia: eventos.length > 0 ? totalClientes / eventos.length : 0,
          eventos: eventos.slice(0, 10),
        };
      }

      case 'consultar_cmv': {
        const limite = (call.args as { limite_semanas?: number }).limite_semanas || 4;
        const { data } = await supabase
          .from('cmv_semanal')
          .select('*')
          .eq('bar_id', barId)
          .order('data_inicio', { ascending: false })
          .limit(limite);
        return { semanas: data || [] };
      }

      case 'consultar_metas': {
        const now = new Date();
        const mes = (call.args as { mes?: number }).mes || now.getMonth() + 1;
        const { data: metas } = await supabase
          .from('bar_metas_periodo')
          .select('*')
          .eq('bar_id', barId);

        const { data: eventos } = await supabase
          .from('eventos_base')
          .select('data_evento, real_r, cl_real')
          .eq('bar_id', barId)
          .gte('data_evento', `${now.getFullYear()}-${String(mes).padStart(2, '0')}-01`)
          .lte('data_evento', `${now.getFullYear()}-${String(mes).padStart(2, '0')}-31`);

        const eventosArr = (eventos || []) as EventoBase[];
        const realizado = eventosArr.reduce((s, e) => s + (e.real_r || 0), 0);
        return {
          metas_por_dia: metas || [],
          realizado_mes: realizado,
          num_eventos_mes: eventosArr.length,
        };
      }

      case 'consultar_produtos_top': {
        const { data_inicio, data_fim } = call.args as { data_inicio: string; data_fim: string };
        const limite = Math.min((call.args as { limite?: number }).limite || 10, 20);
        
        // Validar período máximo de 30 dias
        const inicio = new Date(data_inicio);
        const fim = new Date(data_fim);
        const diffDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias > 30) {
          return { error: 'Período máximo permitido: 30 dias' };
        }
        
        const { data } = await supabase
          .from('vendas_item')
          .select('produto_desc, quantidade, valor')
          .eq('bar_id', barId)
          .gte('data_venda', data_inicio)
          .lte('data_venda', data_fim);

        const itens = (data || []) as VendaItem[];
        const agrupado = itens.reduce((acc: Record<string, ProdutoAgrupado>, item) => {
          const key = item.produto_desc;
          if (!acc[key]) acc[key] = { produto: key, quantidade: 0, valor: 0 };
          acc[key].quantidade += item.quantidade || 0;
          acc[key].valor += item.valor || 0;
          return acc;
        }, {});

        const ranking = Object.values(agrupado)
          .sort((a, b) => b.valor - a.valor)
          .slice(0, limite);

        return { produtos: ranking };
      }

      case 'comparar_periodos': {
        const args = call.args as {
          periodo1_inicio: string;
          periodo1_fim: string;
          periodo2_inicio: string;
          periodo2_fim: string;
        };
        const [{ data: p1 }, { data: p2 }] = await Promise.all([
          supabase.from('eventos_base').select('real_r, cl_real, t_medio')
            .eq('bar_id', barId).gte('data_evento', args.periodo1_inicio).lte('data_evento', args.periodo1_fim),
          supabase.from('eventos_base').select('real_r, cl_real, t_medio')
            .eq('bar_id', barId).gte('data_evento', args.periodo2_inicio).lte('data_evento', args.periodo2_fim),
        ]);

        const sum = (arr: EventoBase[] | null, key: keyof EventoBase) => 
          (arr || []).reduce((s, e) => s + (Number(e[key]) || 0), 0);
        
        const fat1 = sum(p1 as EventoBase[], 'real_r');
        const fat2 = sum(p2 as EventoBase[], 'real_r');
        const cl1 = sum(p1 as EventoBase[], 'cl_real');
        const cl2 = sum(p2 as EventoBase[], 'cl_real');
        
        return {
          periodo1: { faturamento: fat1, clientes: cl1, ticket: cl1 > 0 ? fat1/cl1 : 0 },
          periodo2: { faturamento: fat2, clientes: cl2, ticket: cl2 > 0 ? fat2/cl2 : 0 },
          variacao: {
            faturamento_pct: fat2 > 0 ? ((fat1 - fat2) / fat2 * 100) : 0,
            clientes_pct: cl2 > 0 ? ((cl1 - cl2) / cl2 * 100) : 0,
          }
        };
      }

      case 'consultar_tendencia': {
        const semanas = [];
        const hoje = new Date();
        for (let i = 0; i < 4; i++) {
          const fim = new Date(hoje);
          fim.setDate(hoje.getDate() - (i * 7));
          const inicio = new Date(fim);
          inicio.setDate(fim.getDate() - 6);

          const { data } = await supabase
            .from('eventos_base')
            .select('real_r, cl_real')
            .eq('bar_id', barId)
            .gte('data_evento', inicio.toISOString().split('T')[0])
            .lte('data_evento', fim.toISOString().split('T')[0]);

          const eventos = (data || []) as EventoBase[];
          const fat = eventos.reduce((s, e) => s + (e.real_r || 0), 0);
          const cl = eventos.reduce((s, e) => s + (e.cl_real || 0), 0);
          semanas.push({ semana: i + 1, faturamento: fat, clientes: cl });
        }
        return { semanas };
      }

      case 'consultar_estoque': {
        const data_consulta = (call.args as { data?: string }).data || 
          new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const { data } = await supabase
          .from('contahub_stockout_filtrado')
          .select('*')
          .eq('bar_id', barId)
          .eq('data_consulta', data_consulta)
          .order('tempo_ruptura_min', { ascending: false })
          .limit(20);
        return { rupturas: data || [] };
      }

      case 'consultar_calendario': {
        const limite = (call.args as { limite?: number }).limite || 10;
        const hoje = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('calendario_operacional')
          .select('*')
          .eq('bar_id', barId)
          .gte('data', hoje)
          .order('data', { ascending: true })
          .limit(limite);
        return { eventos: data || [] };
      }

      case 'consultar_tempos_producao': {
        const { data_inicio, data_fim } = call.args as { data_inicio: string; data_fim: string };
        
        // Validar período máximo de 30 dias
        const inicio = new Date(data_inicio);
        const fim = new Date(data_fim);
        const diffDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias > 30) {
          return { error: 'Período máximo permitido: 30 dias' };
        }
        
        const { data: tempos } = await supabase.rpc('calcular_tempo_saida', {
          p_bar_id: barId, p_data_inicio: data_inicio, p_data_fim: data_fim
        });
        const { data: atrasos } = await supabase.rpc('calcular_atrasos_tempo', {
          p_bar_id: barId, p_data_inicio: data_inicio, p_data_fim: data_fim
        });
        return { tempos, atrasos };
      }

      case 'consultar_mix_vendas': {
        const { data_inicio, data_fim } = call.args as { data_inicio: string; data_fim: string };
        
        // Validar período máximo de 30 dias
        const inicio = new Date(data_inicio);
        const fim = new Date(data_fim);
        const diffDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias > 30) {
          return { error: 'Período máximo permitido: 30 dias' };
        }
        
        const { data } = await supabase.rpc('calcular_mix_vendas', {
          p_bar_id: barId, p_data_inicio: data_inicio, p_data_fim: data_fim
        });
        return { mix: data };
      }

      case 'consultar_desempenho_semanal': {
        const numSemanas = Math.min((call.args as { semanas?: number }).semanas || 4, 12);
        const { data } = await supabase
          .from('desempenho_semanal')
          .select('*')
          .eq('bar_id', barId)
          .order('data_inicio', { ascending: false })
          .limit(numSemanas);
        return { semanas: data || [] };
      }

      // ============================================================
      // EXECUTORES DE AÇÃO
      // ============================================================

      case 'criar_alerta': {
        const { titulo, mensagem, prioridade, acao_sugerida } = call.args as {
          titulo: string;
          mensagem: string;
          prioridade: string;
          acao_sugerida?: string;
        };
        
        const severidadeMap: Record<string, string> = {
          'critico': 'critico',
          'alto': 'alto',
          'medio': 'medio',
          'baixo': 'baixo'
        };

        const { data, error } = await supabase
          .from('agente_alertas')
          .insert({
            bar_id: barId,
            tipo_alerta: 'agente_ia',
            severidade: severidadeMap[prioridade] || 'medio',
            mensagem: `**${titulo}**\n\n${mensagem}${acao_sugerida ? `\n\n**Ação sugerida:** ${acao_sugerida}` : ''}`,
            dados: { 
              titulo, 
              prioridade, 
              acao_sugerida: acao_sugerida || null,
              origem: 'tool_criar_alerta'
            },
            enviado: false,
            lido: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) return { error: error.message };
        return { 
          success: true, 
          alerta_id: data.id, 
          message: `Alerta "${titulo}" criado com severidade ${prioridade}` 
        };
      }

      case 'disparar_recalculo_desempenho': {
        const semana = (call.args as { semana?: string }).semana || null;

        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/recalcular-desempenho-v2`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ bar_id: barId, semana })
          }
        );

        const result = await response.json();
        return { 
          success: response.ok, 
          message: response.ok ? 'Recálculo disparado com sucesso' : 'Erro ao disparar recálculo', 
          details: result 
        };
      }

      case 'enviar_notificacao_discord': {
        const { titulo, mensagem, cor } = call.args as {
          titulo: string;
          mensagem: string;
          cor?: string;
        };
        const cores: Record<string, number> = {
          verde: 0x00ff00, 
          vermelho: 0xff0000, 
          amarelo: 0xffaa00, 
          azul: 0x0099ff
        };

        let webhookUrl = Deno.env.get('DISCORD_WEBHOOK_AGENTES');
        
        if (!webhookUrl) {
          const { data } = await supabase
            .from('discord_webhooks')
            .select('webhook_url')
            .eq('tipo', 'agentes')
            .eq('ativo', true)
            .single();
          webhookUrl = data?.webhook_url;
        }

        if (!webhookUrl) {
          return { error: 'Webhook Discord não configurado' };
        }

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: titulo,
              description: mensagem,
              color: cores[cor || 'azul'] || 0x0099ff,
              timestamp: new Date().toISOString(),
              footer: { text: `Zykor AI Agent | Bar ${barId}` }
            }]
          })
        });

        return { 
          success: true, 
          message: `Notificação "${titulo}" enviada para Discord` 
        };
      }

      case 'registrar_insight': {
        const { tipo, titulo, descricao, data_referencia } = call.args as {
          tipo: string;
          titulo: string;
          descricao: string;
          data_referencia?: string;
        };
        const { data, error } = await supabase
          .from('agente_insights')
          .insert({
            bar_id: barId,
            tipo,
            categoria: tipo,
            titulo,
            descricao,
            dados_suporte: { 
              data_referencia: data_referencia || new Date().toISOString().split('T')[0],
              origem: 'tool_registrar_insight'
            },
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) return { error: error.message };
        return { 
          success: true, 
          insight_id: data.id, 
          message: `Insight "${titulo}" registrado` 
        };
      }

      default:
        return { error: `Tool ${call.name} não implementada` };
    }
  };
}
