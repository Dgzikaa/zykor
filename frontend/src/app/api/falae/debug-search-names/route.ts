import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Erro ao conectar ao banco' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '', 10);

    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    // Buscar todos os search_names únicos e suas contagens
    const { data: searchNames, error } = await supabase
      .schema('bronze' as any).from('bronze_falae_respostas')
      .select('search_name, created_at, data_visita')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar search_names:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    // Agrupar por search_name
    const grouped = (searchNames || []).reduce((acc: any, row: any) => {
      const name = row.search_name || '(vazio)';
      if (!acc[name]) {
        acc[name] = {
          search_name: name,
          total: 0,
          primeira_resposta: row.created_at,
          ultima_resposta: row.created_at,
          tem_data_visita: 0,
        };
      }
      acc[name].total += 1;
      if (row.created_at < acc[name].primeira_resposta) {
        acc[name].primeira_resposta = row.created_at;
      }
      if (row.created_at > acc[name].ultima_resposta) {
        acc[name].ultima_resposta = row.created_at;
      }
      if (row.data_visita) {
        acc[name].tem_data_visita += 1;
      }
      return acc;
    }, {});

    const result = Object.values(grouped).sort((a: any, b: any) => b.total - a.total);

    // Buscar dados da tabela nps_falae_diario_pesquisa
    const { data: npsDiario, error: npsError } = await supabase
      .from('nps_falae_diario_pesquisa')
      .select('search_name, data_referencia, respostas_total, nps_score')
      .eq('bar_id', barId)
      .gte('data_referencia', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('data_referencia', { ascending: false });

    if (npsError) {
      console.warn('Erro ao buscar nps_falae_diario_pesquisa:', npsError);
    }

    // Agrupar NPS diário por search_name
    const npsPorPesquisa = (npsDiario || []).reduce((acc: any, row: any) => {
      const name = row.search_name || '(vazio)';
      if (!acc[name]) {
        acc[name] = {
          search_name: name,
          dias_com_dados: 0,
          total_respostas: 0,
          ultima_data: row.data_referencia,
        };
      }
      acc[name].dias_com_dados += 1;
      acc[name].total_respostas += row.respostas_total || 0;
      if (row.data_referencia > acc[name].ultima_data) {
        acc[name].ultima_data = row.data_referencia;
      }
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      bar_id: barId,
      falae_respostas: {
        total_respostas: (searchNames || []).length,
        search_names: result,
      },
      nps_falae_diario_pesquisa: {
        search_names: Object.values(npsPorPesquisa),
      },
    });

  } catch (error) {
    console.error('Erro na API de debug search_names:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
