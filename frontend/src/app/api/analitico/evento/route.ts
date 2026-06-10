import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// Campos consumidos de gold.planejamento por evento
const CAMPOS = [
  'id',
  'bar_id',
  'data_evento',
  'dia_semana',
  'semana',
  'nome',
  'artista',
  'genero',
  'nome_evento',
  'm1_r',
  'cl_plan',
  'cl_real',
  'publico_real',
  'publico_real_consolidado',
  'res_tot',
  'res_p',
  'real_r',
  'faturamento_total_consolidado',
  'faturamento_liquido',
  'faturamento_couvert',
  'faturamento_couvert_manual',
  'faturamento_bar',
  'faturamento_bar_manual',
  'faturamento_entrada',
  'te_real',
  'tb_real',
  't_medio',
  'c_art',
  'c_prod',
  'c_artistico_plan',
  'percent_art_fat',
  'percent_b',
  'percent_d',
  'percent_c',
  'percent_happy_hour',
  'percent_stockout',
  'stockout_bebidas_perc',
  'stockout_comidas_perc',
  'stockout_drinks_perc',
  't_coz',
  't_bar',
  'atrasinho_cozinha',
  'atrasinho_bar',
  'atrasao_cozinha',
  'atrasao_bar',
  'cancelamentos',
  'descontos',
  'fat_19h',
  'fat_19h_percent',
  'capacidade_estimada',
  'observacoes',
].join(', ');

const DIAS_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

type Row = Record<string, any>;

// Helpers de extração com fallback (manual sobrescreve calculado quando existe)
const num = (v: any) => (v === null || v === undefined ? 0 : Number(v) || 0);

function faturamentoDe(e: Row): number {
  return num(e.faturamento_total_consolidado) || num(e.real_r);
}
function publicoDe(e: Row): number {
  return (
    num(e.publico_real_consolidado) || num(e.publico_real) || num(e.cl_real)
  );
}
function couvertDe(e: Row): number {
  return num(e.faturamento_couvert_manual) || num(e.faturamento_couvert);
}
function barDe(e: Row): number {
  return num(e.faturamento_bar_manual) || num(e.faturamento_bar);
}
function ticketDe(e: Row): number {
  const t = num(e.t_medio);
  if (t > 0) return t;
  const pub = publicoDe(e);
  return pub > 0 ? faturamentoDe(e) / pub : 0;
}
function custoTotalDe(e: Row): number {
  return num(e.c_art) + num(e.c_prod);
}
function resultadoDe(e: Row): number {
  return faturamentoDe(e) - custoTotalDe(e);
}
function atrasosTotalDe(e: Row): number {
  return num(e.atrasao_cozinha) + num(e.atrasao_bar);
}

// Métricas normalizadas para comparação
function metricas(e: Row) {
  return {
    faturamento: faturamentoDe(e),
    publico: publicoDe(e),
    couvert: couvertDe(e),
    bar: barDe(e),
    ticket: ticketDe(e),
    c_art: num(e.c_art),
    c_prod: num(e.c_prod),
    custo_total: custoTotalDe(e),
    resultado: resultadoDe(e),
    percent_comida: num(e.percent_c),
    percent_bebida: num(e.percent_b),
    percent_drink: num(e.percent_d),
    percent_stockout: num(e.percent_stockout),
    atrasos: atrasosTotalDe(e),
    res_tot: num(e.res_tot),
  };
}

function media(eventos: Row[]) {
  if (!eventos.length) return null;
  const ms = eventos.map(metricas);
  const acc: Record<string, number> = {};
  const keys = Object.keys(ms[0]);
  for (const k of keys) {
    acc[k] = ms.reduce((s, m) => s + (m as any)[k], 0) / ms.length;
  }
  return acc;
}

function pct(atual: number, base: number): number | null {
  if (!base) return null;
  return ((atual - base) / base) * 100;
}

// ---------------------------------------------------------------------------
// Motor de diagnóstico determinístico
// ---------------------------------------------------------------------------
interface Insight {
  tipo: 'positivo' | 'atencao' | 'info';
  dimensao: string;
  titulo: string;
  descricao: string;
  delta_pct?: number | null;
}

function r1(v: number) {
  return Math.round(v * 10) / 10;
}
function moeda(v: number) {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function diagnosticar(evt: Row, base: Record<string, number> | null) {
  const m = metricas(evt);
  const insights: Insight[] = [];
  let veredito: 'bom' | 'regular' | 'ruim' = 'regular';

  if (!base) {
    insights.push({
      tipo: 'info',
      dimensao: 'baseline',
      titulo: 'Sem histórico comparável',
      descricao:
        'Não há eventos anteriores suficientes no mesmo dia da semana para comparar. Indicadores mostrados sem baseline.',
    });
    return { veredito, insights };
  }

  const dFat = pct(m.faturamento, base.faturamento);
  const dPub = pct(m.publico, base.publico);
  const dTicket = pct(m.ticket, base.ticket);
  const dCart = pct(m.c_art, base.c_art);

  // Veredito geral pelo faturamento vs média das últimas 4 mesmas datas
  if (dFat !== null) {
    if (dFat >= 8) veredito = 'bom';
    else if (dFat <= -10) veredito = 'ruim';
    else veredito = 'regular';
  }

  // Faturamento + causa provável (público x ticket)
  if (dFat !== null && Math.abs(dFat) >= 8) {
    let causa = '';
    if (dFat < 0) {
      if (dPub !== null && dPub <= -8 && (dTicket === null || dTicket > -5)) {
        causa = ` Causa provável: ${r1(Math.abs(dPub))}% menos pessoas na casa, com ticket médio estável.`;
      } else if (
        dTicket !== null &&
        dTicket <= -5 &&
        (dPub === null || dPub > -5)
      ) {
        causa = ` Público estável, mas o ticket médio caiu ${r1(Math.abs(dTicket))}%: consumo por pessoa menor.`;
      } else if (dPub !== null && dTicket !== null && dPub < 0 && dTicket < 0) {
        causa = ` Caiu nas duas pontas: ${r1(Math.abs(dPub))}% menos pessoas e ticket ${r1(Math.abs(dTicket))}% menor.`;
      }
    }
    insights.push({
      tipo: dFat >= 0 ? 'positivo' : 'atencao',
      dimensao: 'faturamento',
      titulo:
        dFat >= 0
          ? `Faturamento ${r1(dFat)}% acima da média`
          : `Faturamento ${r1(Math.abs(dFat))}% abaixo da média`,
      descricao: `${moeda(m.faturamento)} vs média de ${moeda(base.faturamento)} das últimas ${'4'} datas.${causa}`,
      delta_pct: dFat,
    });
  }

  // Público
  if (dPub !== null && Math.abs(dPub) >= 10) {
    insights.push({
      tipo: dPub >= 0 ? 'positivo' : 'atencao',
      dimensao: 'publico',
      titulo:
        dPub >= 0
          ? `Público ${r1(dPub)}% acima da média`
          : `Público ${r1(Math.abs(dPub))}% abaixo da média`,
      descricao: `${Math.round(m.publico)} pessoas vs média de ${Math.round(base.publico)}.`,
      delta_pct: dPub,
    });
  }

  // Ticket médio
  if (dTicket !== null && Math.abs(dTicket) >= 8) {
    insights.push({
      tipo: dTicket >= 0 ? 'positivo' : 'atencao',
      dimensao: 'ticket',
      titulo:
        dTicket >= 0
          ? `Ticket médio ${r1(dTicket)}% maior`
          : `Ticket médio ${r1(Math.abs(dTicket))}% menor`,
      descricao: `${moeda(m.ticket)} por pessoa vs média de ${moeda(base.ticket)}.`,
      delta_pct: dTicket,
    });
  }

  // Custo artístico
  if (dCart !== null && m.c_art > 0 && Math.abs(dCart) >= 15) {
    insights.push({
      tipo: dCart > 0 ? 'atencao' : 'info',
      dimensao: 'custo_artistico',
      titulo:
        dCart > 0
          ? `Custo artístico ${r1(dCart)}% acima da média`
          : `Custo artístico ${r1(Math.abs(dCart))}% abaixo da média`,
      descricao: `${moeda(m.c_art)} vs média de ${moeda(base.c_art)} (${moeda(m.c_art - base.c_art)} de diferença).`,
      delta_pct: dCart,
    });
  }

  // % do faturamento gasto com atração
  const percArt = m.faturamento > 0 ? (m.c_art / m.faturamento) * 100 : 0;
  if (percArt >= 20 && m.c_art > 0) {
    insights.push({
      tipo: percArt >= 30 ? 'atencao' : 'info',
      dimensao: 'percent_art_fat',
      titulo: `Atração consumiu ${r1(percArt)}% do faturamento`,
      descricao:
        percArt >= 30
          ? 'Acima do saudável: a atração comeu boa parte da receita do dia.'
          : 'Dentro de uma faixa de atenção. Vale acompanhar o retorno da atração.',
    });
  }

  // Mix — deslocamentos relevantes (em pontos percentuais)
  const dComida = m.percent_comida - base.percent_comida;
  const dDrink = m.percent_drink - base.percent_drink;
  const dBebida = m.percent_bebida - base.percent_bebida;
  if (Math.abs(dComida) >= 5 || Math.abs(dDrink) >= 5 || Math.abs(dBebida) >= 5) {
    const partes: string[] = [];
    if (Math.abs(dComida) >= 5)
      partes.push(`comida ${dComida >= 0 ? '+' : ''}${r1(dComida)}pp`);
    if (Math.abs(dDrink) >= 5)
      partes.push(`drinks ${dDrink >= 0 ? '+' : ''}${r1(dDrink)}pp`);
    if (Math.abs(dBebida) >= 5)
      partes.push(`bebidas ${dBebida >= 0 ? '+' : ''}${r1(dBebida)}pp`);
    insights.push({
      tipo: 'info',
      dimensao: 'mix',
      titulo: 'Mix de consumo mudou',
      descricao: `Em relação à média: ${partes.join(', ')}. Mix do dia: ${r1(m.percent_comida)}% comida / ${r1(m.percent_bebida)}% bebida / ${r1(m.percent_drink)}% drink.`,
    });
  }

  // Stockout
  if (m.percent_stockout >= 15) {
    insights.push({
      tipo: m.percent_stockout >= 25 ? 'atencao' : 'info',
      dimensao: 'stockout',
      titulo: `Stockout de ${r1(m.percent_stockout)}%`,
      descricao: `Produtos em falta podem ter limitado vendas. Bebidas ${r1(num(evt.stockout_bebidas_perc))}%, comidas ${r1(num(evt.stockout_comidas_perc))}%, drinks ${r1(num(evt.stockout_drinks_perc))}%.`,
    });
  }

  // Atrasos
  if (m.atrasos > 0 && base.atrasos >= 0) {
    const dAtraso = pct(m.atrasos, base.atrasos);
    if (m.atrasos >= 5 && (dAtraso === null || dAtraso > 20)) {
      insights.push({
        tipo: 'atencao',
        dimensao: 'atrasos',
        titulo: `${Math.round(m.atrasos)} atrasos no atendimento`,
        descricao: `${num(evt.atrasao_cozinha)} na cozinha e ${num(evt.atrasao_bar)} no bar${
          base.atrasos > 0 ? ` (média histórica ${r1(base.atrasos)}).` : '.'
        } Pode ter pesado na experiência e no NPS.`,
        delta_pct: dAtraso,
      });
    }
  }

  // Resultado do evento (faturamento - custos)
  const dResultado = pct(m.resultado, base.resultado);
  if (dResultado !== null && Math.abs(dResultado) >= 12) {
    insights.push({
      tipo: dResultado >= 0 ? 'positivo' : 'atencao',
      dimensao: 'resultado',
      titulo: `Resultado do evento ${dResultado >= 0 ? r1(dResultado) + '% acima' : r1(Math.abs(dResultado)) + '% abaixo'} da média`,
      descricao: `${moeda(m.resultado)} (faturamento menos custo artístico e de produção) vs média de ${moeda(base.resultado)}.`,
      delta_pct: dResultado,
    });
  }

  if (!insights.length) {
    insights.push({
      tipo: 'info',
      dimensao: 'geral',
      titulo: 'Dia dentro do esperado',
      descricao:
        'Nenhum indicador se desviou de forma relevante da média das últimas 4 datas equivalentes.',
    });
  }

  return { veredito, insights };
}

// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');
    const barIdParam = searchParams.get('bar_id');

    if (!data || !barIdParam) {
      return NextResponse.json(
        { success: false, error: 'data e bar_id são obrigatórios' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    const gold = (supabase as any).schema('gold');

    // Evento selecionado
    const { data: eventoRows, error: eventoErr } = await gold
      .from('planejamento')
      .select(CAMPOS)
      .eq('bar_id', barId)
      .eq('data_evento', data)
      .order('id', { ascending: true });

    if (eventoErr) {
      console.error('❌ Erro ao buscar evento:', eventoErr);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar evento', details: eventoErr.message },
        { status: 500 }
      );
    }

    const evento: Row | null = eventoRows && eventoRows.length ? eventoRows[0] : null;

    if (!evento) {
      return NextResponse.json({
        success: true,
        encontrado: false,
        data_evento: data,
        motivo: 'Nenhum evento encontrado para esta data.',
      });
    }

    // Baseline: últimas 4 datas ativas no mesmo dia da semana, antes do evento
    const { data: baselineRows } = await gold
      .from('planejamento')
      .select(CAMPOS)
      .eq('bar_id', barId)
      .eq('dia_semana', evento.dia_semana)
      .eq('ativo', true)
      .lt('data_evento', data)
      .order('data_evento', { ascending: false })
      .limit(4);

    // Exclui eventos futuros / pré-venda (faturamento simbólico sem público real)
    const baseline: Row[] = (baselineRows || []).filter(
      (e: Row) => faturamentoDe(e) > 0 && publicoDe(e) > 0
    );
    const baseMedia = media(baseline);

    const m = metricas(evento);
    const deltas =
      baseMedia &&
      Object.fromEntries(
        Object.keys(m).map((k) => [
          k,
          pct((m as any)[k], (baseMedia as any)[k]),
        ])
      );

    const { veredito, insights } = diagnosticar(evento, baseMedia);

    const diaLabel = (() => {
      const [y, mo, d] = data.split('-').map(Number);
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return DIAS_SEMANA[dt.getUTCDay()];
    })();

    return NextResponse.json({
      success: true,
      encontrado: true,
      evento: {
        ...evento,
        dia_semana_label: diaLabel,
        // métricas derivadas para conveniência do front
        _faturamento: m.faturamento,
        _publico: m.publico,
        _couvert: m.couvert,
        _bar: m.bar,
        _ticket: m.ticket,
        _custo_total: m.custo_total,
        _resultado: m.resultado,
      },
      metricas: m,
      baseline: {
        n: baseline.length,
        media: baseMedia,
        eventos: baseline.map((e) => ({
          data_evento: e.data_evento,
          nome: e.nome || e.artista || e.nome_evento,
          ...metricas(e),
        })),
      },
      deltas,
      diagnostico: { veredito, insights },
    });
  } catch (error) {
    console.error('❌ Erro na API de evento:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'desconhecido',
      },
      { status: 500 }
    );
  }
}
