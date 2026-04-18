/**
 * Service: lista notificacoes paginadas com estatisticas.
 */
import { repos } from '@/lib/repositories';
import type { NotificacaoFiltros } from '@/lib/repositories/notificacoes.repo';

export type NotificacaoListItem = {
  id: string;
  usuario_id: string;
  modulo: string;
  tipo: string;
  prioridade: string;
  categoria: string;
  titulo: string;
  mensagem: string;
  dados_extras: Record<string, unknown>;
  acoes: unknown[];
  canais: string[];
  status: string;
  agendada_para: string | null;
  enviada_em: string | null;
  lida_em: string | null;
  criada_em: string;
  bar_id: string;
};

export type EstatisticasNotificacoes = {
  total_semana: number;
  nao_lidas: number;
  alta_prioridade: number;
  por_tipo: Record<string, number>;
  por_modulo: Record<string, number>;
};

export async function listarNotificacoes(
  filtros: NotificacaoFiltros,
  user: { authId: string; role: string }
) {
  const { notificacoes } = await repos();

  const { data, total } = await notificacoes.listar(filtros);
  const stats = await notificacoes.estatisticasUltimos7Dias({
    barId: filtros.barId,
    authId: user.authId,
    role: user.role,
  });

  return {
    notificacoes: transformar(data),
    estatisticas: agregarEstatisticas(stats),
    paginacao: {
      page: filtros.page,
      limit: filtros.limit,
      total,
      total_pages: Math.ceil(total / filtros.limit),
    },
  };
}

// =============== helpers ===============

type RawNotificacao = {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  dados?: Record<string, any>;
  status: string;
  canais: string[];
  agendada_para: string | null;
  enviada_em: string | null;
  lida_em: string | null;
  criada_em: string;
  bar_id: string;
};

function transformar(rows: unknown[]): NotificacaoListItem[] {
  return (rows as RawNotificacao[]).map((n) => {
    const dados = n.dados ?? {};
    return {
      id: n.id,
      usuario_id: n.usuario_id,
      modulo: (dados.modulo as string) ?? 'sistema',
      tipo: n.tipo ?? 'info',
      prioridade: (dados.prioridade as string) ?? 'media',
      categoria: (dados.categoria as string) ?? '',
      titulo: n.titulo ?? 'Notificacao',
      mensagem: n.mensagem ?? '',
      dados_extras: (dados.dados_extras as Record<string, unknown>) ?? {},
      acoes: (dados.acoes as unknown[]) ?? [],
      canais: n.canais ?? ['browser'],
      status: n.status ?? 'pendente',
      agendada_para: n.agendada_para,
      enviada_em: n.enviada_em,
      lida_em: n.lida_em,
      criada_em: n.criada_em,
      bar_id: n.bar_id,
    };
  });
}

function agregarEstatisticas(rows: unknown[]): EstatisticasNotificacoes {
  const arr = rows as Array<{ status: string; tipo: string; dados?: Record<string, any> }>;
  const naoLidas = arr.filter((n) => ['pendente', 'enviada'].includes(n.status)).length;
  const altaPrioridade = arr.filter((n) => {
    const p = n.dados?.prioridade ?? 'media';
    return ['alta', 'critica'].includes(p);
  }).length;
  const porTipo = arr.reduce<Record<string, number>>((acc, n) => {
    acc[n.tipo] = (acc[n.tipo] ?? 0) + 1;
    return acc;
  }, {});
  const porModulo = arr.reduce<Record<string, number>>((acc, n) => {
    const m = n.dados?.modulo ?? 'sistema';
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total_semana: arr.length,
    nao_lidas: naoLidas,
    alta_prioridade: altaPrioridade,
    por_tipo: porTipo,
    por_modulo: porModulo,
  };
}
