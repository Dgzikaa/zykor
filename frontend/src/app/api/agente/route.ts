import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getCacheKey, getFromCache, setCache } from './lib/cache';
import { ChatContext } from './lib/types';
import { classifyIntent, inferContextFromHistory } from './lib/intent-classifier';
import { fetchDataForIntent } from './lib/data-fetcher';
import { formatResponse } from './lib/response-formatter';
import { registrarMetrica, salvarHistorico } from './lib/agent-logger';
import { chamarAgenteSQLExpert } from './lib/sql-expert-fallback';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let cacheHit = false;
  
  try {
    const body = await request.json();
    const { message, barId, context = {}, sessionId, useSQLExpert = false } = body;

    if (!barId) {
      return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
    }
    const chatContext = context as ChatContext;

    if (!message) {
      return NextResponse.json({ success: false, error: 'Mensagem é obrigatória' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (sessionId) {
      await salvarHistorico(supabase, {
        bar_id: barId,
        session_id: sessionId,
        role: 'user',
        content: message
      });
    }

    // ============================================================
    // FASE 2: Usar novo agente com Tool Use (chat-v2)
    // ============================================================
    try {
      const agentResponse = await fetch(`${supabaseUrl}/functions/v1/agente-dispatcher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          action: 'chat-v2',
          bar_id: barId,
          params: {
            mensagem: message,
            historico: chatContext?.previousMessages?.slice(-5)?.map(m => 
              `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`
            ).join('\n') || null,
          }
        })
      });

      const agentData = await agentResponse.json();

      if (agentData.success && agentData.data?.response) {
        const responseTime = Date.now() - startTime;
        
        await registrarMetrica(supabase, {
          bar_id: barId,
          session_id: sessionId,
          agent_name: 'Assistente Zykor (Tool Use)',
          intent: 'tool-use',
          query: message,
          response_time_ms: responseTime,
          success: true,
          cache_hit: false
        });

        if (sessionId) {
          await salvarHistorico(supabase, {
            bar_id: barId,
            session_id: sessionId,
            role: 'assistant',
            content: agentData.data.response,
            agent_used: 'Assistente Zykor (Tool Use)'
          });
        }

        return NextResponse.json({
          success: true,
          response: agentData.data.response,
          agent: 'Assistente Zykor (Tool Use)',
          suggestions: ['Faturamento da semana', 'Comparar com semana passada', 'CMV atual', 'Produtos mais vendidos'],
          _meta: {
            responseTime,
            cacheHit: false,
            intent: 'tool-use',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      console.log('⚠️ chat-v2 não retornou resposta válida, usando fallback');
    } catch (toolUseError) {
      console.error('⚠️ Erro no chat-v2, usando fallback:', toolUseError);
    }
    // ============================================================
    // FIM FASE 2 - Fallback para fluxo antigo abaixo
    // ============================================================

    if (useSQLExpert) {
      const sqlExpertResponse = await chamarAgenteSQLExpert(message, barId);
      if (sqlExpertResponse) {
        const responseTime = Date.now() - startTime;
        return NextResponse.json({
          ...sqlExpertResponse,
          _meta: {
            responseTime,
            cacheHit: false,
            intent: 'sql_expert',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    let { intent, entities } = classifyIntent(message);

    if (intent === 'geral' && chatContext.previousMessages?.length > 0) {
      const inferredIntent = inferContextFromHistory(message, chatContext.previousMessages);
      if (inferredIntent) {
        intent = inferredIntent;
      }
    }

    if (intent === 'geral' && message.length > 30) {
      const sqlExpertResponse = await chamarAgenteSQLExpert(message, barId);
      if (sqlExpertResponse) {
        const responseTime = Date.now() - startTime;
        
        if (sessionId) {
          await salvarHistorico(supabase, {
            bar_id: barId,
            session_id: sessionId,
            role: 'assistant',
            content: sqlExpertResponse.response,
            agent_used: sqlExpertResponse.agent,
            suggestions: sqlExpertResponse.suggestions
          });
        }
        
        return NextResponse.json({
          ...sqlExpertResponse,
          _meta: {
            responseTime,
            cacheHit: false,
            intent: 'sql_expert_fallback',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    const cacheKey = getCacheKey(intent, entities, barId);
    let data = getFromCache(cacheKey) as Record<string, unknown> | null;
    
    if (data) {
      cacheHit = true;
    } else {
      data = await fetchDataForIntent(supabase, intent, entities, barId);
      setCache(cacheKey, data, intent);
    }

    const response = formatResponse(intent, data, chatContext);
    const responseTime = Date.now() - startTime;

    await registrarMetrica(supabase, {
      bar_id: barId,
      session_id: sessionId,
      agent_name: response.agent || 'Assistente Zykor',
      intent,
      query: message,
      response_time_ms: responseTime,
      success: response.success,
      cache_hit: cacheHit
    });

    if (sessionId) {
      await salvarHistorico(supabase, {
        bar_id: barId,
        session_id: sessionId,
        role: 'assistant',
        content: response.response,
        agent_used: response.agent,
        metrics: response.metrics,
        suggestions: response.suggestions,
        deep_links: response.deepLinks,
        chart_data: response.chartData
      });
    }

    return NextResponse.json({
      ...response,
      _meta: {
        responseTime,
        cacheHit,
        intent,
        timestamp: new Date().toISOString()
      }
    });

  } catch (e) {
    const responseTime = Date.now() - startTime;
    console.error('Erro no agente:', e);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await registrarMetrica(supabase, {
      bar_id: 3,
      agent_name: 'Sistema',
      intent: 'erro',
      query: '',
      response_time_ms: responseTime,
      success: false,
      cache_hit: false,
      error_message: String(e)
    });
    
    return NextResponse.json({
      success: false,
      response: 'Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.',
      error: String(e)
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { metricaId, rating, feedback } = body;

    if (!metricaId || !rating) {
      return NextResponse.json({ 
        success: false, 
        error: 'metricaId e rating são obrigatórios' 
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('agente_uso')
      .update({
        feedback_rating: rating,
        feedback_text: feedback || null
      })
      .eq('id', metricaId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Feedback registrado com sucesso!' });
  } catch (e) {
    console.error('Erro ao registrar feedback:', e);
    return NextResponse.json({
      success: false,
      error: String(e)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const barId = searchParams.get('barId') || '3';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (sessionId) {
      const { data, error } = await supabase
        .from('agente_historico')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, historico: data });
    } else {
      const { data, error } = await supabase
        .from('agente_historico')
        .select('session_id, created_at, content')
        .eq('bar_id', parseInt(barId))
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const sessoes: Record<string, { session_id: string; primeira_mensagem: string; data: string }> = {};
      data?.forEach(msg => {
        if (!sessoes[msg.session_id]) {
          sessoes[msg.session_id] = {
            session_id: msg.session_id,
            primeira_mensagem: msg.content.substring(0, 50) + '...',
            data: msg.created_at
          };
        }
      });

      return NextResponse.json({ 
        success: true, 
        sessoes: Object.values(sessoes).slice(0, 10)
      });
    }
  } catch (e) {
    console.error('Erro ao carregar histórico:', e);
    return NextResponse.json({
      success: false,
      error: String(e)
    }, { status: 500 });
  }
}
