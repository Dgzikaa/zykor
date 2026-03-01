/**
 * 🗓️ DATE HELPERS - PROTEÇÃO CONTRA ANO INCORRETO
 * 
 * ⚠️ REGRA CRÍTICA: NUNCA hardcodar anos no código!
 * Sempre usar estas funções para garantir o ano correto do sistema.
 * 
 * Documentação: docs/REGRA_CRITICA_ANO_CORRENTE.md
 */

/**
 * 🗓️ Obtém o ano atual do sistema
 * NUNCA hardcodar o ano - sempre usar esta função
 */
export function getAnoAtual(): number {
  const ano = new Date().getFullYear();
  console.log(`🗓️ [dateHelpers] Ano atual do sistema: ${ano}`);
  return ano;
}

/**
 * 🗓️ Obtém a data atual formatada para SQL (YYYY-MM-DD)
 */
export function getDataAtualSQL(): string {
  const data = new Date().toISOString().split('T')[0];
  console.log(`🗓️ [dateHelpers] Data atual SQL: ${data}`);
  return data;
}

/**
 * 🗓️ Obtém o timestamp atual formatado (ISO 8601)
 */
export function getTimestampAtual(): string {
  return new Date().toISOString();
}

/**
 * 🗓️ Valida se um ano é válido
 * Considera válido: entre 2020 e ano atual + 1
 * 
 * @param ano - Ano a validar
 * @returns true se válido, false caso contrário
 */
export function validarAno(ano: number): boolean {
  const anoAtual = getAnoAtual();
  const valido = ano >= 2020 && ano <= anoAtual + 1;
  
  if (!valido) {
    console.warn(`⚠️ [dateHelpers] Ano inválido: ${ano}. Ano atual: ${anoAtual}`);
  }
  
  return valido;
}

/**
 * 🗓️ Valida ano específico por bar
 * Cada bar tem um ano de início de operação
 * 
 * @param barId - ID do bar
 * @param ano - Ano a validar
 * @returns true se válido para o bar, false caso contrário
 */
export function validarAnoBar(barId: number, ano: number): boolean {
  // Anos de início de operação por bar
  const inicioOperacao: Record<number, number> = {
    3: 2025, // Ordinário Bar - começou em 2025
    4: 2024, // Deboche Bar - começou em 2024
  };
  
  const anoInicio = inicioOperacao[barId];
  if (!anoInicio) {
    console.error(`❌ [dateHelpers] Bar ID ${barId} não encontrado`);
    return false;
  }
  
  const anoAtual = getAnoAtual();
  const valido = ano >= anoInicio && ano <= anoAtual;
  
  if (!valido) {
    console.warn(
      `⚠️ [dateHelpers] Ano ${ano} inválido para bar ${barId}. ` +
      `Válido: ${anoInicio} até ${anoAtual}`
    );
  }
  
  return valido;
}

/**
 * 🗓️ Obtém informações da semana atual
 * Retorna ano, número da semana, data início e fim
 */
export function getSemanaAtual(): { 
  ano: number; 
  semana: number; 
  dataInicio: string; 
  dataFim: string;
} {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  
  // Calcular número da semana (ISO 8601)
  const primeiroDiaAno = new Date(anoAtual, 0, 1);
  const diasPassados = Math.floor(
    (hoje.getTime() - primeiroDiaAno.getTime()) / (24 * 60 * 60 * 1000)
  );
  const numeroSemana = Math.ceil((diasPassados + primeiroDiaAno.getDay() + 1) / 7);
  
  // Calcular data início/fim da semana (domingo a sábado)
  const diaSemana = hoje.getDay();
  const dataInicio = new Date(hoje);
  dataInicio.setDate(hoje.getDate() - diaSemana);
  const dataFim = new Date(dataInicio);
  dataFim.setDate(dataInicio.getDate() + 6);
  
  const resultado = {
    ano: anoAtual,
    semana: numeroSemana,
    dataInicio: dataInicio.toISOString().split('T')[0],
    dataFim: dataFim.toISOString().split('T')[0]
  };
  
  console.log(`🗓️ [dateHelpers] Semana atual:`, resultado);
  
  return resultado;
}

/**
 * 🗓️ Formata data para exibição (DD/MM/YYYY)
 */
export function formatarDataBR(data: Date | string): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * 🗓️ Formata data para SQL (YYYY-MM-DD)
 */
export function formatarDataSQL(data: Date | string): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return d.toISOString().split('T')[0];
}

/**
 * 🗓️ Obtém range de datas para período
 * 
 * @param periodo - 'hoje' | 'semana' | 'mes' | 'ano'
 * @returns { dataInicio, dataFim } em formato SQL
 */
export function getRangePeriodo(
  periodo: 'hoje' | 'semana' | 'mes' | 'ano'
): { dataInicio: string; dataFim: string } {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  
  let dataInicio: Date;
  let dataFim: Date = hoje;
  
  switch (periodo) {
    case 'hoje':
      dataInicio = hoje;
      break;
      
    case 'semana': {
      const diaSemana = hoje.getDay();
      dataInicio = new Date(hoje);
      dataInicio.setDate(diaAtual - diaSemana);
      dataFim = new Date(dataInicio);
      dataFim.setDate(dataInicio.getDate() + 6);
      break;
    }
      
    case 'mes':
      dataInicio = new Date(anoAtual, mesAtual, 1);
      dataFim = new Date(anoAtual, mesAtual + 1, 0);
      break;
      
    case 'ano':
      dataInicio = new Date(anoAtual, 0, 1);
      dataFim = new Date(anoAtual, 11, 31);
      break;
      
    default:
      dataInicio = hoje;
  }
  
  return {
    dataInicio: formatarDataSQL(dataInicio),
    dataFim: formatarDataSQL(dataFim)
  };
}

/**
 * 🗓️ Calcula diferença em dias entre duas datas
 */
export function diferencaDias(data1: Date | string, data2: Date | string): number {
  const d1 = typeof data1 === 'string' ? new Date(data1) : data1;
  const d2 = typeof data2 === 'string' ? new Date(data2) : data2;
  
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * 🗓️ Verifica se uma data é válida
 */
export function isDataValida(data: string): boolean {
  const d = new Date(data);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * 🗓️ Obtém informações de debug sobre data/hora do sistema
 * Útil para diagnóstico de problemas
 */
export function getDebugInfo(): {
  timestamp: string;
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
  timezone: string;
  timestampUnix: number;
} {
  const agora = new Date();
  
  return {
    timestamp: agora.toISOString(),
    ano: agora.getFullYear(),
    mes: agora.getMonth() + 1,
    dia: agora.getDate(),
    hora: agora.getHours(),
    minuto: agora.getMinutes(),
    segundo: agora.getSeconds(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestampUnix: agora.getTime()
  };
}
