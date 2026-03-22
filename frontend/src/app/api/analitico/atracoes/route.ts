import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function criarExtratorAtracoes(atracoesConhecidas: string[], djsConhecidos: string[]) {
  return function extrairAtracoes(nome: string): { principal: string; dj: string | null; todas: string[] } {
  const todas: string[] = [];
  let principal = '';
  let dj: string | null = null;

    // Extrair atrações conhecidas
    for (const atracao of atracoesConhecidas) {
      if (nome.toLowerCase().includes(atracao.toLowerCase())) {
        todas.push(atracao);
        if (!principal) principal = atracao;
      }
    }

    // Extrair DJ
    for (const djNome of djsConhecidos) {
      if (nome.toLowerCase().includes(djNome.toLowerCase())) {
        dj = djNome;
        break;
      }
    }

  // Se não encontrou atração conhecida, tentar extrair do nome
  if (!principal) {
    // Padrão: "Formato - Atração e Dj X"
    const match = nome.match(/- ([^,]+)/);
    if (match) {
      principal = match[1].replace(/e Dj.*$/i, '').trim();
    } else {
      principal = nome.split(' - ')[0] || nome;
    }
  }

    return { principal, dj, todas };
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id') || '3';
    const periodo = searchParams.get('periodo') || '12'; // meses
    const minShows = parseInt(searchParams.get('min_shows') || '2');

    // Buscar artistas do banco
    const { data: artistasDb } = await supabase
      .from('bar_artistas')
      .select('nome, tipo')
      .eq('bar_id', parseInt(barId))
      .eq('ativo', true);

    const ATRACOES_CONHECIDAS = (artistasDb || [])
      .filter((a: any) => a.tipo !== 'dj')
      .map((a: any) => a.nome);

    const DJS_CONHECIDOS = (artistasDb || [])
      .filter((a: any) => a.tipo === 'dj')
      .map((a: any) => a.nome);

    const extrairAtracoes = criarExtratorAtracoes(ATRACOES_CONHECIDAS, DJS_CONHECIDOS);

    // Calcular data inicial
    const dataInicial = new Date();
    dataInicial.setMonth(dataInicial.getMonth() - parseInt(periodo));
    const dataInicialStr = dataInicial.toISOString().split('T')[0];

    // Buscar eventos com faturamento
    const { data: eventos, error } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, dia_semana, real_r, cl_real, c_art, t_medio, faturamento_bar, faturamento_couvert')
      .eq('bar_id', parseInt(barId))
      .gt('real_r', 1000) // Só dias com operação
      .gte('data_evento', dataInicialStr)
      .order('data_evento', { ascending: false });

    if (error) throw error;

    // Agrupar por atração
    const atracaoMap = new Map<string, {
      nome: string;
      shows: number;
      fat_total: number;
      fat_medio: number;
      publico_total: number;
      publico_medio: number;
      custo_total: number;
      custo_medio: number;
      ticket_medio: number;
      roi: number | null;
      eventos: Array<{
        data: string;
        dia_semana: string;
        faturamento: number;
        publico: number;
        custo: number;
        ticket: number;
      }>;
      tendencia: 'subindo' | 'estavel' | 'caindo';
      ultimo_show: string;
      dias_sem_tocar: number;
    }>();

    for (const evento of eventos || []) {
      const { principal } = extrairAtracoes(evento.nome || '');
      if (!principal || principal === 'Segunda da Resenha') continue; // Pular eventos sem atração identificada

      const existing = atracaoMap.get(principal) || {
        nome: principal,
        shows: 0,
        fat_total: 0,
        fat_medio: 0,
        publico_total: 0,
        publico_medio: 0,
        custo_total: 0,
        custo_medio: 0,
        ticket_medio: 0,
        roi: null,
        eventos: [],
        tendencia: 'estavel' as const,
        ultimo_show: '',
        dias_sem_tocar: 0
      };

      const faturamento = parseFloat(evento.real_r) || 0;
      const publico = evento.cl_real || 0;
      const custo = parseFloat(evento.c_art) || 0;
      const ticket = parseFloat(evento.t_medio) || 0;

      existing.shows++;
      existing.fat_total += faturamento;
      existing.publico_total += publico;
      existing.custo_total += custo;
      existing.eventos.push({
        data: evento.data_evento,
        dia_semana: evento.dia_semana || '',
        faturamento,
        publico,
        custo,
        ticket
      });

      if (!existing.ultimo_show || evento.data_evento > existing.ultimo_show) {
        existing.ultimo_show = evento.data_evento;
      }

      atracaoMap.set(principal, existing);
    }

    // Calcular métricas finais
    const atracoes = Array.from(atracaoMap.values())
      .filter(a => a.shows >= minShows)
      .map(a => {
        a.fat_medio = a.shows > 0 ? a.fat_total / a.shows : 0;
        a.publico_medio = a.shows > 0 ? Math.round(a.publico_total / a.shows) : 0;
        a.custo_medio = a.shows > 0 ? a.custo_total / a.shows : 0;
        a.ticket_medio = a.shows > 0 
          ? a.eventos.reduce((sum, e) => sum + e.ticket, 0) / a.shows 
          : 0;
        
        // Calcular ROI
        if (a.custo_total > 0) {
          a.roi = ((a.fat_total - a.custo_total) / a.custo_total) * 100;
        }

        // Calcular tendência (últimos 3 shows vs anteriores)
        if (a.eventos.length >= 4) {
          const ultimos3 = a.eventos.slice(0, 3).reduce((sum, e) => sum + e.faturamento, 0) / 3;
          const anteriores = a.eventos.slice(3).reduce((sum, e) => sum + e.faturamento, 0) / (a.eventos.length - 3);
          const variacao = ((ultimos3 - anteriores) / anteriores) * 100;
          
          if (variacao > 10) a.tendencia = 'subindo';
          else if (variacao < -10) a.tendencia = 'caindo';
        }

        // Dias sem tocar
        const hoje = new Date();
        const ultimoShow = new Date(a.ultimo_show);
        a.dias_sem_tocar = Math.floor((hoje.getTime() - ultimoShow.getTime()) / (1000 * 60 * 60 * 24));

        return a;
      })
      .sort((a, b) => b.fat_total - a.fat_total);

    // Calcular estatísticas gerais
    const stats = {
      total_atracoes: atracoes.length,
      total_shows: atracoes.reduce((sum, a) => sum + a.shows, 0),
      fat_total: atracoes.reduce((sum, a) => sum + a.fat_total, 0),
      custo_total: atracoes.reduce((sum, a) => sum + a.custo_total, 0),
      roi_medio: atracoes.filter(a => a.roi !== null).length > 0
        ? atracoes.filter(a => a.roi !== null).reduce((sum, a) => sum + (a.roi || 0), 0) / atracoes.filter(a => a.roi !== null).length
        : null,
      top_faturamento: atracoes[0]?.nome || null,
      top_roi: atracoes.filter(a => a.roi !== null).sort((a, b) => (b.roi || 0) - (a.roi || 0))[0]?.nome || null,
      top_publico: atracoes.sort((a, b) => b.publico_medio - a.publico_medio)[0]?.nome || null
    };

    return NextResponse.json({
      success: true,
      data: atracoes,
      stats,
      periodo: {
        inicio: dataInicialStr,
        fim: new Date().toISOString().split('T')[0],
        meses: parseInt(periodo)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar atrações:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar dados de atrações' },
      { status: 500 }
    );
  }
}
