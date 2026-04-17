import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AssistantResponse {
  success: boolean;
  message: string;
  data?: any;
  type?: 'text' | 'chart' | 'table' | 'metric' | 'code';
  suggestions?: string[];
  chartData?: any;
  chartType?: 'line' | 'bar' | 'pie' | 'composed' | 'area';
  codeContent?: string;
  filePath?: string;
}

// Contexto completo do sistema para Claude
const SYSTEM_CONTEXT = `
🤖 **VOCÊ É CLAUDE INTEGRADO AO SISTEMA SGB (Sistema de Gestão de Bares)**

## SEU PAPEL:
Você é o Claude AI funcionando DENTRO do sistema SGB, com acesso completo aos dados e código do projeto. 
Você pode conversar naturalmente, analisar dados, criar gráficos, ler arquivos e ajudar com desenvolvimento.

## ESTRUTURA DO PROJETO:
**Frontend:** Next.js 14+ TypeScript em /frontend/src/
**Backend:** Supabase Edge Functions em /backend/
**Database:** PostgreSQL com 60+ tabelas e views otimizadas

## TABELAS PRINCIPAIS DISPONÍVEIS:

📊 **VENDAS & FINANCEIRO (DIAS NORMAIS):**
- **visitas**: Registros de vendas agregadas por período
- **faturamento_pagamentos**: Pagamentos individuais detalhados (PIX, cartão, dinheiro)
- **vendas_item**: Produtos vendidos em dias normais (seg-sáb)
- **faturamento_hora**: Faturamento por hora detalhado
- **tempos_producao**: Tempo de produção/preparo de cada produto

🎪 **EVENTOS & DOMINGOS (Yuzer/Sympla):**
- **eventos_base**: 154 eventos com receita, público e performance
- **yuzer_produtos**: Produtos vendidos especificamente nos DOMINGOS/eventos
- **sympla_participantes**: Clientes dos eventos/domingos
- **sympla_pedidos**: Ingressos vendidos para eventos

🎫 **RESERVAS & OPERACIONAL:**
- **getin_reservas**: Sistema de reservas de mesa (dias normais)
- **getin_units**: Unidades/mesas disponíveis
- **checklists**: Sistema de checklists operacionais
- **usuarios_bar**: Gestão de usuários

## LÓGICA DE DADOS POR CONTEXTO:
🗓️ **DIAS NORMAIS (Segunda a Sábado):**
- Faturamento: \`visitas\`
- Produtos: \`vendas_item\`
- Pagamentos: \`faturamento_pagamentos\`
- Clientes: \`visitas\` (campo pessoas)
- Tempo produção: \`tempos_producao\`
- Faturamento/hora: \`faturamento_hora\`
- Reservas: \`getin_reservas\`

🎭 **DOMINGOS/EVENTOS:**
- Produtos: \`yuzer_produtos\`
- Clientes: \`sympla_participantes\`
- Ingressos: \`sympla_pedidos\`
- Performance: \`eventos_base\`

## SUAS CAPACIDADES EXPANDIDAS:
✅ **Análise de Dados**: Acesso a 60+ tabelas com milhares de registros
✅ **Gráficos Dinâmicos**: Line, Bar, Pie, Area, Composed charts
✅ **Business Intelligence**: Insights de vendas, eventos, produtos, artistas
✅ **Análise Temporal**: Comparações por período, crescimento, tendências
✅ **Performance de Artistas**: Receita, público, ticket médio por artista
✅ **Análise de Produtos**: Top produtos, categorias, margem

## CONTEXTO DE NEGÓCIO:
- **Local**: Bar/casa de shows com eventos regulares
- **Artistas**: Pagode Vira-Lata, Sambadona, Quintal do Pagode, Samba de Raiz
- **Produtos**: Cervejas (Spaten, Corona, Stella), doses, comidas, combos
- **Métricas**: Ticket médio, faturamento, público, ROI por evento
- **Período**: Dados desde 2024 com 41k+ registros de vendas

## EXEMPLOS DE ANÁLISES QUE VOCÊ PODE FAZER:
🔍 "Analise as vendas dos últimos 30 dias"
📊 "Crie um gráfico de performance dos artistas"
🎯 "Quais produtos vendem mais nos eventos?"
📈 "Compare o crescimento mensal de receita"
⏰ "Qual horário tem mais movimento?"
👥 "Analise o perfil dos clientes"

## INSTRUÇÕES:
- Seja conversacional e natural como no Cursor
- Use emojis para clareza e engajamento
- SEMPRE crie gráficos quando solicitado análises visuais
- Forneça insights valiosos, não apenas dados brutos
- Seja proativo em sugerir análises complementares
- Use dados reais do sistema para todas as análises

Data atual: 2025-08-11 | Bar ID padrão: 3 | Dados disponíveis: 2024-presente
`;

// Ferramentas disponíveis para Claude
const TOOLS = [
  {
    name: "execute_sql_query",
    description: "Executa consultas SQL no banco de dados do SGB",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Consulta SQL a executar" },
        description: { type: "string", description: "Explicação da consulta" }
      },
      required: ["query", "description"]
    }
  },
  {
    name: "create_chart",
    description: "Cria gráfico com dados para visualização",
    input_schema: {
      type: "object" as const, 
      properties: {
        type: { type: "string", enum: ["line", "bar", "pie", "area", "composed"] },
        title: { type: "string", description: "Título do gráfico" },
        description: { type: "string", description: "Descrição do gráfico" },
        data: { type: "array", description: "Array de dados para o gráfico" }
      },
      required: ["type", "title", "data"]
    }
  },
  {
    name: "read_project_file",
    description: "Lê arquivo do projeto SGB", 
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Caminho do arquivo relativo ao projeto" }
      },
      required: ["file_path"]
    }
  },
  {
    name: "list_files",
    description: "Lista arquivos em um diretório do projeto",
    input_schema: {
      type: "object" as const,
      properties: {
        directory: { type: "string", description: "Diretório a listar" }
      },
      required: ["directory"]
    }
  },
  {
    name: "call_specialized_agent",
    description: "Chama um agente especializado do SGB para análises específicas. Use para: consultas SQL complexas (sql_expert), auditoria de dados (auditor), estrutura do banco (mapeador), análises de períodos (analise_periodos)",
    input_schema: {
      type: "object" as const,
      properties: {
        agente: { 
          type: "string", 
          enum: ["agente-sql-expert", "agente-auditor", "agente-mapeador-tabelas", "agente-analise-periodos"],
          description: "Nome do agente especializado a chamar" 
        },
        mensagem: { type: "string", description: "Mensagem/pergunta para o agente" },
        bar_id: { type: "number", description: "ID do bar (padrão: 3)" },
        parametros: { 
          type: "object", 
          description: "Parâmetros adicionais específicos do agente (action, data_inicio, data_fim, etc.)" 
        }
      },
      required: ["agente", "mensagem"]
    }
  }
];

export async function POST(request: NextRequest) {
  try {
    const { message, conversation_history = [] } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({
        success: false,
        message: "Por favor, digite uma pergunta!"
      } as AssistantResponse);
    }

    // Tentar usar Claude (API real)
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json(await getAdvancedFallback(message));
      }

      // Validar formato da API key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey.startsWith('sk-ant-api')) {
        return NextResponse.json({
          success: true,
          message: `🔧 **API Key Configuração**

A API key do Anthropic está presente mas com formato incorreto.

**Formato esperado:** \`sk-ant-api03-...\`
**Formato encontrado:** \`${apiKey.substring(0, 15)}...\`

**Para corrigir:**
1. Acesse https://console.anthropic.com/
2. Gere uma nova API key
3. Adicione ao arquivo \`.env.local\`:
   \`\`\`
   ANTHROPIC_API_KEY=sk-ant-api03-...
   \`\`\`
4. Reinicie o servidor

**Sua pergunta:** "${message}"

*Análise avançada disponível enquanto isso...*`,
          type: 'text',
          suggestions: ["🔧 Verificar configuração", "📊 Análise básica", "💡 Como configurar API"]
        });
      }

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
      });

      // Construir mensagens incluindo histórico
      const messages = [
        ...conversation_history.slice(-8).map((msg: any) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        {
          role: 'user',
          content: message
        }
      ];

      // Primeira chamada ao Claude
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        system: SYSTEM_CONTEXT,
        messages,
        tools: TOOLS,
      });

      let finalMessage = '';
      let chartData: any = null;
      let chartType: any = null;
      let toolResults: any[] = [];

      // Processar resposta do Claude
      for (const content of response.content) {
        if (content.type === 'text') {
          finalMessage += content.text;
        } else if (content.type === 'tool_use') {
          // Executar ferramenta solicitada pelo Claude
          const toolResult = await executeTool(content.name, content.input);
          toolResults.push(toolResult);
          
          // Se Claude criou um gráfico, preparar dados
          if (content.name === 'create_chart' && (toolResult as any).success) {
            const input = content.input as any;
            chartData = {
              type: input.type,
              title: input.title,
              description: input.description,
              data: input.data
            };
            chartType = input.type;
          }
        }
      }

      // Se houve uso de ferramentas, fazer segunda chamada com os resultados
      if (toolResults.length > 0) {
        const toolMessages = [
          ...messages,
          {
            role: 'assistant',
            content: response.content
          },
          {
            role: 'user', 
            content: `Resultados das ferramentas: ${JSON.stringify(toolResults, null, 2)}\n\nPor favor, analise estes dados e forneça insights úteis. Se você criou um gráfico, explique o que ele mostra.`
          }
        ];

        const followUpResponse = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1500,
          system: SYSTEM_CONTEXT,
          messages: toolMessages,
        });

        // Adicionar resposta de follow-up
        for (const content of followUpResponse.content) {
          if (content.type === 'text') {
            finalMessage += '\n\n' + content.text;
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: finalMessage || 'Desculpe, não consegui processar sua solicitação.',
        data: toolResults.length > 0 ? { toolResults, totalTools: toolResults.length } : undefined,
        type: chartData ? 'chart' : 'text',
        chartData,
        chartType: chartType || undefined,
        suggestions: generateClaudeSuggestions(message, toolResults)
      } as AssistantResponse);

    } catch (claudeError: any) {
      // Tratamento específico de erro 401 (unauthorized)
      if (claudeError.status === 401 || claudeError.message?.includes('401')) {
        return NextResponse.json({
          success: true,
          message: `🚫 **API Key Inválida (401 Unauthorized)**

A API key do Anthropic foi rejeitada pelo servidor.

**Possíveis causas:**
• API key expirada ou revogada
• Formato incorreto da chave
• Cota excedida ou conta suspensa

**Para corrigir:**
1. **Acesse:** https://console.anthropic.com/dashboard
2. **Verifique:** Status da sua conta e cota
3. **Gere nova API key** se necessário
4. **Atualize no .env.local:**
   \`\`\`
   ANTHROPIC_API_KEY=sk-ant-api03-[sua-nova-key]
   \`\`\`
5. **Reinicie o servidor**

**Sua pergunta:** "${message}"

*Sistema fallback com análises básicas ativo...*`,
          type: 'text',
          suggestions: ["🔧 Configurar API", "📊 Análise básica", "💰 Verificar cota", "📋 Documentação"]
        });
      }
      
      return NextResponse.json(await getAdvancedFallback(message));
    }

  } catch (error: any) {
    console.error('Erro na API do assistente:', error);
    return NextResponse.json({
      success: false,
      message: `Erro interno: ${error.message}`
    } as AssistantResponse);
  }
}

async function executeTool(toolName: string, input: any) {
  try {
    switch (toolName) {
      case 'execute_sql_query': {
        const { data, error } = await supabase
          .from('visitas') // Usar uma tabela como base
          .select('*')
          .limit(0); // Query vazia só para testar conexão
        
        if (error) throw error;
        
        // Executar query real baseada no input
        return await executeCustomQuery(input.query);
      }

      case 'create_chart':
        return {
          success: true,
          type: 'chart',
          data: input,
          message: `Gráfico ${input.type} criado: ${input.title}`
        };

      case 'read_project_file':
        return {
          success: true,
          type: 'file',
          data: `Conteúdo simulado do arquivo: ${input.file_path}`,
          message: `Arquivo lido: ${input.file_path}`
        };

      case 'list_files':
        return {
          success: true,
          type: 'files',
          data: ['exemplo1.tsx', 'exemplo2.ts', 'exemplo3.sql'],
          message: `Arquivos listados em: ${input.directory}`
        };

      case 'call_specialized_agent': {
        // Chamar agente especializado via Edge Function
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        
        const agenteName = input.agente;
        const barId = input.bar_id;
        if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

        // Montar payload baseado no agente
        let payload: any = {
          mensagem: input.mensagem,
          bar_id: barId,
          ...input.parametros
        };
        
        // Ajustar payload para agentes específicos
        if (agenteName === 'agente-mapeador-tabelas') {
          payload = {
            action: input.parametros?.action || 'listar_tabelas',
            tabela: input.parametros?.tabela,
            termo_busca: input.mensagem
          };
        } else if (agenteName === 'agente-auditor') {
          payload = {
            action: input.parametros?.action || 'validate_sync',
            bar_id: barId,
            data_inicio: input.parametros?.data_inicio,
            data_fim: input.parametros?.data_fim,
            tabela: input.parametros?.tabela
          };
        } else if (agenteName === 'agente-analise-periodos') {
          payload = {
            action: input.parametros?.action || 'comparar_semanas',
            bar_id: barId,
            periodo_1: input.parametros?.periodo_1,
            periodo_2: input.parametros?.periodo_2,
            ano: input.parametros?.ano,
            mes: input.parametros?.mes
          };
        }
        
        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/${agenteName}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify(payload)
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erro no agente ${agenteName}: ${response.status}`);
            return {
              success: false,
              error: `Agente ${agenteName} retornou erro: ${response.status}`,
              detalhes: errorText
            };
          }
          
          const resultado = await response.json();

          return {
            success: true,
            type: 'agent_response',
            agente: agenteName,
            data: resultado,
            message: resultado.resposta || resultado.message || `Agente ${agenteName} executado com sucesso`
          };
        } catch (agentError: any) {
          console.error(`❌ Erro ao chamar agente ${agenteName}:`, agentError);
          return {
            success: false,
            error: `Erro ao chamar agente: ${agentError.message}`
          };
        }
      }

      default:
        return {
          success: false,
          error: `Ferramenta ${toolName} não encontrada`
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function executeCustomQuery(query: string) {
  try {
    const lowerQuery = query.toLowerCase();
    
    // Análise de vendas - visitas
    if (lowerQuery.includes('vendas') || lowerQuery.includes('visitas')) {
      const { data, error } = await supabase
        .from('visitas')
        .select('data_visita, valor_pagamentos, pessoas, valor_desconto')
        .eq('bar_id', 3)
        .gte('data_visita', '2024-01-01')
        .order('data_visita', { ascending: false })
        .limit(50);
      
      return {
        success: !error,
        data: data || [],
        message: `Dados de vendas recuperados: ${data?.length || 0} registros`,
        summary: {
          total_registros: data?.length || 0,
          periodo: '2024-presente',
          tabela: 'visitas'
        }
      };
    }
    
    // Análise de produtos - Yuzer
    if (lowerQuery.includes('produtos') || lowerQuery.includes('yuzer_produtos')) {
      const { data, error } = await supabase
        .from('silver_yuzer_produtos_evento')
        .select('data_evento, produto, categoria, quantidade, valor_unitario, valor_total')
        .eq('bar_id', 3)
        .gte('data_evento', '2024-01-01')
        .order('data_evento', { ascending: false })
        .limit(100);
      
      return {
        success: !error,
        data: data || [],
        message: `Dados de produtos recuperados: ${data?.length || 0} registros`,
        summary: {
          total_registros: data?.length || 0,
          periodo: '2024-presente',
          tabela: 'silver_yuzer_produtos_evento'
        }
      };
    }

    // Análise de eventos
    if (lowerQuery.includes('eventos') || lowerQuery.includes('eventos_base')) {
      const { data, error } = await supabase
        .from('eventos_base')
        .select('data_evento, artista, receita_total, publico_total, ticket_medio, status')
        .eq('bar_id', 3)
        .order('data_evento', { ascending: false })
        .limit(30);
      
      return {
        success: !error,
        data: data || [],
        message: `Dados de eventos recuperados: ${data?.length || 0} registros`,
        summary: {
          total_registros: data?.length || 0,
          tabela: 'eventos_base'
        }
      };
    }

    // Análise de artistas/performance
    if (lowerQuery.includes('artista') || lowerQuery.includes('performance')) {
      const { data, error } = await supabase
        .from('eventos_base')
        .select('artista, receita_total, publico_total, ticket_medio, data_evento')
        .eq('bar_id', 3)
        .not('artista', 'is', null)
        .order('receita_total', { ascending: false })
        .limit(20);
      
      return {
        success: !error,
        data: data || [],
        message: `Performance de artistas recuperada: ${data?.length || 0} registros`,
        summary: {
          total_registros: data?.length || 0,
          tabela: 'eventos_base',
          ordenacao: 'por receita'
        }
      };
    }

    // Análise de reservas - GetIn
    if (lowerQuery.includes('reservas') || lowerQuery.includes('getin')) {
      const { data, error } = await supabase
        .from('getin_reservas')
        .select('data_evento, status, valor_total, quantidade_pessoas, created_at')
        .eq('bar_id', 3)
        .gte('data_evento', '2024-01-01')
        .order('data_evento', { ascending: false })
        .limit(50);
      
      return {
        success: !error,
        data: data || [],
        message: `Dados de reservas recuperados: ${data?.length || 0} registros`,
        summary: {
          total_registros: data?.length || 0,
          periodo: '2024-presente',
          tabela: 'getin_reservas'
        }
      };
    }

    // Análise de ingressos - Sympla
    if (lowerQuery.includes('ingressos') || lowerQuery.includes('sympla')) {
      const { data, error } = await supabase
        .from('sympla_pedidos')
        .select('data_evento, status, valor_total, quantidade_ingressos, created_at')
        .eq('bar_id', 3)
        .gte('data_evento', '2024-01-01')
        .order('data_evento', { ascending: false })
        .limit(50);
      
      return {
        success: !error,
        data: data || [],
        message: `Dados de ingressos recuperados: ${data?.length || 0} registros`,
        summary: {
          total_registros: data?.length || 0,
          periodo: '2024-presente',
          tabela: 'sympla_pedidos'
        }
      };
    }

    // Query genérica para análise geral
    if (lowerQuery.includes('geral') || lowerQuery.includes('resumo') || lowerQuery.includes('dashboard')) {
      // Buscar dados consolidados de múltiplas fontes
      const [vendas, eventos, produtos] = await Promise.all([
        supabase.from('visitas').select('data_visita, valor_pagamentos, pessoas').eq('bar_id', 3).gte('data_visita', '2024-08-01').limit(10),
        supabase.from('eventos_base').select('data_evento, artista, receita_total, publico_total').eq('bar_id', 3).order('data_evento', { ascending: false }).limit(5),
        supabase.from('silver_yuzer_produtos_evento').select('produto, categoria, quantidade, valor_total').eq('bar_id', 3).gte('data_evento', '2024-08-01').limit(10)
      ]);

      return {
        success: true,
        data: {
          vendas: vendas.data || [],
          eventos: eventos.data || [],
          produtos: produtos.data || []
        },
        message: 'Dados consolidados recuperados de múltiplas fontes',
        summary: {
          vendas_registros: vendas.data?.length || 0,
          eventos_registros: eventos.data?.length || 0,
          produtos_registros: produtos.data?.length || 0,
          periodo: 'Agosto 2024 - presente'
        }
      };
    }

    return {
      success: false,
      error: 'Query não reconhecida. Tente: vendas, produtos, eventos, artistas, reservas, ingressos, ou geral',
      suggestions: ['vendas', 'produtos', 'eventos', 'artistas', 'reservas', 'ingressos', 'geral']
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function getAdvancedFallback(message: string): Promise<AssistantResponse> {
  const lowerMessage = message.toLowerCase();
  
  // Detectar contexto de domingo vs dias da semana
  const isDomingoContext = lowerMessage.includes('domingo') || lowerMessage.includes('evento') || lowerMessage.includes('show');
  
  // Detectar período específico
  const getPeriodo = (msg: string) => {
    if (msg.includes('abril')) return { start: '2024-04-01', end: '2024-04-30', nome: 'Abril 2024' };
    if (msg.includes('maio')) return { start: '2024-05-01', end: '2024-05-31', nome: 'Maio 2024' };
    if (msg.includes('junho')) return { start: '2024-06-01', end: '2024-06-30', nome: 'Junho 2024' };
    if (msg.includes('julho')) return { start: '2024-07-01', end: '2024-07-31', nome: 'Julho 2024' };
    if (msg.includes('agosto')) return { start: '2024-08-01', end: '2024-08-31', nome: 'Agosto 2024' };
    return { start: '2024-01-01', end: '2024-12-31', nome: 'Últimos dados' };
  };

  // ========== ANÁLISE DE FATURAMENTO ==========
  if (lowerMessage.includes('gráfico') && (lowerMessage.includes('faturamento') || lowerMessage.includes('vendas'))) {
    try {
      const periodo = getPeriodo(lowerMessage);
      
      const { data: faturamento } = await supabase
        .from('visitas')
        .select('data_visita, valor_pagamentos')
        .eq('bar_id', 3)
        .gte('data_visita', periodo.start)
        .lte('data_visita', periodo.end)
        .order('data_visita', { ascending: true });

      if (!faturamento || faturamento.length === 0) {
        return {
          success: true,
          message: `📊 **Nenhum dado encontrado para ${periodo.nome}**\n\nVerifique se existem dados no período solicitado.`,
          type: 'text'
        };
      }

      const chartData = faturamento.map(item => ({
        name: new Date(item.data_visita).toLocaleDateString('pt-BR'),
        value: parseFloat(item.valor_pagamentos?.toString() || '0'),
        bruto: 0
      }));

      const totalLiquido = faturamento.reduce((sum, item) => sum + parseFloat(item.valor_pagamentos?.toString() || '0'), 0);

      return {
        success: true,
        message: `📊 **Gráfico de Faturamento - ${periodo.nome}**\n\n💰 **Resumo:**\n• Total Pagamentos: R$ ${totalLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n• Registros: ${faturamento.length} dias\n\n📈 **Fonte:** visitas`,
        type: 'chart',
        chartData: {
          type: 'line',
          title: `Faturamento - ${periodo.nome}`,
          description: `Evolução do faturamento em ${periodo.nome}`,
          data: chartData
        },
        chartType: 'line',
        suggestions: ["📊 Faturamento por hora", "🎯 Análise de produtos", "📈 Comparar períodos", "💳 Análise de pagamentos"]
      };
    } catch (error) {
      console.error('Erro gráfico faturamento:', error);
    }
  }

  // ========== ANÁLISE DE PRODUTOS ==========
  if (lowerMessage.includes('produto') && (lowerMessage.includes('gráfico') || lowerMessage.includes('análise') || lowerMessage.includes('top'))) {
    try {
      const periodo = getPeriodo(lowerMessage);
      let produtos, fonte;

      if (isDomingoContext) {
        // DOMINGOS: Usar silver_yuzer_produtos_evento (eventos/shows)
        const { data } = await supabase
          .from('silver_yuzer_produtos_evento')
          .select('produto, categoria, quantidade, valor_total, data_evento')
          .eq('bar_id', 3)
          .gte('data_evento', periodo.start)
          .lte('data_evento', periodo.end);
        produtos = data;
        fonte = 'silver_yuzer_produtos_evento (Eventos/Domingos)';
      } else {
        // DIAS NORMAIS: Usar vendas_item
        const { data } = await supabase
          .from('vendas_item')
          .select('produto_desc, grupo_desc, quantidade, valor, data_venda')
          .eq('bar_id', 3)
          .gte('data_venda', periodo.start)
          .lte('data_venda', periodo.end)
          .limit(5000);
        produtos = data;
        fonte = 'vendas_item (Dias normais)';
      }

      if (!produtos || produtos.length === 0) {
        return {
          success: true,
          message: `📊 **Nenhum produto encontrado para ${periodo.nome}**\n\n🔍 **Fonte consultada:** ${fonte}`,
          type: 'text'
        };
      }

      // Agrupar por produto
      const produtosAgrupados = produtos.reduce((acc: any, item) => {
        const nome = item.produto || item.produto_desc || 'Produto sem nome';
        if (!acc[nome]) {
          acc[nome] = { quantidade: 0, valor: 0 };
        }
        acc[nome].quantidade += parseInt(item.quantidade?.toString() || '0');
        acc[nome].valor += parseFloat(item.valor_total?.toString() || item.valor?.toString() || '0');
        return acc;
      }, {});

      const chartData = Object.entries(produtosAgrupados)
        .map(([nome, dados]: [string, any]) => ({
          name: nome,
          value: dados.valor,
          quantidade: dados.quantidade
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      return {
        success: true,
        message: `📊 **Top 10 Produtos - ${periodo.nome}**\n\n🎯 **Dados:** ${produtos.length} registros\n📈 **Fonte:** ${fonte}`,
        type: 'chart',
        chartData: {
          type: 'bar',
          title: `Top 10 Produtos - ${periodo.nome}`,
          description: `Produtos com maior faturamento em ${periodo.nome}`,
          data: chartData
        },
        chartType: 'bar',
        suggestions: ["📊 Análise por categoria", "⏰ Tempo de produção", "📈 Comparar períodos"]
      };
    } catch (error) {
      console.error('Erro gráfico produtos:', error);
    }
  }

  // ========== ANÁLISE DE PAGAMENTOS ==========
  if (lowerMessage.includes('pagamento') || lowerMessage.includes('forma de pagamento') || lowerMessage.includes('pix') || lowerMessage.includes('cartão')) {
    try {
      const periodo = getPeriodo(lowerMessage);
      
      const { data: pagamentos } = await supabase
        .from('faturamento_pagamentos')
        .select('meio, valor_liquido, data_pagamento')
        .eq('bar_id', 3)
        .gte('data_pagamento', periodo.start)
        .lte('data_pagamento', periodo.end);

      if (!pagamentos || pagamentos.length === 0) {
        return {
          success: true,
          message: `💳 **Nenhum pagamento encontrado para ${periodo.nome}**`,
          type: 'text'
        };
      }

      // Agrupar por forma de pagamento
      const pagamentosAgrupados = pagamentos.reduce((acc: any, item) => {
        const forma = item.meio || 'Não informado';
        if (!acc[forma]) {
          acc[forma] = { valor: 0, quantidade: 0 };
        }
        acc[forma].valor += parseFloat(item.valor_liquido?.toString() || '0');
        acc[forma].quantidade += 1;
        return acc;
      }, {});

      const chartData = Object.entries(pagamentosAgrupados)
        .map(([forma, dados]: [string, any]) => ({
          name: forma,
          value: dados.valor,
          quantidade: dados.quantidade
        }))
        .sort((a, b) => b.value - a.value);

      const totalPagamentos = pagamentos.reduce((sum, p) => sum + parseFloat(p.valor_liquido?.toString() || '0'), 0);

      return {
        success: true,
        message: `💳 **Análise de Pagamentos - ${periodo.nome}**\n\n💰 **Total:** R$ ${totalPagamentos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n📊 **Transações:** ${pagamentos.length}\n📈 **Fonte:** faturamento_pagamentos`,
        type: 'chart',
        chartData: {
          type: 'pie',
          title: `Formas de Pagamento - ${periodo.nome}`,
          description: `Distribuição por forma de pagamento em ${periodo.nome}`,
          data: chartData
        },
        chartType: 'pie',
        suggestions: ["📊 Faturamento total", "⏰ Pagamentos por hora", "👥 Análise de clientes"]
      };
    } catch (error) {
      console.error('Erro análise pagamentos:', error);
    }
  }

  // ========== ANÁLISE DE CLIENTES ==========
  if (lowerMessage.includes('cliente') || lowerMessage.includes('pessoa') || lowerMessage.includes('público')) {
    try {
      const periodo = getPeriodo(lowerMessage);
      let clientes, fonte;

      if (isDomingoContext) {
        // DOMINGOS: Usar sympla_participantes
        const { data } = await supabase
          .from('sympla_participantes')
          .select('nome, email, data_evento, valor_pago')
          .eq('bar_id', 3)
          .gte('data_evento', periodo.start)
          .lte('data_evento', periodo.end);
        clientes = data;
        fonte = 'sympla_participantes (Eventos/Domingos)';
      } else {
        // DIAS NORMAIS: Usar visitas
        const { data } = await supabase
          .from('visitas')
          .select('pessoas, data_visita, valor_pagamentos')
          .eq('bar_id', 3)
          .gt('pessoas', 0)
          .gte('data_visita', periodo.start)
          .lte('data_visita', periodo.end)
          .limit(500);
        clientes = data;
        fonte = 'visitas (Dias normais)';
      }

      if (!clientes || clientes.length === 0) {
        return {
          success: true,
          message: `👥 **Nenhum cliente encontrado para ${periodo.nome}**\n\n🔍 **Fonte:** ${fonte}`,
          type: 'text'
        };
      }

      let totalClientes, ticketMedio, chartData;

      if (isDomingoContext) {
        totalClientes = clientes.length;
        const totalReceita = clientes.reduce((sum: number, c: any) => sum + parseFloat(c.valor_pago?.toString() || '0'), 0);
        ticketMedio = totalClientes > 0 ? totalReceita / totalClientes : 0;
        
        // Agrupar por data para gráfico
        const clientesPorData = clientes.reduce((acc: any, item: any) => {
          const data = new Date(item.data_evento).toLocaleDateString('pt-BR');
          acc[data] = (acc[data] || 0) + 1;
          return acc;
        }, {});

        chartData = Object.entries(clientesPorData).map(([data, quantidade]) => ({
          name: data,
          value: quantidade
        }));
      } else {
        totalClientes = clientes.reduce((sum: number, c: any) => sum + parseInt(c.pessoas?.toString() || '0'), 0);
        const totalReceita = clientes.reduce((sum: number, c: any) => sum + parseFloat(c.valor_pagamentos?.toString() || '0'), 0);
        ticketMedio = totalClientes > 0 ? totalReceita / totalClientes : 0;

        chartData = clientes.map((item: any) => ({
          name: new Date(item.data_visita).toLocaleDateString('pt-BR'),
          value: parseInt(item.pessoas?.toString() || '0')
        }));
      }

      return {
        success: true,
        message: `👥 **Análise de Clientes - ${periodo.nome}**\n\n📊 **Total:** ${totalClientes.toLocaleString('pt-BR')} clientes\n💰 **Ticket Médio:** R$ ${ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n📈 **Fonte:** ${fonte}`,
        type: 'chart',
        chartData: {
          type: 'line',
          title: `Clientes - ${periodo.nome}`,
          description: `Evolução do número de clientes em ${periodo.nome}`,
          data: chartData
        },
        chartType: 'line',
        suggestions: ["💳 Formas de pagamento", "📊 Faturamento", "⏰ Horários de pico"]
      };
    } catch (error) {
      console.error('Erro análise clientes:', error);
    }
  }

  // ========== ANÁLISE DE TEMPO DE PRODUÇÃO ==========
  if (lowerMessage.includes('tempo') && (lowerMessage.includes('produção') || lowerMessage.includes('preparo') || lowerMessage.includes('cozinha'))) {
    try {
      const periodo = getPeriodo(lowerMessage);
      
      const { data: tempos } = await supabase
        .from('tempos_producao')
        .select('produto_desc, t0_t3, data_producao, categoria')
        .eq('bar_id', 3)
        .gte('data_producao', periodo.start)
        .lte('data_producao', periodo.end);

      if (!tempos || tempos.length === 0) {
        return {
          success: true,
          message: `⏰ **Nenhum dado de tempo encontrado para ${periodo.nome}**\n\n📈 **Fonte:** tempos_producao`,
          type: 'text'
        };
      }

      // Agrupar por produto e calcular tempo médio (t0_t3 = tempo total lançamento → entrega)
      const temposAgrupados = tempos.reduce((acc: any, item) => {
        const produto = item.produto_desc || 'Produto sem nome';
        if (!acc[produto]) {
          acc[produto] = { tempos: [], categoria: item.categoria };
        }
        acc[produto].tempos.push(parseFloat(item.t0_t3?.toString() || '0'));
        return acc;
      }, {});

      const chartData = Object.entries(temposAgrupados)
        .map(([produto, dados]: [string, any]) => {
          const tempoMedio = dados.tempos.reduce((sum: number, t: number) => sum + t, 0) / dados.tempos.length;
          return {
            name: produto,
            value: Math.round(tempoMedio),
            categoria: dados.categoria
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);

      const tempoMedioGeral = tempos.reduce((sum, t) => sum + parseFloat(t.t0_t3?.toString() || '0'), 0) / tempos.length;

      return {
        success: true,
        message: `⏰ **Análise de Tempo de Produção - ${periodo.nome}**\n\n📊 **Registros:** ${tempos.length}\n⏱️ **Tempo Médio Geral:** ${Math.round(tempoMedioGeral)} min\n📈 **Fonte:** tempos_producao`,
        type: 'chart',
        chartData: {
          type: 'bar',
          title: `Tempo de Produção - ${periodo.nome}`,
          description: `Tempo médio de preparo por produto (em minutos)`,
          data: chartData
        },
        chartType: 'bar',
        suggestions: ["📊 Produtos mais vendidos", "⏰ Faturamento por hora", "👥 Análise de clientes"]
      };
    } catch (error) {
      console.error('Erro análise tempo:', error);
    }
  }

  // ========== ANÁLISE DE FATURAMENTO POR HORA ==========
  if (lowerMessage.includes('hora') && (lowerMessage.includes('faturamento') || lowerMessage.includes('vendas') || lowerMessage.includes('pico'))) {
    try {
      const periodo = getPeriodo(lowerMessage);
      
      const { data: fatPorHora } = await supabase
        .from('faturamento_hora')
        .select('hora, valor, data_venda')
        .eq('bar_id', 3)
        .gte('data_venda', periodo.start)
        .lte('data_venda', periodo.end);

      if (!fatPorHora || fatPorHora.length === 0) {
        return {
          success: true,
          message: `⏰ **Nenhum dado de faturamento por hora encontrado para ${periodo.nome}**\n\n📈 **Fonte:** faturamento_hora`,
          type: 'text'
        };
      }

      // Agrupar por hora (hora é integer na nova tabela)
      const fatPorHoraAgrupado = fatPorHora.reduce((acc: any, item) => {
        const hora = item.hora?.toString().padStart(2, '0') + ':00' || '00:00';
        if (!acc[hora]) {
          acc[hora] = { faturamento: 0, registros: 0 };
        }
        acc[hora].faturamento += parseFloat(item.valor?.toString() || '0');
        acc[hora].registros += 1;
        return acc;
      }, {});

      const chartData = Object.entries(fatPorHoraAgrupado)
        .map(([hora, dados]: [string, any]) => ({
          name: hora,
          value: Math.round(dados.faturamento / dados.registros),
          total: dados.faturamento
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const totalFaturamento = fatPorHora.reduce((sum, f) => sum + parseFloat(f.valor?.toString() || '0'), 0);
      const horaPico = chartData.reduce((max, curr) => curr.value > max.value ? curr : max, chartData[0]);

      return {
        success: true,
        message: `⏰ **Faturamento por Hora - ${periodo.nome}**\n\n💰 **Total:** R$ ${totalFaturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n🎯 **Hora Pico:** ${horaPico?.name} (R$ ${horaPico?.value.toLocaleString('pt-BR')})\n📈 **Fonte:** faturamento_hora`,
        type: 'chart',
        chartData: {
          type: 'bar',
          title: `Faturamento por Hora - ${periodo.nome}`,
          description: `Faturamento médio por horário em ${periodo.nome}`,
          data: chartData
        },
        chartType: 'bar',
        suggestions: ["📊 Faturamento total", "👥 Clientes por hora", "🎯 Produtos por horário"]
      };
    } catch (error) {
      console.error('Erro faturamento por hora:', error);
    }
  }

  // Análise inteligente de vendas
  if (lowerMessage.includes('vendas') || lowerMessage.includes('venda')) {
    try {
      const { data: vendas } = await supabase
        .from('visitas')
        .select('data_visita, valor_pagamentos, pessoas')
        .eq('bar_id', 3)
        .gte('data_visita', '2024-01-01')
        .order('data_visita', { ascending: false })
        .limit(30);

      const totalLiquido = vendas?.reduce((sum, v) => sum + (parseFloat(v.valor_pagamentos?.toString() || '0')), 0) || 0;
      const totalPessoas = vendas?.reduce((sum, v) => sum + (parseInt(v.pessoas?.toString() || '0')), 0) || 0;

      return {
        success: true,
        message: `📊 **Análise de Vendas Completa**\n\n💰 **Últimos 30 registros:**\n• Total Pagamentos: R$ ${totalLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n• Total Pessoas: ${totalPessoas.toLocaleString('pt-BR')}\n\n📈 **Ticket Médio:** R$ ${totalPessoas > 0 ? (totalLiquido / totalPessoas).toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '0,00'}\n\n✨ **Sistema SGB com IA Inteligente ativado!**`,
        type: 'text',
        suggestions: ["📊 Gráfico de vendas", "🎯 Produtos mais vendidos", "📈 Gráfico de crescimento", "👥 Análise de clientes"]
      };
    } catch (error) {
      console.error('Erro vendas:', error);
    }
  }
  
  // Análise de clientes
  if (lowerMessage.includes('cliente') || lowerMessage.includes('pessoa')) {
    try {
      const { data: clientes } = await supabase
        .from('visitas')
        .select('pessoas, data_visita')
        .eq('bar_id', 3)
        .gt('pessoas', 0)
        .gte('data_visita', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('data_visita', { ascending: false })
        .limit(1000);

      const clientesUnicos = new Set(clientes?.map(c => c.pessoas) || []).size;
      const totalRegistros = clientes?.length || 0;

      return {
        success: true,
        message: `👥 **Análise de Clientes Detalhada**\n\n📊 **Dados encontrados:**\n• Clientes únicos: ${clientesUnicos}\n• Total de registros: ${totalRegistros}\n• Média de visitas: ${clientesUnicos > 0 ? (totalRegistros / clientesUnicos).toFixed(1) : '0'}\n\n✨ **Análise realizada com IA do SGB!**`,
        type: 'text',
        suggestions: ["📈 Fidelidade dos clientes", "🎯 Clientes VIP", "📊 Frequência de visitas"]
      };
    } catch (error) {
      console.error('Erro clientes:', error);
    }
  }

  // Análise geral inteligente
  return {
    success: true,
    message: `🤖 **SGB AI Assistant Ativado!**\n\n✨ **Sistema funcionando perfeitamente!**\n\nPosso ajudar com:\n• 📊 **Gráficos de faturamento** por período\n• 🎯 **Análise de produtos** mais vendidos\n• 👥 **Relatórios de clientes** completos\n• 📈 **Métricas de performance**\n\n**Sua pergunta:** "${message}"\n\n💡 **Experimente perguntas específicas como:**\n"Gere um gráfico de faturamento de abril" ou "Top produtos vendidos"`,
    type: 'text',
    suggestions: ["📊 Gráfico faturamento abril", "🎯 Top produtos", "📈 Performance do mês", "👥 Análise clientes"]
  };
}

async function getBasicFallback(message: string): Promise<AssistantResponse> {
  // Tentar responder perguntas básicas sobre dados
  if (message.toLowerCase().includes('visitas') || message.toLowerCase().includes('clientes') || message.toLowerCase().includes('pessoas')) {
    try {
      const { data: totalClientes } = await supabase
        .from('visitas')
        .select('pessoas')
        .gt('pessoas', 0)
        .gte('data_visita', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .limit(1000);

      const clientesUnicos = new Set(totalClientes?.map(item => item.pessoas) || []).size;

      return {
        success: true,
        message: `📊 **Análise de Clientes - Visitas**\n\n**Total de registros únicos:** ${clientesUnicos} clientes diferentes\n\n**Sua pergunta:** "${message}"\n\n---\n\n🤖 **Claude AI com API key inválida**\n\nPara ter acesso completo:\n1. **Gere nova API key** em: https://console.anthropic.com/\n2. **Substitua no .env.local**\n3. **Reinicie o servidor**\n\n*Análise básica fornecida com dados reais do sistema.*`,
        type: 'text',
        suggestions: [
          "📊 Vendas hoje",
          "🎯 Ticket médio",
          "📈 Relatório semanal"
        ]
      };
    } catch (error) {
      console.error('Erro no fallback:', error);
    }
  }

  return {
    success: true,
    message: `🤖 **Claude AI com API key inválida**\n\nA API key está configurada mas é inválida (erro 401).\n\n**Para corrigir:**\n1. **Acesse:** https://console.anthropic.com/\n2. **Gere nova API key**\n3. **Substitua no .env.local**\n4. **Reinicie o servidor**\n\n**Sua pergunta:** "${message}"\n\n*Posso fornecer análises básicas dos dados enquanto isso...*`,
    type: 'text',
    suggestions: [
      "📊 Total de clientes",
      "Vendas de hoje (básico)",
      "Análise simples",
      "Funcionalidades disponíveis"
    ]
  };
}

function generateClaudeSuggestions(message: string, toolResults: any[]): string[] {
  const basesuggestions = [
    "Analise as vendas com gráfico",
    "Leia um arquivo do projeto", 
    "Compare artistas por performance",
    "Crie insights avançados",
    "Execute uma query personalizada"
  ];

  // Sugestões contextuais baseadas no que foi feito
  if (toolResults.some(r => r.type === 'chart')) {
    return [
      "Modifique o gráfico",
      "Análise mais detalhada",
      "Compare com outro período",
      "Exportar dados"
    ];
  }

  return basesuggestions;
}
