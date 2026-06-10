import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'const supabase = createServiceRoleClient();

// Limites de tempo para considerar atraso (em segundos)
const LIMITE_ATRASO_COZINHA = 1200; // 20 minutos
const LIMITE_ATRASO_BAR = 600;      // 10 minutos

export async function GET(request: NextRequest) {
  try {
    // Autenticação
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Parâmetros da URL
    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');

    if (!data) {
      return NextResponse.json({ 
        error: 'Data é obrigatória' 
      }, { status: 400 });
    }

    // Buscar dados de tempo de produção (medallion: mesma coluna do calculate_evento_metrics).
    // A tabela NÃO tem t1_t3. cozinha = t0_t2 (Ordinário/bar 3) ou t0_t3 (Deboche); bar/drinks = t0_t3.
    const cozCol = user.bar_id === 3 ? 't0_t2' : 't0_t3';
    const { data: tempoDados, error: tempoError } = await supabase
      .schema('silver' as never)
      .from('tempos_producao')
      .select('categoria, t0_t2, t0_t3')
      .eq('data_producao', data)
      .eq('bar_id', user.bar_id);

    if (tempoError) {
      console.error('❌ Erro ao buscar dados de tempo:', tempoError);
      return NextResponse.json({
        error: 'Erro ao buscar dados de tempo',
        details: tempoError.message
      }, { status: 500 });
    }

    // Calcular atrasos
    const atrasosCozinha = (tempoDados ?? []).filter(
      (item: any) => item.categoria === 'comida' && item[cozCol] != null && parseFloat(item[cozCol]) > LIMITE_ATRASO_COZINHA
    ).length;

    const atrasosBar = (tempoDados ?? []).filter(
      (item: any) => item.categoria === 'drink' && item.t0_t3 != null && parseFloat(item.t0_t3) > LIMITE_ATRASO_BAR
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        atrasos_cozinha: atrasosCozinha,
        atrasos_bar: atrasosBar,
        data_evento: data,
        total_itens: tempoDados?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Erro na API:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

