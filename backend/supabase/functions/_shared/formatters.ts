/**
 * 🎨 Formatters - Formatação de Valores
 * 
 * Módulo compartilhado para formatação de valores monetários,
 * percentuais, datas, e outros formatos comuns.
 */

/**
 * Formatar valor monetário (R$)
 */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return 'R$ 0,00';
  }
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

/**
 * Formatar valor monetário compacto (R$ 1,2K, R$ 1,5M)
 */
export function formatarMoedaCompacta(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return 'R$ 0';
  }
  
  if (Math.abs(valor) >= 1000000) {
    return `R$ ${(valor / 1000000).toFixed(1)}M`;
  }
  
  if (Math.abs(valor) >= 1000) {
    return `R$ ${(valor / 1000).toFixed(1)}K`;
  }
  
  return formatarMoeda(valor);
}

/**
 * Formatar percentual
 */
export function formatarPercentual(
  valor: number | null | undefined,
  decimais: number = 1
): string {
  if (valor === null || valor === undefined) {
    return '0%';
  }
  
  return `${valor.toFixed(decimais)}%`;
}

/**
 * Formatar número inteiro
 */
export function formatarNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '0';
  }
  
  return new Intl.NumberFormat('pt-BR').format(Math.round(valor));
}

/**
 * Formatar número decimal
 */
export function formatarDecimal(
  valor: number | null | undefined,
  decimais: number = 2
): string {
  if (valor === null || valor === undefined) {
    return '0';
  }
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  }).format(valor);
}

/**
 * Formatar data (DD/MM/YYYY)
 */
export function formatarData(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data + 'T00:00:00') : data;
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Formatar data com hora (DD/MM/YYYY HH:MM)
 */
export function formatarDataHora(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Formatar data por extenso (1 de janeiro de 2026)
 */
export function formatarDataExtenso(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data + 'T00:00:00') : data;
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Formatar dia da semana (Segunda-feira)
 */
export function formatarDiaSemana(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data + 'T00:00:00') : data;
  
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
  }).format(d);
}

/**
 * Formatar dia da semana curto (Seg)
 */
export function formatarDiaSemanaCurto(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data + 'T00:00:00') : data;
  
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
  }).format(d);
}

/**
 * Formatar variação (+15%, -8%)
 */
export function formatarVariacao(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '0%';
  }
  
  const sinal = valor >= 0 ? '+' : '';
  return `${sinal}${valor.toFixed(1)}%`;
}

/**
 * Formatar variação com emoji (📈 +15%, 📉 -8%)
 */
export function formatarVariacaoEmoji(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '➖ 0%';
  }
  
  const emoji = valor > 0 ? '📈' : valor < 0 ? '📉' : '➖';
  const sinal = valor > 0 ? '+' : '';
  return `${emoji} ${sinal}${valor.toFixed(1)}%`;
}

/**
 * Formatar duração (1h 30min, 45min, 2h)
 */
export function formatarDuracao(minutos: number): string {
  if (minutos < 60) {
    return `${minutos}min`;
  }
  
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  
  if (mins === 0) {
    return `${horas}h`;
  }
  
  return `${horas}h ${mins}min`;
}

/**
 * Formatar tamanho de arquivo (1,5 MB, 500 KB)
 */
export function formatarTamanhoArquivo(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Capitalizar primeira letra
 */
export function capitalize(texto: string): string {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

/**
 * Capitalizar todas as palavras
 */
export function capitalizeWords(texto: string): string {
  if (!texto) return '';
  return texto
    .split(' ')
    .map(palavra => capitalize(palavra))
    .join(' ');
}

/**
 * Truncar texto com reticências
 */
export function truncar(texto: string, maxLength: number): string {
  if (texto.length <= maxLength) {
    return texto;
  }
  return texto.substring(0, maxLength - 3) + '...';
}

/**
 * Pluralizar palavra (1 evento, 2 eventos)
 */
export function pluralizar(
  quantidade: number,
  singular: string,
  plural?: string
): string {
  if (quantidade === 1) {
    return `${quantidade} ${singular}`;
  }
  return `${quantidade} ${plural || singular + 's'}`;
}

/**
 * Formatar lista com vírgulas e "e" (item1, item2 e item3)
 */
export function formatarLista(itens: string[]): string {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0];
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`;
  
  const ultimoItem = itens[itens.length - 1];
  const outrosItens = itens.slice(0, -1).join(', ');
  
  return `${outrosItens} e ${ultimoItem}`;
}

/**
 * Remover acentos de texto
 */
export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Criar slug (texto-sem-espacos-e-acentos)
 */
export function criarSlug(texto: string): string {
  return removerAcentos(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
