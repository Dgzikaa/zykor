/**
 * Edge Function: api-clientes-externa
 *
 * API para acesso externo a dados de clientes (parceiro).
 *
 * Endpoints:
 *   GET ?bar_id=3                              → Lista clientes com paginação
 *   GET ?bar_id=3&telefone=11999999999         → Dados de um cliente específico + histórico
 *
 * Filtros:
 *   ultima_visita_desde=YYYY-MM-DD   Data mínima da última visita
 *   ultima_visita_ate=YYYY-MM-DD     Data máxima da última visita
 *   data_desde=YYYY-MM-DD            (modo histórico) Filtrar visitas a partir de
 *   data_ate=YYYY-MM-DD              (modo histórico) Filtrar visitas até
 *   busca=texto                      Busca por nome ou telefone
 *   min_visitas=N                    Mínimo de visitas (default: 1)
 *   ordenar=visitas|nome|ultima_visita|total_gasto|total_consumo
 *   ordem=asc|desc
 *   page=N                           Página (default: 1)
 *   limit=N                          Itens por página (default: 100, max: 500)
 *
 * Autenticação: header x-api-key (env var API_KEY_CLIENTES_EXTERNA)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';



// Rate limiting simples em memória
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60000;

function checkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(apiKey);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(apiKey, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido. Use GET.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    );
  }

  try {
    // 1. Validar API Key (obrigatória via env var)
    const API_KEY = Deno.env.get('API_KEY_CLIENTES_EXTERNA');

    if (!API_KEY) {
      console.error('ERRO: API_KEY_CLIENTES_EXTERNA não definida');
      return new Response(JSON.stringify({
        error: 'Configuração de segurança ausente. Contate o administrador.',
        code: 'MISSING_CONFIG'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const providedKey = req.headers.get('x-api-key');

    if (!providedKey) {
      return new Response(JSON.stringify({
        error: 'API Key não fornecida. Use o header x-api-key.',
        code: 'MISSING_API_KEY'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (providedKey !== API_KEY) {
      console.warn('Tentativa de acesso com API Key inválida');
      return new Response(JSON.stringify({
        error: 'API Key inválida.',
        code: 'INVALID_API_KEY'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Rate limiting
    if (!checkRateLimit(providedKey)) {
      return new Response(JSON.stringify({
        error: 'Rate limit excedido. Máximo 100 req/min.',
        code: 'RATE_LIMIT'
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Parsear parâmetros
    const url = new URL(req.url);
    const barId = parseInt(url.searchParams.get('bar_id') || '0');
    const telefone = url.searchParams.get('telefone')?.trim() || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const busca = url.searchParams.get('busca')?.trim() || '';
    const minVisitas = parseInt(url.searchParams.get('min_visitas') || '1');
    const ordenar = url.searchParams.get('ordenar') || 'visitas';
    const ordem = url.searchParams.get('ordem') || 'desc';
    const ultimaVisitaDesde = url.searchParams.get('ultima_visita_desde') || '';
    const ultimaVisitaAte = url.searchParams.get('ultima_visita_ate') || '';
    const dataDesde = url.searchParams.get('data_desde') || '';
    const dataAte = url.searchParams.get('data_ate') || '';

    if (!barId) {
      return new Response(JSON.stringify({
        error: 'Parâmetro bar_id é obrigatório',
        code: 'MISSING_BAR_ID'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Conectar ao Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =====================================================
    // MODO TELEFONE: busca cliente específico + histórico
    // =====================================================
    if (telefone) {
      // Normalizar telefone (remover caracteres não numéricos)
      const telNormalizado = telefone.replace(/\D/g, '');

      // Buscar dados do cliente
      const { data: cliente, error: errCliente } = await supabase
        .from('cliente_estatisticas')
        .select('telefone, nome, total_visitas, ultima_visita, total_gasto, total_entrada, total_consumo, ticket_medio, ticket_medio_entrada, ticket_medio_consumo, updated_at')
        .eq('bar_id', barId)
        .or(`telefone.eq.${telNormalizado},telefone.ilike.%${telNormalizado}%`)
        .limit(1)
        .maybeSingle();

      if (errCliente) {
        console.error('Erro ao buscar cliente:', errCliente);
        return new Response(JSON.stringify({
          error: 'Erro ao buscar dados do cliente',
          code: 'DATABASE_ERROR'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!cliente) {
        return new Response(JSON.stringify({
          success: true,
          data: { cliente: null, historico: [] },
          message: 'Cliente não encontrado para este telefone'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Buscar histórico de visitas (modo histórico com filtros de data)
      // Buscar por telefone normalizado (remover hífens, espaços, +)
      // visitas armazena como "61-993196776", cliente_estatisticas como "61993196776"
      const telUltimos8 = telNormalizado.slice(-8);
      let queryHistorico = supabase
        .from('visitas')
        .select('id, data_visita, cliente_nome, valor_pagamentos, valor_consumo, valor_produtos, valor_couvert, created_at')
        .eq('bar_id', barId)
        .ilike('cliente_fone', `%${telUltimos8}%`)
        .order('data_visita', { ascending: false });

      if (dataDesde) {
        queryHistorico = queryHistorico.gte('data_visita', dataDesde);
      }
      if (dataAte) {
        queryHistorico = queryHistorico.lte('data_visita', dataAte);
      }

      queryHistorico = queryHistorico.limit(500);

      const { data: historico, error: errHist } = await queryHistorico;

      if (errHist) {
        console.error('Erro ao buscar histórico:', errHist);
      }

      const clienteFormatado = {
        telefone: cliente.telefone,
        nome: cliente.nome || 'Sem nome',
        total_visitas: cliente.total_visitas,
        ultima_visita: cliente.ultima_visita,
        total_gasto: cliente.total_gasto ? parseFloat(cliente.total_gasto) : 0,
        total_entrada: cliente.total_entrada ? parseFloat(cliente.total_entrada) : 0,
        total_consumo: cliente.total_consumo ? parseFloat(cliente.total_consumo) : 0,
        ticket_medio: cliente.ticket_medio ? parseFloat(cliente.ticket_medio) : 0,
        ticket_medio_entrada: cliente.ticket_medio_entrada ? parseFloat(cliente.ticket_medio_entrada) : 0,
        ticket_medio_consumo: cliente.ticket_medio_consumo ? parseFloat(cliente.ticket_medio_consumo) : 0,
        atualizado_em: cliente.updated_at
      };

      return new Response(JSON.stringify({
        success: true,
        data: {
          cliente: clienteFormatado,
          historico: (historico || []).map(v => ({
            data: v.data_visita,
            nome: v.cliente_nome,
            valor_pagamentos: v.valor_pagamentos ? parseFloat(v.valor_pagamentos) : 0,
            valor_consumo: v.valor_consumo ? parseFloat(v.valor_consumo) : 0,
            valor_produtos: v.valor_produtos ? parseFloat(v.valor_produtos) : 0,
            valor_couvert: v.valor_couvert ? parseFloat(v.valor_couvert) : 0
          })),
          filtros_aplicados: {
            data_desde: dataDesde || null,
            data_ate: dataAte || null
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // MODO LISTA: todos os clientes com paginação e filtros
    // =====================================================
    let query = supabase
      .from('cliente_estatisticas')
      .select('telefone, nome, total_visitas, ultima_visita, total_gasto, total_entrada, total_consumo, ticket_medio, ticket_medio_entrada, ticket_medio_consumo, tempo_medio_minutos, total_visitas_com_tempo, updated_at', { count: 'exact' })
      .eq('bar_id', barId)
      .gte('total_visitas', minVisitas);

    // Filtro por busca (nome ou telefone)
    if (busca) {
      query = query.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`);
    }

    // Filtro por data da última visita
    if (ultimaVisitaDesde) {
      query = query.gte('ultima_visita', ultimaVisitaDesde);
    }
    if (ultimaVisitaAte) {
      query = query.lte('ultima_visita', ultimaVisitaAte);
    }

    // Ordenação
    const orderColumn = ordenar === 'nome' ? 'nome'
      : ordenar === 'ultima_visita' ? 'ultima_visita'
      : ordenar === 'total_gasto' ? 'total_gasto'
      : ordenar === 'total_consumo' ? 'total_consumo'
      : 'total_visitas';
    query = query.order(orderColumn, { ascending: ordem === 'asc' });

    // Paginação
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: clientes, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar clientes:', error);
      return new Response(JSON.stringify({
        error: 'Erro ao buscar dados',
        code: 'DATABASE_ERROR'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Formatar resposta
    const clientesFormatados = (clientes || []).map(c => ({
      telefone: c.telefone,
      nome: c.nome || 'Sem nome',
      total_visitas: c.total_visitas,
      ultima_visita: c.ultima_visita,
      total_gasto: c.total_gasto ? parseFloat(c.total_gasto) : 0,
      total_entrada: c.total_entrada ? parseFloat(c.total_entrada) : 0,
      total_consumo: c.total_consumo ? parseFloat(c.total_consumo) : 0,
      ticket_medio: c.ticket_medio ? parseFloat(c.ticket_medio) : 0,
      ticket_medio_entrada: c.ticket_medio_entrada ? parseFloat(c.ticket_medio_entrada) : 0,
      ticket_medio_consumo: c.ticket_medio_consumo ? parseFloat(c.ticket_medio_consumo) : 0,
      atualizado_em: c.updated_at
    }));

    const totalPaginas = Math.ceil((count || 0) / limit);

    return new Response(JSON.stringify({
      success: true,
      data: {
        clientes: clientesFormatados,
        paginacao: {
          pagina_atual: page,
          total_paginas: totalPaginas,
          total_clientes: count || 0,
          por_pagina: limit
        }
      },
      meta: {
        bar_id: barId,
        campos_disponiveis: [
          'telefone', 'nome', 'total_visitas', 'ultima_visita',
          'total_gasto', 'total_entrada', 'total_consumo',
          'ticket_medio', 'ticket_medio_entrada', 'ticket_medio_consumo',
          'tempo_medio_estadia_minutos', 'tempo_medio_estadia_formatado',
          'visitas_com_tempo_registrado', 'atualizado_em'
        ],
        filtros_aplicados: {
          busca: busca || null,
          min_visitas: minVisitas,
          ultima_visita_desde: ultimaVisitaDesde || null,
          ultima_visita_ate: ultimaVisitaAte || null,
          ordenar,
          ordem
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na api-clientes-externa:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
