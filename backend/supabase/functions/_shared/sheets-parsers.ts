/**
 * 📊 Sheets Parsers - Parsing de Dados do Google Sheets
 * 
 * Módulo compartilhado para parsing e conversão de dados do Google Sheets.
 * Lida com formatos monetários, percentuais, datas, e outros tipos comuns.
 */

/**
 * Parsear valor monetário do Sheets (R$ 1.234,56 → 1234.56)
 */
export function parseMonetario(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') {
    return 0;
  }
  
  if (typeof valor === 'number') {
    return valor;
  }
  
  const valorLimpo = String(valor)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  const numero = parseFloat(valorLimpo);
  
  return isNaN(numero) ? 0 : numero;
}

/**
 * Parsear percentual do Sheets (15% → 15, 0.15 → 15)
 */
export function parsePercentual(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') {
    return 0;
  }
  
  if (typeof valor === 'number') {
    if (valor <= 1) {
      return valor * 100;
    }
    return valor;
  }
  
  const valorLimpo = String(valor).replace('%', '').replace(',', '.').trim();
  const numero = parseFloat(valorLimpo);
  
  if (isNaN(numero)) {
    return 0;
  }
  
  if (numero <= 1) {
    return numero * 100;
  }
  
  return numero;
}

/**
 * Parsear número inteiro do Sheets
 */
export function parseInteiro(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') {
    return 0;
  }
  
  if (typeof valor === 'number') {
    return Math.round(valor);
  }
  
  const valorLimpo = String(valor)
    .replace(/[^\d-]/g, '');
  
  const numero = parseInt(valorLimpo, 10);
  
  return isNaN(numero) ? 0 : numero;
}

/**
 * Parsear número decimal do Sheets
 */
export function parseDecimal(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') {
    return 0;
  }
  
  if (typeof valor === 'number') {
    return valor;
  }
  
  const valorLimpo = String(valor)
    .replace(/\./g, '')
    .replace(',', '.');
  
  const numero = parseFloat(valorLimpo);
  
  return isNaN(numero) ? 0 : numero;
}

/**
 * Converter data DD/MM/YYYY para YYYY-MM-DD
 */
export function converterData(dataStr: string | null | undefined): string | null {
  if (!dataStr) return null;
  
  const str = String(dataStr).trim();
  
  if (str.includes('-')) {
    return str;
  }
  
  if (str.includes('/')) {
    const partes = str.split('/');
    if (partes.length !== 3) return null;
    
    const [dia, mes, ano] = partes;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  
  return null;
}

/**
 * Converter data YYYY-MM-DD para DD/MM/YYYY
 */
export function formatarDataBR(dataStr: string | null | undefined): string | null {
  if (!dataStr) return null;
  
  const str = String(dataStr).trim();
  
  if (str.includes('/')) {
    return str;
  }
  
  if (str.includes('-')) {
    const partes = str.split('-');
    if (partes.length !== 3) return null;
    
    const [ano, mes, dia] = partes;
    return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
  }
  
  return null;
}

/**
 * Parsear booleano do Sheets (Sim/Não, True/False, 1/0)
 */
export function parseBooleano(valor: string | number | boolean | null | undefined): boolean {
  if (valor === null || valor === undefined || valor === '') {
    return false;
  }
  
  if (typeof valor === 'boolean') {
    return valor;
  }
  
  if (typeof valor === 'number') {
    return valor !== 0;
  }
  
  const str = String(valor).toLowerCase().trim();
  
  return ['sim', 'yes', 'true', '1', 's', 'y'].includes(str);
}

/**
 * Limpar texto do Sheets (remover espaços extras, quebras de linha)
 */
export function limparTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  
  return String(texto)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parsear lista de valores separados por vírgula
 */
export function parseLista(valor: string | null | undefined): string[] {
  if (!valor) return [];
  
  return String(valor)
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Parsear hora (HH:MM → minutos desde meia-noite)
 */
export function parseHora(hora: string | null | undefined): number | null {
  if (!hora) return null;
  
  const str = String(hora).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})$/);
  
  if (!match) return null;
  
  const horas = parseInt(match[1], 10);
  const minutos = parseInt(match[2], 10);
  
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) {
    return null;
  }
  
  return horas * 60 + minutos;
}

/**
 * Converter minutos para hora (720 → "12:00")
 */
export function minutosParaHora(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Validar se célula está vazia
 */
export function celulaVazia(valor: any): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'string' && valor.trim() === '') return true;
  return false;
}

/**
 * Obter valor da célula com fallback
 */
export function obterValor<T>(
  valor: any,
  fallback: T,
  parser?: (v: any) => T
): T {
  if (celulaVazia(valor)) {
    return fallback;
  }
  
  if (parser) {
    try {
      return parser(valor);
    } catch (error) {
      console.warn('Erro ao parsear valor:', error);
      return fallback;
    }
  }
  
  return valor as T;
}

/**
 * Parsear linha do Sheets com schema
 */
export function parsearLinha<T>(
  linha: any[],
  schema: Record<number, { campo: keyof T; parser?: (v: any) => any; fallback?: any }>
): Partial<T> {
  const resultado: Partial<T> = {};
  
  for (const [indice, config] of Object.entries(schema)) {
    const idx = parseInt(indice, 10);
    const valor = linha[idx];
    
    const valorParsed = obterValor(
      valor,
      config.fallback,
      config.parser
    );
    
    resultado[config.campo] = valorParsed;
  }
  
  return resultado;
}

/**
 * Validar range do Sheets (A1:Z100)
 */
export function validarRange(range: string): boolean {
  return /^[A-Z]+\d+:[A-Z]+\d+$/.test(range);
}

/**
 * Construir range do Sheets
 */
export function construirRange(
  aba: string,
  colunaInicio: string,
  linhaInicio: number,
  colunaFim: string,
  linhaFim?: number
): string {
  const fim = linhaFim ? `${colunaFim}${linhaFim}` : colunaFim;
  return `${aba}!${colunaInicio}${linhaInicio}:${fim}`;
}
