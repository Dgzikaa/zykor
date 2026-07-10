/**
 * Central de Chamados — constantes compartilhadas (API + UI).
 *
 * O suporte é UM usuário (o dono do produto). Ele vê a fila inteira; os demais só os
 * próprios chamados. Identificado por email pra não depender de role/bar.
 */
export const SUPPORT_EMAIL = 'rodrigo@grupomenosemais.com.br';

export function isSuporte(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === SUPPORT_EMAIL;
}

export type ChamadoStatus = 'aberto' | 'em_andamento' | 'aguardando' | 'resolvido' | 'fechado';
export type ChamadoCategoria = 'acesso' | 'conta_dado' | 'dado_faltando' | 'layout' | 'bug' | 'outro';
export type ChamadoPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export type AutorTipo = 'solicitante' | 'suporte';

export const CATEGORIAS: Record<ChamadoCategoria, { label: string; emoji: string }> = {
  acesso: { label: 'Acesso / permissão', emoji: '🔒' },
  conta_dado: { label: 'Conta / dado errado', emoji: '✏️' },
  dado_faltando: { label: 'Dado faltando', emoji: '🕳️' },
  layout: { label: 'Layout / tela', emoji: '🎨' },
  bug: { label: 'Bug / erro', emoji: '🐞' },
  outro: { label: 'Outro', emoji: '💬' },
};

// status "abertos" = ainda na fila (contam como pendentes); resolvido/fechado saem da fila
export const STATUS: Record<ChamadoStatus, { label: string; cor: string; aberto: boolean }> = {
  aberto:       { label: 'Aberto',        cor: 'blue',   aberto: true },
  em_andamento: { label: 'Em andamento',  cor: 'amber',  aberto: true },
  aguardando:   { label: 'Aguardando você', cor: 'purple', aberto: true },
  resolvido:    { label: 'Resolvido',     cor: 'emerald', aberto: false },
  fechado:      { label: 'Fechado',       cor: 'gray',   aberto: false },
};

export const PRIORIDADES: Record<ChamadoPrioridade, { label: string; cor: string; peso: number }> = {
  baixa:   { label: 'Baixa',   cor: 'gray',   peso: 0 },
  normal:  { label: 'Normal',  cor: 'blue',   peso: 1 },
  alta:    { label: 'Alta',    cor: 'amber',  peso: 2 },
  urgente: { label: 'Urgente', cor: 'red',    peso: 3 },
};

export const CATEGORIA_KEYS = Object.keys(CATEGORIAS) as ChamadoCategoria[];
export const STATUS_KEYS = Object.keys(STATUS) as ChamadoStatus[];
export const PRIORIDADE_KEYS = Object.keys(PRIORIDADES) as ChamadoPrioridade[];

export const catLabel = (c: string) => CATEGORIAS[c as ChamadoCategoria]?.label ?? c;
export const statusLabel = (s: string) => STATUS[s as ChamadoStatus]?.label ?? s;
export const prioridadeLabel = (p: string) => PRIORIDADES[p as ChamadoPrioridade]?.label ?? p;
