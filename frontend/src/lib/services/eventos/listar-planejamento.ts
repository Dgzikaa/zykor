/**
 * Service: lista o planejamento comercial de um bar para um mes.
 *
 * E o ponto de entrada da tela /estrategico/planejamento-comercial.
 * Coordena: config do bar, eventos do mes, recalculo, segmentacao de clientes.
 */
import { repos } from '@/lib/repositories';
import { ConfigAusenteError } from '@/lib/errors';
import { barOperaNaData } from '@/lib/domain/bar.rules';
import type {
  EventoBasePlanejamento,
  PlanejamentoComercialItem,
} from '@/lib/domain/evento.types';

export type ListarPlanejamentoInput = {
  barId: number;
  mes: number;
  ano: number;
};

export type ListarPlanejamentoOutput = {
  items: PlanejamentoComercialItem[];
  meta: {
    total_eventos: number;
    periodo: string;
    eventos_recalculados: number;
    estrutura: 'tabela_unica_otimizada';
    ultima_atualizacao: string;
  };
};

export async function listarPlanejamentoComercial(
  input: ListarPlanejamentoInput
): Promise<ListarPlanejamentoOutput> {
  const { eventos, bares } = await repos();

  // Busca config + eventos em paralelo
  const [config, eventosDoMes] = await Promise.all([
    bares.getConfigOperacao(input.barId),
    eventos.listarDoMes(input.barId, input.mes, input.ano),
  ]);

  if (!config) {
    throw new ConfigAusenteError('bares_config', input.barId);
  }

  // Filtra apenas dias em que o bar opera
  const filtrados = eventosDoMes.filter((e) =>
    barOperaNaData(config, e.data_evento)
  );

  if (filtrados.length === 0) {
    return {
      items: [],
      meta: {
        total_eventos: 0,
        periodo: `${input.mes}/${input.ano}`,
        eventos_recalculados: 0,
        estrutura: 'tabela_unica_otimizada',
        ultima_atualizacao: new Date().toISOString(),
      },
    };
  }

  // Dispara recalculo assincrono para eventos pendentes
  const paraRecalcular = filtrados.filter(
    (e) =>
      e.precisa_recalculo &&
      e.versao_calculo !== 999 &&
      (e.real_r === 0 || e.real_r === null)
  );
  for (const e of paraRecalcular) {
    eventos.recalcularMetricas(e.id).catch((err) =>
      console.error(`[planejamento] erro ao recalcular evento ${e.id}:`, err)
    );
  }

  // Enriquece cada evento com metricas de clientes (em paralelo)
  const items = await Promise.all(
    filtrados.map((e) => mapearComMetricasClientes(e, input.barId))
  );

  return {
    items,
    meta: {
      total_eventos: items.length,
      periodo: `${input.mes}/${input.ano}`,
      eventos_recalculados: paraRecalcular.length,
      estrutura: 'tabela_unica_otimizada',
      ultima_atualizacao: new Date().toISOString(),
    },
  };
}

// =============== helpers internos ===============

async function mapearComMetricasClientes(
  e: EventoBasePlanejamento,
  barId: number
): Promise<PlanejamentoComercialItem> {
  const dataEvento = new Date(e.data_evento + 'T00:00:00Z');

  // Metricas de segmentacao (so calcula se houver clientes reais)
  let percClientesNovos: number | null = null;
  let clientesAtivos: number | null = null;

  if ((e.cl_real ?? 0) > 0) {
    try {
      const { eventos } = await repos();
      const dataAnterior = subtrairDias(e.data_evento, 7);
      const data90Atras = subtrairDias(e.data_evento, 90);

      const [metricas, ativos] = await Promise.all([
        eventos.calcularMetricasClientes({
          barId,
          dataAtual: e.data_evento,
          dataAnterior,
        }),
        eventos.contarClientesAtivos({
          barId,
          dataInicio: data90Atras,
          dataFim: e.data_evento,
        }),
      ]);

      if (metricas && metricas[0]) {
        const total = Number(metricas[0].total_atual) || 0;
        const novos = Number(metricas[0].novos_atual) || 0;
        percClientesNovos = total > 0
          ? parseFloat(((novos / total) * 100).toFixed(1))
          : 0;
      }
      clientesAtivos = ativos;
    } catch (err) {
      console.error(`[planejamento] metricas clientes falhou para evento ${e.id}:`, err);
    }
  }

  const realR = e.real_r ?? 0;
  const m1R = e.m1_r ?? 0;
  const clReal = e.cl_real ?? 0;
  const clPlan = e.cl_plan ?? 0;
  const teReal = e.te_real ?? 0;
  const tePlan = e.te_plan ?? 0;
  const tbReal = e.tb_real ?? 0;
  const tbPlan = e.tb_plan ?? 0;
  const tMedio = e.t_medio ?? 0;
  const percentArtFat = Number(e.percent_art_fat) || 0;
  const tCoz = e.t_coz ?? 0;
  const tBar = e.t_bar ?? 0;
  const fat19h = e.fat_19h_percent ?? 0;

  return {
    evento_id: e.id,
    data_evento: e.data_evento,
    dia_semana: e.dia_semana ?? '',
    evento_nome: e.nome ?? '',
    dia: dataEvento.getUTCDate(),
    mes: dataEvento.getUTCMonth() + 1,
    ano: dataEvento.getUTCFullYear(),
    dia_formatado: String(dataEvento.getUTCDate()).padStart(2, '0'),
    data_curta: `${String(dataEvento.getUTCDate()).padStart(2, '0')}/${String(
      dataEvento.getUTCMonth() + 1
    ).padStart(2, '0')}`,

    real_receita: realR,
    m1_receita: m1R,
    faturamento_couvert: e.faturamento_couvert ?? 0,
    couvert_vr_contahub:
      e.couvert_vr_contahub !== null && e.couvert_vr_contahub !== undefined
        ? Number(e.couvert_vr_contahub)
        : null,
    faturamento_couvert_manual: e.faturamento_couvert_manual ?? undefined,
    faturamento_bar_manual: e.faturamento_bar_manual ?? undefined,

    clientes_plan: clPlan,
    clientes_real: clReal,
    res_tot: e.res_tot ?? 0,
    res_p: e.res_p ?? 0,
    lot_max: e.lot_max ?? 0,

    te_plan: tePlan,
    te_real: teReal,
    tb_plan: tbPlan,
    tb_real: tbReal,
    t_medio: tMedio,

    c_art: Number(e.c_art) || 0,
    c_prod: Number(e.c_prod) || 0,
    percent_art_fat: percentArtFat,

    percent_b: e.percent_b ?? 0,
    percent_d: e.percent_d ?? 0,
    percent_c: e.percent_c ?? 0,

    t_coz: tCoz,
    t_bar: tBar,
    fat_19h: fat19h,

    percent_stockout: e.percent_stockout ?? 0,

    percent_clientes_novos: percClientesNovos,
    clientes_ativos: clientesAtivos,

    // Flags de performance
    real_vs_m1_green: realR >= m1R,
    ci_real_vs_plan_green: clReal >= clPlan,
    te_real_vs_plan_green: teReal >= tePlan,
    tb_real_vs_plan_green: tbReal >= tbPlan,
    t_medio_green: tMedio >= 93,
    percent_art_fat_green: percentArtFat <= 15,
    t_coz_green: tCoz <= 12,
    t_bar_green: tBar <= 4,
    fat_19h_green: fat19h >= 40,
  };
}

function subtrairDias(dataIso: string, dias: number): string {
  const d = new Date(dataIso + 'T00:00:00');
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
}
