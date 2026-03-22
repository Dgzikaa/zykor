import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cache em memória para evitar reprocessar dados a cada request
interface CacheEntry {
  data: any;
  timestamp: number;
  version: number; // Para invalidar cache quando mudar lógica
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const CACHE_VERSION = 4; // v4: Agrupamento por telefone (como analítico)

function getCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  
  // Invalidar se versão mudou
  if (entry.version !== CACHE_VERSION) {
    cache.delete(key);
    return null;
  }
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key: string, data: any) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    version: CACHE_VERSION
  });
}

// Função para buscar TODOS os dados com paginação (contorna limite de 1000 do Supabase)
async function fetchAllData(tableName: string, columns: string, filters: any = {}) {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  const MAX_ITERATIONS = 200; // Aumentado para suportar até 200k registros
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    
    let query = supabase
      .from(tableName)
      .select(columns)
      .range(from, from + limit - 1);
    
    // Aplicar filtros
    Object.entries(filters).forEach(([key, value]) => {
      if (key.includes('gte_')) {
        query = query.gte(key.replace('gte_', ''), value);
      } else if (key.includes('lte_')) {
        query = query.lte(key.replace('lte_', ''), value);
      } else if (key.includes('eq_')) {
        query = query.eq(key.replace('eq_', ''), value);
      } else if (key.includes('in_')) {
        query = query.in(key.replace('in_', ''), Array.isArray(value) ? value : [value]);
      } else if (key.includes('not_')) {
        if (key.includes('not_is_')) {
          query = query.not(key.replace('not_is_', ''), 'is', value);
        } else if (key.includes('not_eq_')) {
          query = query.not(key.replace('not_eq_', ''), 'eq', value);
        }
      }
    });
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`❌ Erro ao buscar ${tableName}:`, error);
      break;
    }
    
    if (!data || data.length === 0) {
      break;
    }
    
    allData.push(...data);

    if (data.length < limit) {
      break; // Última página
    }
    
    from += limit;
  }
  
  return allData;
}

interface ClienteUnificado {
  identificador: string;
  nome: string;
  email?: string;
  telefone?: string;
  total_visitas: number;
  total_gasto: number;
  ultima_visita: string;
  primeira_visita: string;
  dias_desde_ultima_visita: number;
  ticket_medio: number;
  frequencia_dias: number; // visitas por dia desde primeira visita
}

interface SegmentacaoRFM {
  r_score: number; // Recency (1-5)
  f_score: number; // Frequency (1-5)
  m_score: number; // Monetary (1-5)
  rfm_total: number;
  segmento: string;
  cor: string;
  acoes_sugeridas: string[];
  prioridade: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório. Selecione um bar.' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const segmento = searchParams.get('segmento') || 'todos';

    // Verificar cache primeiro (evita reprocessar 90k registros a cada clique)
    const cacheKey = `crm_segmentacao_${barId}`;
    const cached = getCached(cacheKey);

    let clientesSegmentados;
    let stats;

    if (cached) {
      clientesSegmentados = cached.clientes;
      stats = cached.stats;
    } else {
      // Buscar dados de visitas - ÚNICA fonte com dados REAIS de consumo
      const visitasDataRaw = await fetchAllData(
        'visitas', 
        'cliente_nome, cliente_fone, data_visita, valor_couvert, valor_pagamentos', 
        {
          eq_bar_id: barId
        }
      );

      // Filtrar clientes válidos (remover null e vazio, e com telefone)
      const visitasData = visitasDataRaw.filter(item => 
        item.cliente_fone && item.cliente_fone.trim() !== '' && item.cliente_nome && item.cliente_nome.trim() !== ''
      );

      // 5. Processar visitas - agrupar por TELEFONE (mesma lógica do analítico)
      const clientesMap = new Map<string, ClienteUnificado>();

      for (const item of visitasData) {
        const nome = item.cliente_nome?.trim();
        const rawFone = item.cliente_fone?.toString().trim();
        
        // Filtrar clientes inválidos
        if (!nome || !rawFone || nome === 'MESA' || nome === 'SEM NOME' || nome === 'BALCAO') continue;

        // Normalizar telefone (mesma lógica do analítico)
        let fone = rawFone.replace(/\D/g, ''); // Remove não-numéricos
        if (!fone) continue;

        // Padronizar: 10 dígitos → 11 dígitos (adicionar 9 após DDD)
        if (fone.length === 10 && ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99'].includes(fone.substring(0, 2))) {
          fone = fone.substring(0, 2) + '9' + fone.substring(2);
        }

        // Usar TELEFONE como identificador único (como no analítico)
        const id = fone;
        
        if (!clientesMap.has(id)) {
          clientesMap.set(id, {
            identificador: id,
            nome,
            telefone: fone,
            total_visitas: 0,
            total_gasto: 0,
            ultima_visita: '',
            primeira_visita: '',
            dias_desde_ultima_visita: 0,
            ticket_medio: 0,
            frequencia_dias: 0
          });
        }

        const cliente = clientesMap.get(id)!;
        cliente.total_visitas++;
        
        // Calcular gasto (valor_pagamentos - valor_couvert = consumo líquido)
        const vrCouvert = parseFloat(item.valor_couvert || '0') || 0;
        const vrPagamentos = parseFloat(item.valor_pagamentos || '0') || 0;
        const vrConsumo = vrPagamentos - vrCouvert;
        cliente.total_gasto += vrConsumo;
        
        if (item.data_visita) {
          const dataVisita = item.data_visita.toString();
          
          if (!cliente.ultima_visita || dataVisita > cliente.ultima_visita) {
            cliente.ultima_visita = dataVisita;
          }
          if (!cliente.primeira_visita || dataVisita < cliente.primeira_visita) {
            cliente.primeira_visita = dataVisita;
          }
        }
      }

      // Calcular ticket médio para cada cliente
      clientesMap.forEach(cliente => {
        if (cliente.total_visitas > 0) {
          cliente.ticket_medio = cliente.total_gasto / cliente.total_visitas;
        }
      });

    // 6. Calcular métricas temporais
    const hoje = new Date();
    clientesMap.forEach(cliente => {
      if (cliente.ultima_visita) {
        const ultimaVisitaDate = new Date(cliente.ultima_visita);
        cliente.dias_desde_ultima_visita = Math.floor((hoje.getTime() - ultimaVisitaDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (cliente.primeira_visita && cliente.ultima_visita) {
        const primeiraVisitaDate = new Date(cliente.primeira_visita);
        const ultimaVisitaDate = new Date(cliente.ultima_visita);
        const diasEntrePrimeiraEUltima = Math.max(1, Math.floor((ultimaVisitaDate.getTime() - primeiraVisitaDate.getTime()) / (1000 * 60 * 60 * 24)));
        cliente.frequencia_dias = cliente.total_visitas / Math.max(1, diasEntrePrimeiraEUltima);
      }
    });

    // 7. Calcular scores RFM (MELHORADO - usa percentis em vez de indexOf)
    const clientes = Array.from(clientesMap.values());
    
    // Ordenar métricas
    const recencies = clientes.map(c => c.dias_desde_ultima_visita).sort((a, b) => a - b);
    const frequencies = clientes.map(c => c.total_visitas).sort((a, b) => a - b);
    const monetaries = clientes.map(c => c.total_gasto).sort((a, b) => a - b);

    // Função de score baseada em percentis (mais preciso)
    const getScore = (value: number, sortedArray: number[], reverse: boolean = false) => {
      const total = sortedArray.length;
      
      // Encontrar posição do valor no array ordenado
      let position = 0;
      for (let i = 0; i < sortedArray.length; i++) {
        if (sortedArray[i] <= value) position = i;
        else break;
      }
      
      const percentil = position / total;
      
      if (reverse) {
        // Para Recency: menor valor = melhor score
        if (percentil <= 0.2) return 5;
        if (percentil <= 0.4) return 4;
        if (percentil <= 0.6) return 3;
        if (percentil <= 0.8) return 2;
        return 1;
      } else {
        // Para Frequency/Monetary: maior valor = melhor score
        if (percentil <= 0.2) return 1;
        if (percentil <= 0.4) return 2;
        if (percentil <= 0.6) return 3;
        if (percentil <= 0.8) return 4;
        return 5;
      }
    };

    // 8. Segmentar clientes
    clientesSegmentados = clientes.map(cliente => {
      const r_score = getScore(cliente.dias_desde_ultima_visita, recencies, true); // Menor recência = melhor
      const f_score = getScore(cliente.total_visitas, frequencies);
      const m_score = getScore(cliente.total_gasto, monetaries);
      const rfm_total = r_score + f_score + m_score;

      let segmento = '';
      let cor = '';
      let acoes_sugeridas: string[] = [];
      let prioridade = 0;

      // Segmentação RFM ajustada para realidade de bares (90% têm 1-2 visitas)
      // 1. VIP Champions - Frequência alta (top 20%) + Gasto alto + Recente
      if (cliente.total_visitas >= 3 && m_score >= 4 && r_score >= 3) {
        segmento = '💎 VIP Champions';
        cor = 'purple';
        prioridade = 5;
        acoes_sugeridas = [
          'Programa de fidelidade exclusivo',
          'Convite para eventos VIP',
          'Benefícios e recompensas especiais'
        ];
      }
      // 2. Clientes Fiéis - Vêm 3+ vezes e são recentes
      else if (cliente.total_visitas >= 3 && r_score >= 3) {
        segmento = '⭐ Clientes Fiéis';
        cor = 'blue';
        prioridade = 4;
        acoes_sugeridas = [
          'Manter engajamento com novidades',
          'Oferecer programa de indicação',
          'Recompensas por frequência'
        ];
      }
      // 3. Em Risco - Tinham 2+ visitas mas sumiram
      else if (cliente.total_visitas >= 2 && r_score <= 2) {
        segmento = '⚠️ Em Risco (Churn)';
        cor = 'orange';
        prioridade = 5;
        acoes_sugeridas = [
          'URGENTE: Campanha de reconquista',
          'Contato personalizado (WhatsApp)',
          'Promoção exclusiva de retorno',
          'Pesquisa de satisfação'
        ];
      }
      // 4. Grande Potencial - 1-2 visitas mas gastam MUITO (top 20% em gasto)
      else if (cliente.total_visitas <= 2 && m_score >= 4) {
        segmento = '💰 Grande Potencial';
        cor = 'green';
        prioridade = 4;
        acoes_sugeridas = [
          'Incentivo para aumentar frequência',
          'Benefícios por volume de gasto',
          'Campanhas de reativação'
        ];
      }
      // 5. Novos Promissores - 1 visita recente (últimos 30 dias)
      else if (cliente.total_visitas === 1 && cliente.dias_desde_ultima_visita <= 30) {
        segmento = '🌱 Novos Promissores';
        cor = 'teal';
        prioridade = 3;
        acoes_sugeridas = [
          'Onboarding personalizado',
          'Incentivo para segunda visita',
          'Apresentar experiências do bar'
        ];
      }
      // 6. Inativos - 1 visita há mais de 90 dias
      else if (cliente.total_visitas === 1 && cliente.dias_desde_ultima_visita > 90) {
        segmento = '😴 Inativos';
        cor = 'gray';
        prioridade = 1;
        acoes_sugeridas = [
          'Considerar remoção da base ativa',
          'Campanha de baixo custo (email/redes)',
        ];
      }
      // 7. Regulares - 1-2 visitas, entre 30-90 dias
      else {
        segmento = '📊 Regulares';
        cor = 'indigo';
        prioridade = 2;
        acoes_sugeridas = [
          'Manter comunicação regular',
          'Campanhas sazonais',
          'Benefícios para aumentar ticket'
        ];
      }

      const segmentacao: SegmentacaoRFM = {
        r_score,
        f_score,
        m_score,
        rfm_total,
        segmento,
        cor,
        acoes_sugeridas,
        prioridade
      };

      return {
        ...cliente,
        ...segmentacao
      };
    });

      // 9. Ordenar por prioridade e RFM total
      clientesSegmentados.sort((a, b) => {
        if (a.prioridade !== b.prioridade) return b.prioridade - a.prioridade;
        return b.rfm_total - a.rfm_total;
      });

      // 11. Estatísticas gerais (sempre retorna o total)
      stats = {
        total_clientes: clientesSegmentados.length,
        vips: clientesSegmentados.filter(c => c.segmento.includes('VIP')).length,
        em_risco: clientesSegmentados.filter(c => c.segmento.includes('Risco')).length,
        fieis: clientesSegmentados.filter(c => c.segmento.includes('Fiéis')).length,
        novos: clientesSegmentados.filter(c => c.segmento.includes('Novos')).length,
        inativos: clientesSegmentados.filter(c => c.segmento.includes('Inativos')).length,
        regulares: clientesSegmentados.filter(c => c.segmento.includes('Regulares')).length,
        potencial: clientesSegmentados.filter(c => c.segmento.includes('Potencial')).length,
      };

      // Salvar no cache (5 minutos)
      setCache(cacheKey, { clientes: clientesSegmentados, stats });
    }

    // 10. Filtrar por segmento se especificado (APÓS o cache)
    let clientesFiltrados = clientesSegmentados || [];
    if (segmento !== 'todos' && clientesSegmentados) {
      clientesFiltrados = clientesSegmentados.filter(c => c.segmento === segmento);
      
      // Ordenação inteligente por segmento
      if (segmento.includes('VIP')) {
        // VIPs: ordenar por visitas DESC, depois por gasto DESC
        clientesFiltrados.sort((a, b) => {
          if (b.total_visitas !== a.total_visitas) return b.total_visitas - a.total_visitas;
          return b.total_gasto - a.total_gasto;
        });
      } else if (segmento.includes('Fiéis')) {
        // Fiéis: ordenar por visitas DESC
        clientesFiltrados.sort((a, b) => b.total_visitas - a.total_visitas);
      } else if (segmento.includes('Risco')) {
        // Em Risco: ordenar por dias desde última visita (mais urgente primeiro)
        clientesFiltrados.sort((a, b) => b.dias_desde_ultima_visita - a.dias_desde_ultima_visita);
      } else if (segmento.includes('Potencial')) {
        // Potencial: ordenar por gasto total (maior potencial primeiro)
        clientesFiltrados.sort((a, b) => b.total_gasto - a.total_gasto);
      } else if (segmento.includes('Novos')) {
        // Novos: ordenar por recência (mais recente primeiro)
        clientesFiltrados.sort((a, b) => a.dias_desde_ultima_visita - b.dias_desde_ultima_visita);
      } else if (segmento.includes('Inativos')) {
        // Inativos: ordenar por dias inativos (mais tempo primeiro)
        clientesFiltrados.sort((a, b) => b.dias_desde_ultima_visita - a.dias_desde_ultima_visita);
      } else {
        // Regulares: ordenar por RFM
        clientesFiltrados.sort((a, b) => b.rfm_total - a.rfm_total);
      }
    }

    // Validação de segurança
    if (!clientesFiltrados || !Array.isArray(clientesFiltrados)) {
      console.error('❌ clientesFiltrados está undefined ou não é array:', clientesFiltrados);
      clientesFiltrados = [];
    }

    if (!stats) {
      console.error('❌ stats está undefined');
      stats = {
        total_clientes: 0,
        vips: 0,
        em_risco: 0,
        fieis: 0,
        novos: 0,
        inativos: 0,
        regulares: 0,
        potencial: 0,
      };
    }

    // 12. Aplicar paginação
    const totalClientes = clientesFiltrados.length;
    const totalPages = Math.ceil(totalClientes / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const clientesPaginados = clientesFiltrados.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      clientes: clientesPaginados,
      estatisticas: stats,
      paginacao: {
        page,
        limit,
        total: totalClientes,
        totalPages,
        hasMore: page < totalPages
      }
    });

  } catch (error: any) {
    console.error('❌ Erro na API de CRM:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

