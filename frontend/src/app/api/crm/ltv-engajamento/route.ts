import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===== CACHE =====
interface CacheEntry {
  data: any;
  timestamp: number;
  version: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const CACHE_VERSION = 4; // Incrementado para nova lógica

function getCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  
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
  cache.set(key, { data, timestamp: Date.now(), version: CACHE_VERSION });
}

// ===== CONSTANTES =====
const MINIMO_VISITAS_CONFIAVEL = 3; // Mínimo de visitas para dados confiáveis
const FATOR_CONSERVADOR = 0.5; // 50% para clientes com poucos dados

// ===== FUNÇÃO PARA BUSCAR TODOS OS DADOS COM PAGINAÇÃO =====
async function fetchAllData(tableName: string, columns: string, filters: any = {}) {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  const MAX_ITERATIONS = 200;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    
    let query = supabase
      .from(tableName)
      .select(columns)
      .range(from, from + limit - 1);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (key.includes('gte_')) {
        query = query.gte(key.replace('gte_', ''), value);
      } else if (key.includes('lte_')) {
        query = query.lte(key.replace('lte_', ''), value);
      } else if (key.includes('eq_')) {
        query = query.eq(key.replace('eq_', ''), value);
      } else if (key.includes('not_null_')) {
        query = query.not(key.replace('not_null_', ''), 'is', null);
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
      break;
    }
    
    from += limit;
  }
  
  return allData;
}

interface ClienteLTV {
  telefone: string;
  nome: string;
  
  // Lifetime Value
  ltv_atual: number;
  ltv_projetado_12m: number;
  ltv_projetado_24m: number;
  
  // Métricas de Engajamento
  score_engajamento: number;
  nivel_engajamento: 'baixo' | 'medio' | 'alto' | 'muito_alto';
  
  // Métricas de cálculo
  total_visitas: number;
  primeira_visita: string;
  ultima_visita: string;
  dias_como_cliente: number;
  frequencia_visitas: number;
  ticket_medio: number;
  ticket_medio_usado: number; // Ticket usado para projeção (pode ser do bar)
  valor_medio_mensal: number;
  
  // Tendências
  tendencia_valor: 'crescente' | 'estavel' | 'decrescente';
  tendencia_frequencia: 'crescente' | 'estavel' | 'decrescente';
  
  // Potencial
  potencial_crescimento: 'baixo' | 'medio' | 'alto';
  roi_marketing: number;
  
  // Confiança dos dados
  confianca: 'alta' | 'media' | 'baixa';
  dados_preliminares: boolean;
}

// Calcular score de engajamento (0-100)
function calcularScoreEngajamento(dados: {
  frequenciaVisitas: number;
  diasComoCliente: number;
  totalVisitas: number;
  tendenciaFrequencia: string;
  tendenciaValor: string;
  limitarScore: boolean; // Para clientes com poucos dados
}): { score: number; nivel: 'baixo' | 'medio' | 'alto' | 'muito_alto' } {
  let score = 0;

  // 1. FREQUÊNCIA (40 pontos)
  if (dados.frequenciaVisitas >= 4) score += 40;
  else if (dados.frequenciaVisitas >= 2) score += 30;
  else if (dados.frequenciaVisitas >= 1) score += 20;
  else if (dados.frequenciaVisitas >= 0.5) score += 10;
  else score += 5;

  // 2. LONGEVIDADE (25 pontos)
  if (dados.diasComoCliente > 365) score += 25;
  else if (dados.diasComoCliente > 180) score += 20;
  else if (dados.diasComoCliente > 90) score += 15;
  else if (dados.diasComoCliente > 30) score += 10;
  else score += 5;

  // 3. VOLUME (20 pontos)
  if (dados.totalVisitas >= 50) score += 20;
  else if (dados.totalVisitas >= 25) score += 15;
  else if (dados.totalVisitas >= 10) score += 10;
  else if (dados.totalVisitas >= 5) score += 5;

  // 4. TENDÊNCIA FREQUÊNCIA (10 pontos)
  if (dados.tendenciaFrequencia === 'crescente') score += 10;
  else if (dados.tendenciaFrequencia === 'estavel') score += 5;

  // 5. TENDÊNCIA VALOR (5 pontos)
  if (dados.tendenciaValor === 'crescente') score += 5;
  else if (dados.tendenciaValor === 'estavel') score += 3;

  // LIMITAR SCORE para clientes com poucos dados (máximo 40 = médio)
  if (dados.limitarScore && score > 40) {
    score = 40;
  }

  let nivel: 'baixo' | 'medio' | 'alto' | 'muito_alto';
  if (score >= 80) nivel = 'muito_alto';
  else if (score >= 60) nivel = 'alto';
  else if (score >= 35) nivel = 'medio';
  else nivel = 'baixo';

  return { score, nivel };
}

// Calcular tendência
function calcularTendencia(valoresAntigos: number[], valoresRecentes: number[]): 'crescente' | 'estavel' | 'decrescente' {
  const mediaAntiga = valoresAntigos.length > 0
    ? valoresAntigos.reduce((a, b) => a + b, 0) / valoresAntigos.length
    : 0;
  
  const mediaRecente = valoresRecentes.length > 0
    ? valoresRecentes.reduce((a, b) => a + b, 0) / valoresRecentes.length
    : 0;

  if (mediaAntiga === 0 && mediaRecente === 0) return 'estavel';
  if (mediaAntiga === 0) return 'crescente';
  
  if (mediaRecente > mediaAntiga * 1.1) return 'crescente';
  if (mediaRecente < mediaAntiga * 0.9) return 'decrescente';
  return 'estavel';
}

// Função para normalizar telefone
const normalizarTelefone = (fone: string): string | null => {
  if (!fone) return null;
  const limpo = fone.replace(/\D/g, '');
  if (limpo.length < 10) return null;
  return limpo.slice(-9);
};

// Determinar nível de confiança
function determinarConfianca(totalVisitas: number): 'alta' | 'media' | 'baixa' {
  if (totalVisitas >= 10) return 'alta';
  if (totalVisitas >= MINIMO_VISITAS_CONFIAVEL) return 'media';
  return 'baixa';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telefone = searchParams.get('telefone');
    const limite = parseInt(searchParams.get('limite') || '100');
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    if (telefone) {
      return await calcularLTVCliente(telefone, barId);
    } else {
      return await calcularLTVTodosClientes(limite, barId);
    }

  } catch (error: any) {
    console.error('❌ Erro ao calcular LTV:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function calcularLTVCliente(telefone: string, barId: number = 3) {
  const telefoneNorm = normalizarTelefone(telefone) || telefone;
  
  // Buscar dados de visitas
  const { data: visitasClienteData } = await supabase
    .schema('silver')
    .from('cliente_visitas')
    .select('cliente_nome, cliente_fone, data_visita, valor_couvert, valor_pagamentos')
    .eq('bar_id', barId)
    .ilike('cliente_fone', `%${telefoneNorm}%`)
    .order('data_visita', { ascending: true });

  if (!visitasClienteData?.length) {
    throw new Error('Cliente não encontrado');
  }

  // Buscar ticket médio do bar para referência
  const { data: ticketBarData } = await supabase
    .schema('silver')
    .from('cliente_visitas')
    .select('valor_couvert, valor_pagamentos')
    .eq('bar_id', barId)
    .limit(10000);

  const ticketMedioBar = ticketBarData && ticketBarData.length > 0
    ? ticketBarData.reduce((sum, item) => sum + (item.valor_couvert || 0) + (item.valor_pagamentos || 0), 0) / ticketBarData.length
    : 150; // Fallback

  // Consolidar visitas
  const visitas: Array<{ data: Date; valor: number }> = [];
  let nomeCliente = 'Cliente';

  visitasClienteData.forEach(v => {
    const valor = (v.valor_couvert || 0) + (v.valor_pagamentos || 0);
    visitas.push({ data: new Date(v.data_visita), valor });
    if (!nomeCliente || nomeCliente === 'Cliente') {
      nomeCliente = v.cliente_nome || 'Cliente';
    }
  });

  visitas.sort((a, b) => a.data.getTime() - b.data.getTime());

  const totalVisitas = visitas.length;
  const dadosPreliminares = totalVisitas < MINIMO_VISITAS_CONFIAVEL;
  const confianca = determinarConfianca(totalVisitas);

  // Cálculos base
  const hoje = new Date();
  const primeiraVisita = visitas[0].data;
  const ultimaVisita = visitas[visitas.length - 1].data;
  const diasComoCliente = Math.floor((hoje.getTime() - primeiraVisita.getTime()) / (1000 * 60 * 60 * 24));
  const mesesComoCliente = Math.max(diasComoCliente / 30, 1);

  const ltvAtual = visitas.reduce((sum, v) => sum + v.valor, 0);
  const ticketMedioReal = ltvAtual / totalVisitas;
  
  // Para projeções: usar ticket do bar se dados preliminares
  const ticketMedioUsado = dadosPreliminares ? ticketMedioBar : ticketMedioReal;
  
  const frequenciaVisitas = totalVisitas / mesesComoCliente;
  const valorMedioMensal = ltvAtual / mesesComoCliente;

  // Tendências (só calcular se tiver dados suficientes)
  let tendenciaValor: 'crescente' | 'estavel' | 'decrescente' = 'estavel';
  let tendenciaFrequencia: 'crescente' | 'estavel' | 'decrescente' = 'estavel';

  if (totalVisitas >= MINIMO_VISITAS_CONFIAVEL) {
    const metade = Math.floor(totalVisitas / 2);
    const valoresAntigos = visitas.slice(0, metade).map(v => v.valor);
    const valoresRecentes = visitas.slice(metade).map(v => v.valor);
    tendenciaValor = calcularTendencia(valoresAntigos, valoresRecentes);

    const data90DiasAtras = new Date();
    data90DiasAtras.setDate(data90DiasAtras.getDate() - 90);
    const data180DiasAtras = new Date();
    data180DiasAtras.setDate(data180DiasAtras.getDate() - 180);

    const visitasUltimos90 = visitas.filter(v => v.data >= data90DiasAtras).length;
    const visitas90a180 = visitas.filter(v => v.data >= data180DiasAtras && v.data < data90DiasAtras).length;

    tendenciaFrequencia = visitasUltimos90 > visitas90a180 ? 'crescente' :
      visitasUltimos90 < visitas90a180 ? 'decrescente' : 'estavel';
  }

  // Projeções de LTV
  let fatorAjuste = 1.0;
  if (!dadosPreliminares) {
    if (tendenciaValor === 'crescente' && tendenciaFrequencia === 'crescente') {
      fatorAjuste = 1.3;
    } else if (tendenciaValor === 'crescente' || tendenciaFrequencia === 'crescente') {
      fatorAjuste = 1.15;
    } else if (tendenciaValor === 'decrescente' && tendenciaFrequencia === 'decrescente') {
      fatorAjuste = 0.7;
    } else if (tendenciaValor === 'decrescente' || tendenciaFrequencia === 'decrescente') {
      fatorAjuste = 0.85;
    }
  } else {
    // Para dados preliminares: usar fator conservador
    fatorAjuste = FATOR_CONSERVADOR;
  }

    // Projeção APENAS para clientes confiáveis (3+ visitas)
    // Clientes preliminares: sem projeção (não temos dados suficientes)
    let ltvProjetado12m = 0;
    let ltvProjetado24m = 0;
    
    if (!dadosPreliminares) {
      ltvProjetado12m = ticketMedioUsado * frequenciaVisitas * 12 * fatorAjuste;
      ltvProjetado24m = ticketMedioUsado * frequenciaVisitas * 24 * fatorAjuste;
    }

  // Score de engajamento
  const { score, nivel } = calcularScoreEngajamento({
    frequenciaVisitas,
    diasComoCliente,
    totalVisitas,
    tendenciaFrequencia,
    tendenciaValor,
    limitarScore: dadosPreliminares
  });

  // Potencial de crescimento
  let potencialCrescimento: 'baixo' | 'medio' | 'alto';
  if (dadosPreliminares) {
    potencialCrescimento = 'medio'; // Conservador para dados preliminares
  } else if (score >= 70 && (tendenciaValor === 'crescente' || tendenciaFrequencia === 'crescente')) {
    potencialCrescimento = 'alto';
  } else if (score >= 40) {
    potencialCrescimento = 'medio';
  } else {
    potencialCrescimento = 'baixo';
  }

  // ROI de Marketing (apenas para clientes confiáveis)
  const custoMarketingEstimado = 50;
  const roiMarketing = dadosPreliminares 
    ? 0 // Sem ROI para dados preliminares
    : (ltvProjetado12m / custoMarketingEstimado);

  const resultado: ClienteLTV = {
    telefone,
    nome: nomeCliente,
    ltv_atual: Math.round(ltvAtual),
    ltv_projetado_12m: Math.round(ltvProjetado12m),
    ltv_projetado_24m: Math.round(ltvProjetado24m),
    score_engajamento: score,
    nivel_engajamento: nivel,
    total_visitas: totalVisitas,
    primeira_visita: primeiraVisita.toISOString(),
    ultima_visita: ultimaVisita.toISOString(),
    dias_como_cliente: diasComoCliente,
    frequencia_visitas: Math.round(frequenciaVisitas * 10) / 10,
    ticket_medio: Math.round(ticketMedioReal),
    ticket_medio_usado: Math.round(ticketMedioUsado),
    valor_medio_mensal: Math.round(valorMedioMensal),
    tendencia_valor: tendenciaValor,
    tendencia_frequencia: tendenciaFrequencia,
    potencial_crescimento: potencialCrescimento,
    roi_marketing: Math.round(roiMarketing * 10) / 10,
    confianca,
    dados_preliminares: dadosPreliminares
  };

  return NextResponse.json({
    success: true,
    data: resultado
  });
}

async function calcularLTVTodosClientes(limite: number, barId: number = 3) {
  // Verificar cache
  const cacheKey = `ltv_engajamento_v4_${barId}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return NextResponse.json({
      success: true,
      data: cached.resultados.slice(0, limite),
      stats: cached.stats,
      ticket_medio_bar: cached.ticketMedioBar,
      fromCache: true
    });
  }

  // Buscar dados de visitas
  const visitasDataRaw = await fetchAllData(
    'visitas',
    'cliente_nome, cliente_fone, data_visita, valor_couvert, valor_pagamentos',
    { eq_bar_id: barId }
  );

  const visitasDataAll = visitasDataRaw.filter(item => 
    item.cliente_fone && item.cliente_fone.trim() !== '' && 
    item.cliente_nome && item.cliente_nome.trim() !== ''
  );

  // Consolidar por telefone
  const clientesMap = new Map<string, {
    telefone: string;
    nome: string;
    visitas: Array<{ data: Date; valor: number }>;
  }>();

  for (const item of visitasDataAll) {
    const telefoneNorm = normalizarTelefone(item.cliente_fone);
    if (!telefoneNorm) continue;

    if (!clientesMap.has(telefoneNorm)) {
      clientesMap.set(telefoneNorm, {
        telefone: telefoneNorm,
        nome: item.cliente_nome || 'Cliente',
        visitas: []
      });
    }

    const valor = (item.valor_couvert || 0) + (item.valor_pagamentos || 0);
    clientesMap.get(telefoneNorm)!.visitas.push({
      data: new Date(item.data_visita),
      valor
    });
  }

  // CALCULAR TICKET MÉDIO DO BAR (baseado em clientes com 3+ visitas)
  let somaTicketsConfiaveis = 0;
  let countTicketsConfiaveis = 0;

  for (const [, dados] of clientesMap.entries()) {
    if (dados.visitas.length >= MINIMO_VISITAS_CONFIAVEL) {
      const ltvCliente = dados.visitas.reduce((sum, v) => sum + v.valor, 0);
      const ticketCliente = ltvCliente / dados.visitas.length;
      somaTicketsConfiaveis += ticketCliente;
      countTicketsConfiaveis++;
    }
  }

  const ticketMedioBar = countTicketsConfiaveis > 0 
    ? somaTicketsConfiaveis / countTicketsConfiaveis 
    : 150; // Fallback

  // Calcular LTV para cada cliente
  const resultados: ClienteLTV[] = [];
  const hoje = new Date();

  for (const [telefone, dados] of clientesMap.entries()) {
    if (dados.visitas.length < 1) continue;

    dados.visitas.sort((a, b) => a.data.getTime() - b.data.getTime());

    const totalVisitas = dados.visitas.length;
    const dadosPreliminares = totalVisitas < MINIMO_VISITAS_CONFIAVEL;
    const confianca = determinarConfianca(totalVisitas);

    const primeiraVisita = dados.visitas[0].data;
    const ultimaVisita = dados.visitas[dados.visitas.length - 1].data;
    const diasComoCliente = Math.floor((hoje.getTime() - primeiraVisita.getTime()) / (1000 * 60 * 60 * 24));
    const mesesComoCliente = Math.max(diasComoCliente / 30, 1);

    const ltvAtual = dados.visitas.reduce((sum, v) => sum + v.valor, 0);
    const ticketMedioReal = ltvAtual / totalVisitas;
    
    // Para projeções: usar ticket do bar se dados preliminares
    const ticketMedioUsado = dadosPreliminares ? ticketMedioBar : ticketMedioReal;
    
    const frequenciaVisitas = totalVisitas / mesesComoCliente;
    const valorMedioMensal = ltvAtual / mesesComoCliente;

    // Tendências
    let tendenciaValor: 'crescente' | 'estavel' | 'decrescente' = 'estavel';
    let tendenciaFrequencia: 'crescente' | 'estavel' | 'decrescente' = 'estavel';

    if (!dadosPreliminares) {
      const metade = Math.floor(totalVisitas / 2);
      const valoresAntigos = dados.visitas.slice(0, metade).map(v => v.valor);
      const valoresRecentes = dados.visitas.slice(metade).map(v => v.valor);
      tendenciaValor = calcularTendencia(valoresAntigos, valoresRecentes);

      const data90DiasAtras = new Date();
      data90DiasAtras.setDate(data90DiasAtras.getDate() - 90);
      const data180DiasAtras = new Date();
      data180DiasAtras.setDate(data180DiasAtras.getDate() - 180);

      const visitasUltimos90 = dados.visitas.filter(v => v.data >= data90DiasAtras).length;
      const visitas90a180 = dados.visitas.filter(v => v.data >= data180DiasAtras && v.data < data90DiasAtras).length;

      tendenciaFrequencia = visitasUltimos90 > visitas90a180 ? 'crescente' :
        visitasUltimos90 < visitas90a180 ? 'decrescente' : 'estavel';
    }

    // Projeções
    let fatorAjuste = 1.0;
    if (!dadosPreliminares) {
      if (tendenciaValor === 'crescente' && tendenciaFrequencia === 'crescente') {
        fatorAjuste = 1.3;
      } else if (tendenciaValor === 'crescente' || tendenciaFrequencia === 'crescente') {
        fatorAjuste = 1.15;
      } else if (tendenciaValor === 'decrescente' && tendenciaFrequencia === 'decrescente') {
        fatorAjuste = 0.7;
      } else if (tendenciaValor === 'decrescente' || tendenciaFrequencia === 'decrescente') {
        fatorAjuste = 0.85;
      }
    } else {
      fatorAjuste = FATOR_CONSERVADOR;
    }

    // Projeção APENAS para clientes confiáveis
    let ltvProjetado12m = 0;
    let ltvProjetado24m = 0;
    
    if (!dadosPreliminares) {
      ltvProjetado12m = ticketMedioUsado * frequenciaVisitas * 12 * fatorAjuste;
      ltvProjetado24m = ticketMedioUsado * frequenciaVisitas * 24 * fatorAjuste;
    }

    const { score, nivel } = calcularScoreEngajamento({
      frequenciaVisitas,
      diasComoCliente,
      totalVisitas,
      tendenciaFrequencia,
      tendenciaValor,
      limitarScore: dadosPreliminares
    });

    let potencialCrescimento: 'baixo' | 'medio' | 'alto';
    if (dadosPreliminares) {
      potencialCrescimento = 'medio';
    } else if (score >= 70 && (tendenciaValor === 'crescente' || tendenciaFrequencia === 'crescente')) {
      potencialCrescimento = 'alto';
    } else if (score >= 40) {
      potencialCrescimento = 'medio';
    } else {
      potencialCrescimento = 'baixo';
    }

    const custoMarketingEstimado = 50;
    const roiMarketing = dadosPreliminares 
      ? 0 // Sem ROI para dados preliminares
      : (ltvProjetado12m / custoMarketingEstimado);

    resultados.push({
      telefone,
      nome: dados.nome,
      ltv_atual: Math.round(ltvAtual),
      ltv_projetado_12m: Math.round(ltvProjetado12m),
      ltv_projetado_24m: Math.round(ltvProjetado24m),
      score_engajamento: score,
      nivel_engajamento: nivel,
      total_visitas: totalVisitas,
      primeira_visita: primeiraVisita.toISOString(),
      ultima_visita: ultimaVisita.toISOString(),
      dias_como_cliente: diasComoCliente,
      frequencia_visitas: Math.round(frequenciaVisitas * 10) / 10,
      ticket_medio: Math.round(ticketMedioReal),
      ticket_medio_usado: Math.round(ticketMedioUsado),
      valor_medio_mensal: Math.round(valorMedioMensal),
      tendencia_valor: tendenciaValor,
      tendencia_frequencia: tendenciaFrequencia,
      potencial_crescimento: potencialCrescimento,
      roi_marketing: Math.round(roiMarketing * 10) / 10,
      confianca,
      dados_preliminares: dadosPreliminares
    });
  }

  // Ordenar por LTV ATUAL (não projetado) - mais realista
  resultados.sort((a, b) => b.ltv_atual - a.ltv_atual);

  // Estatísticas (projeções só de clientes confiáveis)
  const clientesConfiaveis = resultados.filter(r => !r.dados_preliminares);
  const stats = {
    total_clientes: resultados.length,
    clientes_confiaveis: clientesConfiaveis.length,
    clientes_preliminares: resultados.length - clientesConfiaveis.length,
    ltv_total_atual: resultados.reduce((sum, c) => sum + c.ltv_atual, 0),
    // Projeção APENAS de clientes confiáveis (3+ visitas)
    ltv_total_projetado_12m: clientesConfiaveis.reduce((sum, c) => sum + c.ltv_projetado_12m, 0),
    ltv_medio_atual: resultados.length > 0 ? Math.round(resultados.reduce((sum, c) => sum + c.ltv_atual, 0) / resultados.length) : 0,
    ltv_medio_confiaveis: clientesConfiaveis.length > 0 ? Math.round(clientesConfiaveis.reduce((sum, c) => sum + c.ltv_atual, 0) / clientesConfiaveis.length) : 0,
    ltv_medio_projetado_confiaveis: clientesConfiaveis.length > 0 ? Math.round(clientesConfiaveis.reduce((sum, c) => sum + c.ltv_projetado_12m, 0) / clientesConfiaveis.length) : 0,
    ticket_medio_bar: Math.round(ticketMedioBar),
    engajamento_muito_alto: resultados.filter(c => c.nivel_engajamento === 'muito_alto').length,
    engajamento_alto: resultados.filter(c => c.nivel_engajamento === 'alto').length,
    engajamento_medio: resultados.filter(c => c.nivel_engajamento === 'medio').length,
    engajamento_baixo: resultados.filter(c => c.nivel_engajamento === 'baixo').length,
  };

  // Salvar no cache
  setCache(cacheKey, { resultados, stats, ticketMedioBar });

  return NextResponse.json({
    success: true,
    data: resultados.slice(0, limite),
    stats,
    ticket_medio_bar: Math.round(ticketMedioBar),
    fromCache: false
  });
}
