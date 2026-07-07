import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// mapeia as chaves de criterios_medios (silver.nps_diario) para as categorias da tela
const CRITERIOS: Record<string, string> = {
  atendimento: 'Atendimento',
  comida: 'Cardápio e Comida',
  drink: 'Drinks',
  ambiente: 'Ambiente',
  musica: 'MÚSICA',
  preco: 'Custo benefício',
};

// GET - NPS do período/dia a partir do silver.nps_diario (fonte viva do Falae).
// A antiga tabela `nps` (Google Sheets) parou em 03/2026 e a rota lia public.nps
// (inexistente) → "sem respostas" todo dia. Agora agrega por data_referencia.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const barIdParam = searchParams.get('bar_id');

    if (!barIdParam) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }
    const barId = parseInt(barIdParam);

    let query = (supabase as any)
      .schema('silver')
      .from('nps_diario')
      .select('data_referencia, total_respostas, nps_medio, nps_score, criterios_medios, comentarios_recentes')
      .eq('bar_id', barId)
      .order('data_referencia', { ascending: false });

    if (dataInicio) query = query.gte('data_referencia', dataInicio);
    if (dataFim) query = query.lte('data_referencia', dataFim);

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar NPS (silver.nps_diario):', error);
      return NextResponse.json({ error: 'Erro ao buscar dados NPS' }, { status: 500 });
    }

    const rows: any[] = data || [];
    const respostas = rows.reduce((s, r) => s + (Number(r.total_respostas) || 0), 0);

    // nota geral = média ponderada (0-10) por nº de respostas
    const geral = respostas > 0
      ? rows.reduce((s, r) => s + (Number(r.nps_medio) || 0) * (Number(r.total_respostas) || 0), 0) / respostas
      : null;

    // categorias = média ponderada dos criterios_medios (0-5)
    const acc: Record<string, { soma: number; peso: number }> = {};
    for (const r of rows) {
      const cm = r.criterios_medios || {};
      const peso = Number(r.total_respostas) || 0;
      for (const [key, label] of Object.entries(CRITERIOS)) {
        const v = Number(cm[label]);
        if (!isNaN(v) && v > 0) {
          acc[key] = acc[key] || { soma: 0, peso: 0 };
          acc[key].soma += v * peso;
          acc[key].peso += peso;
        }
      }
    }
    const cat = (k: string) => (acc[k] && acc[k].peso > 0 ? acc[k].soma / acc[k].peso : null);

    // comentários = achata comentarios_recentes de cada dia
    const comentarios = rows.flatMap((r) =>
      (Array.isArray(r.comentarios_recentes) ? r.comentarios_recentes : [])
        .filter((c: any) => c && c.comentario && String(c.comentario).trim())
        .map((c: any) => ({ data: c.data, nota: c.nota, setor: c.source, comentarios: c.comentario })),
    );

    return NextResponse.json({
      success: true,
      nps: respostas > 0
        ? {
            geral,
            respostas,
            atendimento: cat('atendimento'),
            comida: cat('comida'),
            drink: cat('drink'),
            ambiente: cat('ambiente'),
            musica: cat('musica'),
            preco: cat('preco'),
          }
        : null,
      comentarios,
      meta: {
        total_respostas: respostas,
        media_geral: geral != null ? parseFloat(geral.toFixed(2)) : null,
        periodo: { data_inicio: dataInicio, data_fim: dataFim },
      },
    });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Importar dados NPS (da planilha)
export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const body = await request.json();
    const { bar_id, registros } = body;

    if (!bar_id || !registros || !Array.isArray(registros)) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Inserir registros
    const { data, error } = await supabase
      .from('nps')
      .upsert(registros, {
        onConflict: 'bar_id,data_pesquisa,funcionario_nome,setor'
      })
      .select();

    if (error) {
      console.error('Erro ao importar NPS:', error);
      return NextResponse.json(
        { error: 'Erro ao importar dados NPS', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: `${data?.length || 0} registros importados com sucesso`
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}


