import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mesParam = searchParams.get('mes');
    const mes = mesParam ? parseInt(mesParam) : null;
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());

    console.log(`🎯 API Desempenho V2 (Medalion) - Bar: ${user.bar_id}, Ano: ${ano}, Mês: ${mes}`);

    const { data: semanasGold, error: goldError } = await supabase
      .schema('gold' as any)
      .from('desempenho')
      .select('*')
      .eq('bar_id', user.bar_id)
      .eq('ano', ano)
      .eq('granularidade', 'semanal')
      .order('numero_semana', { ascending: false });

    if (goldError) {
      console.error('❌ Erro gold.desempenho:', goldError);
      return NextResponse.json({ error: 'Erro ao buscar desempenho' }, { status: 500 });
    }

    const { data: manuais, error: manuaisError } = await supabase
      .schema('meta' as any)
      .from('desempenho_manual')
      .select('*')
      .eq('bar_id', user.bar_id)
      .eq('ano', ano);

    if (manuaisError) {
      console.warn('⚠️ Erro meta.desempenho_manual:', manuaisError);
    }

    const manuaisMap = new Map();
    (manuais || []).forEach((m: any) => {
      manuaisMap.set(m.numero_semana, m);
    });

    const semanasProcessadas = (semanasGold || []).map((semana: any) => {
      const manual = manuaisMap.get(semana.numero_semana) || {};

      return {
        semana: semana.numero_semana,
        periodo: semana.periodo || `S${semana.numero_semana}/${String(ano).slice(-2)}`,

        faturamento_total: semana.faturamento_total ?? 0,
        faturamento_couvert: semana.faturamento_entrada ?? 0,
        faturamento_bar: semana.faturamento_bar ?? 0,
        faturamento_cmovivel: semana.faturamento_cmvivel ?? 0,

        ticket_medio: semana.ticket_medio ?? 0,
        tm_entrada: semana.tm_entrada ?? 0,
        tm_bar: semana.tm_bar ?? 0,
        ticket_medio_contahub: semana.ticket_medio ?? 0,

        cmv_teorico: manual.cmv_teorico ?? 0,
        cmv_global_real: (semana.cmv != null && semana.faturamento_total) ? (semana.cmv / semana.faturamento_total * 100) : 0,
        cmv_limpo: semana.cmv_percentual ?? manual.cmv_limpo ?? 0,
        cmv_limpo_percentual: semana.cmv_percentual ?? manual.cmv_limpo ?? 0,
        cmv_rs: semana.cmv ?? manual.cmv ?? 0,

        cmo: manual.cmo ?? 0,
        cmo_valor: semana.cmo ?? 0,
        cmo_percentual: (semana.cmo != null && semana.faturamento_total) ? (semana.cmo / semana.faturamento_total * 100) : 0,

        atracao_faturamento: semana.atracoes_eventos ?? 0,
        atracao_percentual: semana.custo_atracao_faturamento ?? 0,
        custo_atracao_faturamento: semana.custo_atracao_faturamento ?? 0,

        clientes_atendidos: semana.clientes_atendidos ?? 0,
        clientes_ativos: semana.clientes_ativos ?? 0,
        perc_clientes_novos: semana.perc_clientes_novos ?? 0,

        reservas_totais: semana.reservas_totais_pessoas ?? semana.reservas_totais ?? 0,
        reservas_presentes: semana.reservas_presentes_pessoas ?? semana.reservas_presentes ?? 0,
        mesas_totais: semana.reservas_totais_quantidade ?? semana.mesas_totais ?? 0,
        mesas_presentes: semana.reservas_presentes_quantidade ?? semana.mesas_presentes ?? 0,
        quebra_reservas: semana.reservas_quebra_pct ?? 0,

        avaliacoes_5_google_trip: semana.avaliacoes_5_google_trip ?? 0,
        google_reviews_total: semana.google_reviews_total ?? 0,
        media_avaliacoes_google: semana.media_avaliacoes_google ?? 0,

        nps_digital: semana.nps_digital ?? manual.nps_digital ?? 0,
        nps_digital_respostas: semana.nps_digital_respostas ?? manual.nps_digital_respostas ?? 0,
        nps_salao: semana.nps_salao ?? manual.nps_salao ?? 0,
        nps_salao_respostas: semana.nps_salao_respostas ?? manual.nps_salao_respostas ?? 0,
        nps_reservas: semana.nps_reservas ?? manual.nps_reservas ?? 0,
        nps_reservas_respostas: semana.nps_reservas_respostas ?? manual.nps_reservas_respostas ?? 0,
        nota_felicidade_equipe: semana.nota_felicidade_equipe ?? manual.nota_felicidade_equipe ?? null,
        nps_atendimento: semana.nps_atendimento ?? 0,
        nps_ambiente: semana.nps_ambiente ?? 0,
        nps_drink: semana.nps_drink ?? 0,
        nps_comida: semana.nps_comida ?? 0,
        nps_limpeza: semana.nps_limpeza ?? 0,
        nps_preco: semana.nps_preco ?? 0,
        nps_musica: semana.nps_musica ?? 0,

        stockout_comidas_perc: semana.stockout_comidas_perc ?? manual.stockout_comidas_perc ?? 0,
        stockout_drinks_perc: semana.stockout_drinks_perc ?? manual.stockout_drinks_perc ?? 0,
        stockout_bar_perc: semana.stockout_bar_perc ?? manual.stockout_bar_perc ?? 0,

        perc_bebidas: semana.perc_bebidas ?? manual.perc_bebidas ?? 0,
        perc_drinks: semana.perc_drinks ?? manual.perc_drinks ?? 0,
        perc_comida: semana.perc_comida ?? manual.perc_comida ?? 0,
        perc_happy_hour: semana.perc_happy_hour ?? manual.perc_happy_hour ?? 0,

        tempo_saida_bar: semana.tempo_drinks ?? manual.tempo_saida_bar ?? 0,
        tempo_saida_cozinha: semana.tempo_cozinha ?? manual.tempo_saida_cozinha ?? 0,
        qtde_itens_bar: semana.qtd_drinks_total ?? manual.qtde_itens_bar ?? 0,
        qtde_itens_cozinha: semana.qtd_comida_total ?? manual.qtde_itens_cozinha ?? 0,

        atrasos_bar: semana.atrasao_bar ?? semana.atrasinho_bar ?? manual.atrasos_bar ?? 0,
        atrasos_cozinha: semana.atrasao_cozinha ?? semana.atrasinho_cozinha ?? manual.atrasos_cozinha ?? 0,
        atrasinhos_bar: semana.atrasinho_bar ?? manual.atrasinhos_bar ?? 0,
        atrasinhos_cozinha: semana.atrasinho_cozinha ?? manual.atrasinhos_cozinha ?? 0,
        atraso_bar: semana.atrasao_bar ?? manual.atraso_bar ?? 0,
        atraso_cozinha: semana.atrasao_cozinha ?? manual.atraso_cozinha ?? 0,
        atrasos_bar_perc: semana.atrasos_bar_perc ?? manual.atrasos_bar_perc ?? 0,
        atrasos_cozinha_perc: semana.atrasos_comida_perc ?? manual.atrasos_cozinha_perc ?? 0,
        atrasinhos_bar_perc: manual.atrasinhos_bar_perc ?? 0,
        atrasinhos_cozinha_perc: manual.atrasinhos_cozinha_perc ?? 0,
        atrasos_bar_detalhes: manual.atrasos_bar_detalhes ?? null,
        atrasos_cozinha_detalhes: manual.atrasos_cozinha_detalhes ?? null,
        atrasinhos_detalhes: manual.atrasinhos_detalhes ?? null,

        perc_faturamento_ate_19h: semana.perc_faturamento_ate_19h ?? manual.perc_faturamento_ate_19h ?? 0,
        perc_faturamento_apos_22h: manual.perc_faturamento_apos_22h ?? 0,

        conta_assinada_valor: semana.conta_assinada_valor ?? 0,
        conta_assinada_perc: semana.conta_assinada_perc ?? 0,
        descontos_valor: semana.desconto_total ?? manual.desconto_total ?? 0,
        descontos_perc: semana.desconto_percentual ?? manual.desconto_percentual ?? 0,
        cancelamentos: semana.cancelamentos_total ?? manual.cancelamentos ?? 0,
        cancelamentos_detalhes: manual.cancelamentos_detalhes ?? null,

        qui_sab_dom: semana.qui_sab_dom ?? manual.qui_sab_dom ?? 0,
        ter_qua_qui: semana.ter_qua_qui ?? manual.ter_qua_qui ?? 0,
        sex_sab: semana.sex_sab ?? manual.sex_sab ?? 0,
        couvert_atracoes: semana.couvert_atracoes ?? manual.couvert_atracoes ?? 0,
        atracoes_eventos: semana.atracoes_eventos ?? manual.atracoes_eventos ?? 0,
        venda_balcao: semana.venda_balcao ?? manual.venda_balcao ?? 0,

        o_num_posts: semana.o_num_posts ?? manual.o_num_posts ?? 0,
        o_num_stories: semana.o_num_stories ?? manual.o_num_stories ?? 0,
        o_alcance: semana.o_alcance ?? manual.o_alcance ?? 0,
        o_interacao: semana.o_interacao ?? manual.o_interacao ?? 0,
        o_compartilhamento: semana.o_compartilhamento ?? manual.o_compartilhamento ?? 0,
        o_engajamento: semana.o_engajamento ?? manual.o_engajamento ?? 0,
        o_visu_stories: semana.o_visu_stories ?? manual.o_visu_stories ?? 0,

        m_valor_investido: semana.m_valor_investido ?? manual.m_valor_investido ?? 0,
        m_alcance: semana.m_alcance ?? manual.m_alcance ?? 0,
        m_frequencia: semana.m_frequencia ?? manual.m_frequencia ?? 0,
        m_cpm: semana.m_cpm ?? manual.m_cpm ?? 0,
        m_cliques: semana.m_cliques ?? manual.m_cliques ?? 0,
        m_ctr: semana.m_ctr ?? manual.m_ctr ?? 0,
        m_cpc: semana.m_custo_por_clique ?? manual.m_custo_por_clique ?? 0,
        m_conversas_iniciadas: semana.m_conversas_iniciadas ?? manual.m_conversas_iniciadas ?? 0,

        clientes_total: semana.clientes_atendidos ?? 0,
        eventos_count: 7,
        metas_faturamento: 263000,
        metas_clientes: 2645,
        performance_geral: 0,
        
        meta_faturamento_total: 263000,
        meta_faturamento_couvert: 38000,
        meta_faturamento_bar: 225000,
        meta_ticket_medio_contahub: 103,
        meta_tm_entrada: 15.5,
        meta_tm_bar: 77.5,
        meta_cmv_limpo_percentual: 33,
        meta_cmo_percentual: 20,
        meta_atracao_percentual: 17,
        meta_clientes_atendidos: 2645,
        meta_clientes_ativos: 3000,
        meta_reservas_totais: 800,
        meta_reservas_presentes: 650,
      };
    });

    let semanasFiltradas = semanasProcessadas;
    if (mes !== null) {
      const { data: eventosDoMes } = await supabase
        .from('eventos_base')
        .select('semana')
        .eq('bar_id', user.bar_id)
        .gte('data_evento', `${ano}-${String(mes).padStart(2, '0')}-01`)
        .lte('data_evento', `${ano}-${String(mes).padStart(2, '0')}-31`);
      
      const semanasDoMes = new Set((eventosDoMes || []).map((e: any) => e.semana));
      semanasFiltradas = semanasProcessadas.filter(s => semanasDoMes.has(s.semana));
    }

    const totaisMensais = semanasFiltradas.reduce((acc, s) => ({
      faturamento_total: acc.faturamento_total + (s.faturamento_total || 0),
      clientes_total: acc.clientes_total + (s.clientes_atendidos || 0),
      eventos_total: acc.eventos_total + (s.eventos_count || 0),
      performance_media: acc.performance_media + (s.performance_geral || 0)
    }), { faturamento_total: 0, clientes_total: 0, eventos_total: 0, performance_media: 0 });

    const ticketMedioMensal = totaisMensais.clientes_total > 0 
      ? totaisMensais.faturamento_total / totaisMensais.clientes_total 
      : 0;
    
    const performanceMediaMensal = semanasFiltradas.length > 0 
      ? totaisMensais.performance_media / semanasFiltradas.length 
      : 0;

    console.log(`✅ V2: ${semanasFiltradas.length} semanas retornadas`);

    return NextResponse.json({
      success: true,
      mes,
      ano,
      semanas: semanasFiltradas,
      total_semanas: semanasFiltradas.length,
      totais_mensais: {
        faturamento_total: Math.round(totaisMensais.faturamento_total * 100) / 100,
        clientes_total: totaisMensais.clientes_total,
        ticket_medio: Math.round(ticketMedioMensal * 100) / 100,
        performance_media: Math.round(performanceMediaMensal * 100) / 100,
        eventos_total: totaisMensais.eventos_total
      },
      _metadata: {
        api_version: 'v2',
        fonte: 'gold.desempenho + meta.desempenho_manual',
        arquitetura: 'medalion_puro'
      }
    });

  } catch (error) {
    console.error('❌ Erro API V2:', error);
    return NextResponse.json(
      {
        error: 'Erro interno',
        details: error instanceof Error ? error.message : 'Desconhecido'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...campos } = body;

    if (!id || Object.keys(campos).length === 0) {
      return NextResponse.json(
        { error: 'id e pelo menos um campo são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar bar_id, ano, numero_semana, data_inicio, data_fim do gold.desempenho pelo id
    const barId = parseInt(request.headers.get('x-selected-bar-id') || '') || user.bar_id;

    const { data: goldRow, error: goldError } = await supabase
      .schema('gold' as any)
      .from('desempenho')
      .select('bar_id, ano, numero_semana, data_inicio, data_fim')
      .eq('id', id)
      .single();

    if (goldError || !goldRow) {
      console.error('❌ PUT: registro gold.desempenho não encontrado:', id, goldError);
      return NextResponse.json(
        { error: 'Registro não encontrado em gold.desempenho' },
        { status: 404 }
      );
    }

    // Validar campos condicionais por integracao
    const CAMPO_INTEGRACAO: Record<string, string> = {
      mesas_totais: 'getin',
      mesas_presentes: 'getin',
      reservas_totais: 'getin',
      reservas_presentes: 'getin',
      quebra_reservas: 'getin',
      ticket_medio: 'getin',
    };

    const camposCondicionais = Object.keys(campos).filter(c => CAMPO_INTEGRACAO[c]);
    if (camposCondicionais.length > 0) {
      const integracoes = new Set(camposCondicionais.map(c => CAMPO_INTEGRACAO[c]));
      for (const integ of integracoes) {
        const { data: config } = await supabase
          .schema('operations' as any)
          .from('integracoes_bar')
          .select('modo')
          .eq('bar_id', goldRow.bar_id)
          .eq('integracao', integ)
          .single();

        if (config?.modo?.startsWith('api')) {
          const camposBloqueados = camposCondicionais.filter(c => CAMPO_INTEGRACAO[c] === integ);
          return NextResponse.json(
            { error: `Campos ${camposBloqueados.join(', ')} são automáticos para bar ${goldRow.bar_id} (${integ} = ${config.modo}). Não editável.` },
            { status: 400 }
          );
        }
      }
    }

    console.log(`🟢 PUT Desempenho V2: bar=${goldRow.bar_id}, S${goldRow.numero_semana}/${goldRow.ano}, campos=${Object.keys(campos).join(',')}`);

    // Upsert em meta.desempenho_manual
    const { data: resultado, error: upsertError } = await supabase
      .schema('meta' as any)
      .from('desempenho_manual')
      .upsert(
        {
          bar_id: goldRow.bar_id,
          ano: goldRow.ano,
          numero_semana: goldRow.numero_semana,
          data_inicio: goldRow.data_inicio,
          data_fim: goldRow.data_fim,
          ...campos,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'bar_id,ano,numero_semana' }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('❌ PUT: erro upsert meta.desempenho_manual:', upsertError);
      return NextResponse.json(
        { error: 'Erro ao salvar', details: upsertError.message },
        { status: 500 }
      );
    }

    console.log(`✅ PUT: salvo em meta.desempenho_manual id=${resultado?.id}`);

    return NextResponse.json({
      success: true,
      data: resultado,
      _metadata: { api_version: 'v2', destino: 'meta.desempenho_manual' }
    });

  } catch (error) {
    console.error('❌ Erro PUT V2:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 }
    );
  }
}
