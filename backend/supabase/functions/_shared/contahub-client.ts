/**
 * 🏪 ContaHub Client - Cliente Unificado para API ContaHub
 * 
 * Módulo compartilhado para autenticação e requisições à API do ContaHub.
 * Centraliza login, busca de dados, e processamento de respostas.
 */

export interface ContaHubCredentials {
  email: string;
  senha: string;
  bar_id: number;
}

export interface ContaHubSession {
  token: string;
  expiresAt: Date;
  barId: number;
}

export interface ContaHubPeriodo {
  data: string;
  vr_couvert: number;
  pessoas: number;
  total_pessoas_pagantes: number;
  [key: string]: any;
}

export interface ContaHubPagamento {
  data: string;
  forma_pagamento: string;
  liquido: number;
  bruto: number;
  [key: string]: any;
}

/**
 * Fazer login no ContaHub e obter token
 */
export async function loginContaHub(
  email: string,
  senha: string
): Promise<string> {
  try {
    const response = await fetch('https://api.contahub.com.br/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    
    if (!response.ok) {
      throw new Error(`Erro no login ContaHub: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.token) {
      throw new Error('Token não retornado pelo ContaHub');
    }
    
    return data.token;
  } catch (error) {
    console.error('❌ Erro ao fazer login no ContaHub:', error);
    throw new Error(`Falha no login ContaHub: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Buscar dados do ContaHub com autenticação
 */
export async function fetchContaHubData(
  endpoint: string,
  token: string,
  params?: Record<string, string | number>
): Promise<any> {
  try {
    let url = `https://api.contahub.com.br${endpoint}`;
    
    if (params) {
      const queryString = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();
      url += `?${queryString}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Erro na requisição ContaHub: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('❌ Erro ao buscar dados do ContaHub:', error);
    throw new Error(`Falha ao buscar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Buscar dados com divisão por local (bar, cozinha, etc)
 */
export async function fetchComDivisaoPorLocal(
  endpoint: string,
  token: string,
  dataInicio: string,
  dataFim: string,
  barId: number
): Promise<any[]> {
  try {
    const response = await fetchContaHubData(endpoint, token, {
      data_inicio: dataInicio,
      data_fim: dataFim,
      bar_id: barId,
      dividir_por_local: 'true',
    });
    
    return Array.isArray(response) ? response : response.data || [];
  } catch (error) {
    console.error('❌ Erro ao buscar dados com divisão por local:', error);
    return [];
  }
}

/**
 * Gerar timestamp dinâmico para evitar cache
 */
export function generateDynamicTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Buscar dados de período (couvert, pessoas)
 */
export async function buscarDadosPeriodo(
  token: string,
  dataInicio: string,
  dataFim: string,
  barId: number
): Promise<ContaHubPeriodo[]> {
  try {
    const data = await fetchContaHubData('/periodo', token, {
      data_inicio: dataInicio,
      data_fim: dataFim,
      bar_id: barId,
    });
    
    return Array.isArray(data) ? data : data.periodos || [];
  } catch (error) {
    console.error('❌ Erro ao buscar dados de período:', error);
    return [];
  }
}

/**
 * Buscar dados de pagamentos
 */
export async function buscarDadosPagamentos(
  token: string,
  dataInicio: string,
  dataFim: string,
  barId: number
): Promise<ContaHubPagamento[]> {
  try {
    const data = await fetchContaHubData('/pagamentos', token, {
      data_inicio: dataInicio,
      data_fim: dataFim,
      bar_id: barId,
    });
    
    return Array.isArray(data) ? data : data.pagamentos || [];
  } catch (error) {
    console.error('❌ Erro ao buscar dados de pagamentos:', error);
    return [];
  }
}

/**
 * Buscar dados de produtos vendidos
 */
export async function buscarDadosProdutos(
  token: string,
  dataInicio: string,
  dataFim: string,
  barId: number
): Promise<any[]> {
  try {
    const data = await fetchContaHubData('/produtos/vendidos', token, {
      data_inicio: dataInicio,
      data_fim: dataFim,
      bar_id: barId,
    });
    
    return Array.isArray(data) ? data : data.produtos || [];
  } catch (error) {
    console.error('❌ Erro ao buscar dados de produtos:', error);
    return [];
  }
}

/**
 * Buscar dados de stockout (produtos indisponíveis)
 */
export async function buscarDadosStockout(
  token: string,
  dataInicio: string,
  dataFim: string,
  barId: number
): Promise<any[]> {
  try {
    const data = await fetchContaHubData('/produtos/stockout', token, {
      data_inicio: dataInicio,
      data_fim: dataFim,
      bar_id: barId,
    });
    
    return Array.isArray(data) ? data : data.stockout || [];
  } catch (error) {
    console.error('❌ Erro ao buscar dados de stockout:', error);
    return [];
  }
}

/**
 * Processar dados de pagamentos por tipo
 */
export function processarPagamentosPorTipo(
  pagamentos: ContaHubPagamento[]
): Record<string, { bruto: number; liquido: number; quantidade: number }> {
  const resultado: Record<string, { bruto: number; liquido: number; quantidade: number }> = {};
  
  for (const pagamento of pagamentos) {
    const tipo = pagamento.forma_pagamento || 'Outros';
    
    if (!resultado[tipo]) {
      resultado[tipo] = { bruto: 0, liquido: 0, quantidade: 0 };
    }
    
    resultado[tipo].bruto += pagamento.bruto || 0;
    resultado[tipo].liquido += pagamento.liquido || 0;
    resultado[tipo].quantidade += 1;
  }
  
  return resultado;
}

/**
 * Agrupar dados por data
 */
export function agruparPorData<T extends { data: string }>(
  dados: T[]
): Record<string, T[]> {
  const agrupado: Record<string, T[]> = {};
  
  for (const item of dados) {
    if (!agrupado[item.data]) {
      agrupado[item.data] = [];
    }
    agrupado[item.data].push(item);
  }
  
  return agrupado;
}

/**
 * Calcular totais de um período
 */
export function calcularTotaisPeriodo(periodos: ContaHubPeriodo[]): {
  totalCouvert: number;
  totalPessoas: number;
  totalPessoasPagantes: number;
  dias: number;
} {
  return {
    totalCouvert: periodos.reduce((sum, p) => sum + (p.vr_couvert || 0), 0),
    totalPessoas: periodos.reduce((sum, p) => sum + (p.pessoas || 0), 0),
    totalPessoasPagantes: periodos.reduce((sum, p) => sum + (p.total_pessoas_pagantes || 0), 0),
    dias: periodos.length,
  };
}

/**
 * Calcular totais de pagamentos
 */
export function calcularTotaisPagamentos(pagamentos: ContaHubPagamento[]): {
  totalBruto: number;
  totalLiquido: number;
  totalTransacoes: number;
} {
  return {
    totalBruto: pagamentos.reduce((sum, p) => sum + (p.bruto || 0), 0),
    totalLiquido: pagamentos.reduce((sum, p) => sum + (p.liquido || 0), 0),
    totalTransacoes: pagamentos.length,
  };
}
