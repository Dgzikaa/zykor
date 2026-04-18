/**
 * Edge Function: api-clientes-externa
 *
 * API para acesso externo a dados de clientes (parceiro GoBar).
 *
 * Endpoints:
 *   GET ?bar_id=3                              → Lista clientes com paginação
 *   GET ?bar_id=3&telefone=11999999999         → Dados de um cliente específico + histórico
 *   GET ?bar_id=3&stats=true                   → Estatísticas gerais do bar
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
 *   stats=true                       Retorna estatísticas gerais ao invés de clientes
 *
 * Autenticação: header x-api-key (env var API_KEY_CLIENTES_EXTERNA)
 * Rate Limit: 100 requisições por minuto
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

    // medallion 2026-04-18: STUB temporario 503
    // Endpoint depende de cliente_estatisticas (view) e visitas (matview),
    // ambas removidas na migracao medallion. Reativar quando recriadas.
    return new Response(
      JSON.stringify({
        status: 'service_unavailable',
        message: 'Endpoint em manutencao pos-migracao medallion. Previsao: 48h. Contato: equipe@zykor.com.br',
        error_code: 'MAINTENANCE_MEDALLION_MIGRATION',
        retry_after_hours: 48
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '172800',
          ...corsHeaders
        }
      }
    );

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
    const stats = url.searchParams.get('stats') === 'true';

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
    // MODO STATS: estatísticas gerais do bar
    // =====================================================
    if (stats) {
      // Buscar estatísticas agregadas
      const { data: statsData, error: statsError } = await supabase
        .from('cliente_estatisticas')
        .select('total_visitas, total_gasto, total_entrada, total_consumo, ultima_visita')
        .eq('bar_id', barId);

      if (statsError) {
        console.error('Erro ao buscar estatísticas:', statsError);
        return new Response(JSON.stringify({
          error: 'Erro ao buscar estatísticas',
          code: 'DATABASE_ERROR'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const totalClientes = statsData?.length || 0;
      const totalVisitasGeral = statsData?.reduce((sum, c) => sum + c.total_visitas, 0) || 0;
      const totalGastoGeral = statsData?.reduce((sum, c) => sum + parseFloat(c.total_gasto || '0'), 0) || 0;
      const totalEntradaGeral = statsData?.reduce((sum, c) => sum + parseFloat(c.total_entrada || '0'), 0) || 0;
      const totalConsumoGeral = statsData?.reduce((sum, c) => sum + parseFloat(c.total_consumo || '0'), 0) || 0;
      const ticketMedioGeral = totalClientes > 0 ? totalGastoGeral / totalVisitasGeral : 0;
      
      // Clientes VIP (top 10% que mais gastam)
      const clientesOrdenados = [...(statsData || [])].sort((a, b) => 
        parseFloat(b.total_gasto || '0') - parseFloat(a.total_gasto || '0')
      );
      const top10Percent = Math.max(1, Math.ceil(totalClientes * 0.1));
      const clientesVIP = clientesOrdenados.slice(0, top10Percent);
      const gastoVIP = clientesVIP.reduce((sum, c) => sum + parseFloat(c.total_gasto || '0'), 0);
      const percentualGastoVIP = totalGastoGeral > 0 ? (gastoVIP / totalGastoGeral) * 100 : 0;

      // Data mais antiga e mais recente
      const datasVisitas = statsData?.map(c => c.ultima_visita).filter(Boolean) || [];
      const dataMaisRecente = datasVisitas.length > 0 ? datasVisitas.reduce((a, b) => a > b ? a : b) : null;
      
      // Buscar primeira visita de todos os clientes
      const { data: primeiraVisitaData } = await supabase
        .from('visitas')
        .select('data_visita')
        .eq('bar_id', barId)
        .order('data_visita', { ascending: true })
        .limit(1);
      
      const dataMaisAntiga = primeiraVisitaData?.[0]?.data_visita || null;

      // Clientes ativos (visitaram nos últimos 30 dias)
      const dataLimite30Dias = new Date();
      dataLimite30Dias.setDate(dataLimite30Dias.getDate() - 30);
      const clientesAtivos = statsData?.filter(c => 
        c.ultima_visita && new Date(c.ultima_visita) >= dataLimite30Dias
      ).length || 0;

      return new Response(JSON.stringify({
        success: true,
        data: {
          bar_id: barId,
          periodo: {
            data_mais_antiga: dataMaisAntiga,
            data_mais_recente: dataMaisRecente,
            dias_de_dados: dataMaisAntiga && dataMaisRecente 
              ? Math.ceil((new Date(dataMaisRecente).getTime() - new Date(dataMaisAntiga).getTime()) / (1000 * 60 * 60 * 24))
              : 0
          },
          clientes: {
            total: totalClientes,
            ativos_ultimos_30_dias: clientesAtivos,
            inativos_ultimos_30_dias: totalClientes - clientesAtivos,
            percentual_ativos: totalClientes > 0 ? ((clientesAtivos / totalClientes) * 100).toFixed(1) : '0.0'
          },
          visitas: {
            total: totalVisitasGeral,
            media_por_cliente: totalClientes > 0 ? (totalVisitasGeral / totalClientes).toFixed(1) : '0.0'
          },
          financeiro: {
            total_gasto: totalGastoGeral.toFixed(2),
            total_entrada: totalEntradaGeral.toFixed(2),
            total_consumo: totalConsumoGeral.toFixed(2),
            ticket_medio_geral: ticketMedioGeral.toFixed(2)
          },
          vip: {
            total_clientes_vip: clientesVIP.length,
            percentual_clientes: totalClientes > 0 ? ((clientesVIP.length / totalClientes) * 100).toFixed(1) : '0.0',
            total_gasto_vip: gastoVIP.toFixed(2),
            percentual_gasto: percentualGastoVIP.toFixed(1),
            ticket_medio_vip: clientesVIP.length > 0 
              ? (gastoVIP / clientesVIP.reduce((sum, c) => sum + c.total_visitas, 0)).toFixed(2)
              : '0.00'
          },
          top_5_clientes: clientesOrdenados.slice(0, 5).map(c => ({
            telefone: c.telefone,
            nome: c.nome || 'Sem nome',
            total_visitas: c.total_visitas,
            total_gasto: parseFloat(c.total_gasto || '0').toFixed(2),
            ultima_visita: c.ultima_visita
          })),
          atualizado_em: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // MODO TELEFONE: busca cliente específico + histórico
    // =====================================================
    if (telefone) {
      // Normalizar telefone (remover caracteres não numéricos)
      const telNormalizado = telefone.replace(/\D/g, '');
      
      // Usar últimos 8 dígitos para busca mais flexível
      const telUltimos8 = telNormalizado.slice(-8);

      // Buscar dados do cliente usando ILIKE para encontrar com ou sem formatação
      const { data: cliente, error: errCliente } = await supabase
        .from('cliente_estatisticas')
        .select('telefone, nome, total_visitas, ultima_visita, total_gasto, total_entrada, total_consumo, ticket_medio, ticket_medio_entrada, ticket_medio_consumo, updated_at')
        .eq('bar_id', barId)
        .ilike('telefone', `%${telUltimos8}%`)
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
      // telUltimos8 já foi declarado acima
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

      // Calcular métricas adicionais
      const primeiraVisita = historico && historico.length > 0 
        ? historico[historico.length - 1].data_visita 
        : null;
      
      const diasDesdeUltimaVisita = cliente.ultima_visita 
        ? Math.floor((new Date().getTime() - new Date(cliente.ultima_visita).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      const diasDesdePrimeiraVisita = primeiraVisita
        ? Math.floor((new Date().getTime() - new Date(primeiraVisita).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      const frequenciaMedia = primeiraVisita && cliente.total_visitas > 1 && diasDesdePrimeiraVisita
        ? (diasDesdePrimeiraVisita / (cliente.total_visitas - 1)).toFixed(1)
        : null;
      
      // Determinar status do cliente
      let status = 'ativo';
      if (diasDesdeUltimaVisita === null) {
        status = 'novo';
      } else if (diasDesdeUltimaVisita > 90) {
        status = 'inativo';
      } else if (diasDesdeUltimaVisita > 30) {
        status = 'em_risco';
      }
      
      // Classificar como VIP se ticket médio > R$ 150
      const ticketMedio = cliente.ticket_medio ? parseFloat(cliente.ticket_medio) : 0;
      const isVIP = ticketMedio > 150 || cliente.total_visitas >= 10;

      const clienteFormatado = {
        telefone: cliente.telefone,
        nome: cliente.nome || 'Sem nome',
        total_visitas: cliente.total_visitas,
        primeira_visita: primeiraVisita,
        ultima_visita: cliente.ultima_visita,
        dias_desde_ultima_visita: diasDesdeUltimaVisita,
        dias_desde_primeira_visita: diasDesdePrimeiraVisita,
        frequencia_media_dias: frequenciaMedia ? parseFloat(frequenciaMedia) : null,
        status: status,
        is_vip: isVIP,
        total_gasto: cliente.total_gasto ? parseFloat(cliente.total_gasto) : 0,
        total_entrada: cliente.total_entrada ? parseFloat(cliente.total_entrada) : 0,
        total_consumo: cliente.total_consumo ? parseFloat(cliente.total_consumo) : 0,
        ticket_medio: ticketMedio,
        ticket_medio_entrada: cliente.ticket_medio_entrada ? parseFloat(cliente.ticket_medio_entrada) : 0,
        ticket_medio_consumo: cliente.ticket_medio_consumo ? parseFloat(cliente.ticket_medio_consumo) : 0,
        atualizado_em: cliente.updated_at
      };

      // Enriquecer histórico com metadados
      const historicoEnriquecido = (historico || []).map(v => {
        const dataVisita = new Date(v.data_visita);
        const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const diaSemana = diasSemana[dataVisita.getDay()];
        
        const valorPagamentos = v.valor_pagamentos ? parseFloat(v.valor_pagamentos) : 0;
        const valorConsumo = v.valor_consumo ? parseFloat(v.valor_consumo) : 0;
        
        // Classificar gasto (baixo < 100, médio 100-200, alto > 200)
        let classificacaoGasto = 'medio';
        if (valorPagamentos < 100) classificacaoGasto = 'baixo';
        else if (valorPagamentos > 200) classificacaoGasto = 'alto';
        
        return {
          data: v.data_visita,
          dia_semana: diaSemana,
          nome: v.cliente_nome,
          valor_pagamentos: valorPagamentos,
          valor_consumo: valorConsumo,
          valor_produtos: v.valor_produtos ? parseFloat(v.valor_produtos) : 0,
          valor_couvert: v.valor_couvert ? parseFloat(v.valor_couvert) : 0,
          classificacao_gasto: classificacaoGasto
        };
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          cliente: clienteFormatado,
          historico: historicoEnriquecido,
          resumo_historico: {
            total_visitas_no_periodo: historicoEnriquecido.length,
            gasto_total_no_periodo: historicoEnriquecido.reduce((sum, v) => sum + v.valor_pagamentos, 0).toFixed(2),
            ticket_medio_no_periodo: historicoEnriquecido.length > 0 
              ? (historicoEnriquecido.reduce((sum, v) => sum + v.valor_pagamentos, 0) / historicoEnriquecido.length).toFixed(2)
              : '0.00',
            dia_semana_favorito: historicoEnriquecido.length > 0
              ? historicoEnriquecido.reduce((acc, v) => {
                  acc[v.dia_semana] = (acc[v.dia_semana] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              : {}
          },
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
      .select('telefone, nome, total_visitas, ultima_visita, total_gasto, total_entrada, total_consumo, ticket_medio, ticket_medio_entrada, ticket_medio_consumo, updated_at', { count: 'exact' })
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

    // Formatar resposta com metadados adicionais
    const clientesFormatados = (clientes || []).map(c => {
      const diasDesdeUltimaVisita = c.ultima_visita 
        ? Math.floor((new Date().getTime() - new Date(c.ultima_visita).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      let status = 'ativo';
      if (diasDesdeUltimaVisita === null) {
        status = 'novo';
      } else if (diasDesdeUltimaVisita > 90) {
        status = 'inativo';
      } else if (diasDesdeUltimaVisita > 30) {
        status = 'em_risco';
      }
      
      const ticketMedio = c.ticket_medio ? parseFloat(c.ticket_medio) : 0;
      const isVIP = ticketMedio > 150 || c.total_visitas >= 10;

      return {
        telefone: c.telefone,
        nome: c.nome || 'Sem nome',
        total_visitas: c.total_visitas,
        ultima_visita: c.ultima_visita,
        dias_desde_ultima_visita: diasDesdeUltimaVisita,
        status: status,
        is_vip: isVIP,
        total_gasto: c.total_gasto ? parseFloat(c.total_gasto) : 0,
        total_entrada: c.total_entrada ? parseFloat(c.total_entrada) : 0,
        total_consumo: c.total_consumo ? parseFloat(c.total_consumo) : 0,
        ticket_medio: ticketMedio,
        ticket_medio_entrada: c.ticket_medio_entrada ? parseFloat(c.ticket_medio_entrada) : 0,
        ticket_medio_consumo: c.ticket_medio_consumo ? parseFloat(c.ticket_medio_consumo) : 0,
        atualizado_em: c.updated_at
      };
    });

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
        versao_api: '2.0',
        campos_disponiveis: [
          'telefone', 'nome', 'total_visitas', 'primeira_visita', 'ultima_visita',
          'dias_desde_ultima_visita', 'frequencia_media_dias', 'status', 'is_vip',
          'total_gasto', 'total_entrada', 'total_consumo',
          'ticket_medio', 'ticket_medio_entrada', 'ticket_medio_consumo',
          'atualizado_em'
        ],
        status_possiveis: ['novo', 'ativo', 'em_risco', 'inativo'],
        criterios_vip: 'ticket_medio > R$ 150 OU total_visitas >= 10',
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
