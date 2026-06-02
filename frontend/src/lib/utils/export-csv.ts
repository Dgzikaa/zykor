/**
 * Exporta uma lista de objetos para CSV e dispara o download no browser.
 * - Separador ';' e BOM UTF-8 -> abre direto no Excel pt-BR (acentos ok).
 * - Reaproveitável pelas telas de clientes (clube, em-queda, no-show, aniversariantes)
 *   para gerar listas e jogar no Umbler/disparo de mensagem.
 *
 * Uso:
 *   exportarCSV('clientes-em-queda', linhas, [
 *     { key: 'nome', label: 'Nome' },
 *     { key: 'telefone', label: 'Telefone' },
 *     { key: 'visitas', label: 'Visitas' },
 *   ]);
 */
export interface ColunaCSV<T> {
  key: keyof T | string;
  label: string;
  /** Formatação opcional do valor da célula (ex.: moeda, data). */
  format?: (value: unknown, row: T) => string | number;
}

function celula(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Escapa aspas e envolve em aspas se tiver ; " quebra de linha.
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportarCSV<T extends Record<string, unknown>>(
  nomeArquivo: string,
  linhas: T[],
  colunas: ColunaCSV<T>[]
): void {
  const header = colunas.map((c) => celula(c.label)).join(';');
  const corpo = linhas
    .map((row) =>
      colunas
        .map((c) => {
          const raw = (row as Record<string, unknown>)[c.key as string];
          const val = c.format ? c.format(raw, row) : raw;
          return celula(val);
        })
        .join(';')
    )
    .join('\r\n');

  const csv = '﻿' + header + '\r\n' + corpo; // BOM p/ Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${nomeArquivo}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
