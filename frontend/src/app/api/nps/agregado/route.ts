import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Função para classificar NPS - Meta: 70 (Verde >= 70, Vermelho < 70)
const classificarNPS = (nps: number | null) => {
  if (nps === null) return 'vermelho';
  if (nps >= 70) return 'verde';
  return 'vermelho';
};

// Buscar comentários das respostas brutas (função auxiliar - RPC buscar_comentarios_nps pode não existir)
async function buscarComentarios(barId: number, campo: string, condicao: string) {
  const { data, error } = await supabase.rpc('buscar_comentarios_nps', {
    p_bar_id: barId,
    p_campo: campo,
    p_condicao: condicao
  });
  if (error) {
    console.warn('buscar_comentarios_nps RPC não disponível:', error.message);
    return [];
  }
  return (data || []) as string[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);
    const tipo = searchParams.get('tipo') || 'semana'; // dia, semana ou mes
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');

    let viewName = 'nps_agregado_semanal'; // padrão
    if (tipo === 'dia') viewName = 'nps_agregado_diario';
    if (tipo === 'mes') viewName = 'nps_agregado_mensal';

    // Buscar dados da VIEW que aplica a fórmula exata da planilha
    let query = supabase
      .from(viewName)
      .select('*')
      .eq('bar_id', barId);

    if (dataInicio) {
      if (tipo === 'dia') {
        query = query.gte('data_pesquisa', dataInicio);
      } else if (tipo === 'semana') {
        query = query.gte('data_inicio', dataInicio);
      } else {
        query = query.gte('data_inicio', dataInicio);
      }
    }

    if (dataFim) {
      if (tipo === 'dia') {
        query = query.lte('data_pesquisa', dataFim);
      } else if (tipo === 'semana') {
        query = query.lte('data_fim', dataFim);
      } else {
        query = query.lte('data_fim', dataFim);
      }
    }

    // Ordenar por data/semana/mês mais recente primeiro
    if (tipo === 'dia') {
      query = query.order('data_pesquisa', { ascending: false });
    } else if (tipo === 'semana') {
      query = query.order('ano', { ascending: false }).order('numero_semana', { ascending: false });
    } else {
      query = query.order('ano', { ascending: false }).order('mes', { ascending: false });
    }

    const { data: agregados, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar NPS agregado:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    if (!agregados || agregados.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        tipo
      });
    }

    // Formatar resultado para o frontend
    const resultado = agregados.map((item: any) => {
      // Separar comentários NPS principal
      const comentariosArray = item.comentarios_array || [];
      const comentariosPositivos = comentariosArray.filter((c: string) => c && c.trim() !== '' && c !== 'Não');
      
      // Comentários de Reservas
      const comentariosReservasArray = item.comentarios_reservas_array || [];
      const comentariosReservas = comentariosReservasArray.filter((c: string) => c && c.trim() !== '');

      const formatarMetrica = (valor: number | null, comentarios: string[] = comentariosPositivos) => ({
        media: valor || 0,
        classificacao: classificarNPS(valor),
        comentarios: comentarios,
        promotores: 0, // TODO: calcular se necessário
        neutros: 0,
        detratores: 0,
        total_avaliacoes: item.total_respostas
      });

      return {
        data: item.data_pesquisa || null,
        semana: tipo === 'semana' ? `Semana ${item.numero_semana}` : null,
        ano: item.ano,
        numero_semana: item.numero_semana || null,
        mes: item.mes || null,
        total_respostas: item.total_respostas,
        nps_geral: formatarMetrica(item.nps_geral),
        nps_ambiente: formatarMetrica(item.nps_ambiente),
        nps_atendimento: formatarMetrica(item.nps_atendimento),
        nps_limpeza: formatarMetrica(item.nps_limpeza),
        nps_musica: formatarMetrica(item.nps_musica),
        nps_comida: formatarMetrica(item.nps_comida),
        nps_drink: formatarMetrica(item.nps_drink),
        nps_preco: formatarMetrica(item.nps_preco),
        nps_reservas: formatarMetrica(item.nps_reservas, comentariosReservas), // Usar comentários específicos de reservas
      };
    });

    return NextResponse.json({
      success: true,
      data: resultado,
      tipo
    });

  } catch (error: any) {
    console.error('❌ Erro na API de NPS:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}

