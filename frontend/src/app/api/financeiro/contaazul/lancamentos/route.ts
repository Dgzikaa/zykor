import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const tipo = searchParams.get('tipo');
    const status = searchParams.get('status');
    const dataVencimentoDe = searchParams.get('data_vencimento_de');
    const dataVencimentoAte = searchParams.get('data_vencimento_ate');
    const dataCompetenciaDe = searchParams.get('data_competencia_de');
    const dataCompetenciaAte = searchParams.get('data_competencia_ate');
    const categoriaId = searchParams.get('categoria_id');
    const centroCustoId = searchParams.get('centro_custo_id');
    const busca = searchParams.get('busca');
    const sortColumn = searchParams.get('sort_column') || 'data_vencimento';
    const sortDirection = searchParams.get('sort_direction') || 'desc';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const offset = (page - 1) * limit;

    let query = supabase
      .schema('integrations' as any)
      .from('contaazul_lancamentos')
      .select('*', { count: 'exact' })
      .eq('bar_id', parseInt(barId));

    if (tipo) query = query.eq('tipo', tipo);
    if (status) query = query.eq('status', status);
    if (dataVencimentoDe) query = query.gte('data_vencimento', dataVencimentoDe);
    if (dataVencimentoAte) query = query.lte('data_vencimento', dataVencimentoAte);
    if (dataCompetenciaDe) query = query.gte('data_competencia', dataCompetenciaDe);
    if (dataCompetenciaAte) query = query.lte('data_competencia', dataCompetenciaAte);
    if (categoriaId) query = query.eq('categoria_id', categoriaId);
    if (centroCustoId) query = query.eq('centro_custo_id', centroCustoId);
    if (busca) {
      query = query.or(`descricao.ilike.%${busca}%,pessoa_nome.ilike.%${busca}%`);
    }

    query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data: lancamentos, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar lançamentos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const queryTotais = supabase
      .schema('integrations' as any)
      .from('contaazul_lancamentos')
      .select('valor_bruto, valor_pago, status, tipo')
      .eq('bar_id', parseInt(barId));

    if (tipo) queryTotais.eq('tipo', tipo);
    if (status) queryTotais.eq('status', status);
    if (dataVencimentoDe) queryTotais.gte('data_vencimento', dataVencimentoDe);
    if (dataVencimentoAte) queryTotais.lte('data_vencimento', dataVencimentoAte);
    if (dataCompetenciaDe) queryTotais.gte('data_competencia', dataCompetenciaDe);
    if (dataCompetenciaAte) queryTotais.lte('data_competencia', dataCompetenciaAte);
    if (categoriaId) queryTotais.eq('categoria_id', categoriaId);
    if (centroCustoId) queryTotais.eq('centro_custo_id', centroCustoId);
    if (busca) {
      queryTotais.or(`descricao.ilike.%${busca}%,pessoa_nome.ilike.%${busca}%`);
    }

    const { data: todosLancamentos } = await queryTotais;

    const totalizadores = {
      total_bruto: 0,
      total_liquido: 0,
      total_pago: 0,
      valor_pendente: 0,
      count_receitas: 0,
      count_despesas: 0,
    };

    (todosLancamentos || []).forEach((lanc: any) => {
      const valor = parseFloat(lanc.valor_bruto || 0);
      const pago = parseFloat(lanc.valor_pago || 0);
      
      totalizadores.total_bruto += valor;
      totalizadores.total_pago += pago;
      
      if (lanc.tipo === 'RECEITA') {
        totalizadores.count_receitas++;
      } else {
        totalizadores.count_despesas++;
      }
      
      if (lanc.status !== 'ACQUITTED') {
        totalizadores.valor_pendente += (valor - pago);
      }
    });

    return NextResponse.json({
      lancamentos: lancamentos || [],
      total: count || 0,
      page,
      limit,
      totalizadores
    });

  } catch (err) {
    console.error('Erro ao buscar lançamentos:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
