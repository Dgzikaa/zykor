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
    const tipo = searchParams.get('tipo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const dataVencimentoDe = searchParams.get('data_vencimento_de');
    const dataVencimentoAte = searchParams.get('data_vencimento_ate');
    const dataCompetenciaDe = searchParams.get('data_competencia_de');
    const dataCompetenciaAte = searchParams.get('data_competencia_ate');
    const categoria = searchParams.get('categoria');
    const centroCusto = searchParams.get('centro_custo');
    const pessoa = searchParams.get('pessoa');
    const busca = searchParams.get('busca');
    const ordenar = searchParams.get('ordenar') || 'data_vencimento';
    const ordem = searchParams.get('ordem') || 'desc';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id e obrigatorio' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('contaazul_lancamentos')
      .select('*', { count: 'exact' })
      .eq('bar_id', parseInt(barId));

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    if (status) {
      const statusList = status.split(',');
      query = query.in('status', statusList);
    }

    if (dataVencimentoDe) {
      query = query.gte('data_vencimento', dataVencimentoDe);
    }
    if (dataVencimentoAte) {
      query = query.lte('data_vencimento', dataVencimentoAte);
    }

    if (dataCompetenciaDe) {
      query = query.gte('data_competencia', dataCompetenciaDe);
    }
    if (dataCompetenciaAte) {
      query = query.lte('data_competencia', dataCompetenciaAte);
    }

    if (categoria) {
      query = query.eq('categoria_nome', categoria);
    }

    if (centroCusto) {
      query = query.eq('centro_custo_nome', centroCusto);
    }

    if (pessoa) {
      query = query.ilike('pessoa_nome', '%' + pessoa + '%');
    }

    if (busca) {
      query = query.or('descricao.ilike.%' + busca + '%,pessoa_nome.ilike.%' + busca + '%');
    }

    const offset = (page - 1) * limit;
    const ascending = ordem === 'asc';
    
    query = query
      .order(ordenar, { ascending })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[lancamentos] Erro ao buscar:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const lancamentos = data || [];

    let totalizadoresQuery = supabase
      .from('contaazul_lancamentos')
      .select('status, valor_bruto, valor_liquido, valor_pago')
      .eq('bar_id', parseInt(barId));

    if (tipo) {
      totalizadoresQuery = totalizadoresQuery.eq('tipo', tipo);
    }
    if (dataVencimentoDe) {
      totalizadoresQuery = totalizadoresQuery.gte('data_vencimento', dataVencimentoDe);
    }
    if (dataVencimentoAte) {
      totalizadoresQuery = totalizadoresQuery.lte('data_vencimento', dataVencimentoAte);
    }

    const { data: totaisData } = await totalizadoresQuery;

    const totais = (totaisData || []).reduce((acc, item) => {
      acc.total_bruto += parseFloat(item.valor_bruto) || 0;
      acc.total_liquido += parseFloat(item.valor_liquido) || 0;
      acc.total_pago += parseFloat(item.valor_pago) || 0;
      
      const st = (item.status || '').toUpperCase();
      if (st === 'PENDENTE' || st === 'EM_ABERTO') {
        acc.count_pendente += 1;
        acc.valor_pendente += parseFloat(item.valor_bruto) || 0;
      } else if (st === 'QUITADO' || st === 'PAGO' || st === 'RECEBIDO') {
        acc.count_pago += 1;
      } else if (st === 'ATRASADO') {
        acc.count_atrasado += 1;
        acc.valor_atrasado += parseFloat(item.valor_bruto) || 0;
      } else if (st === 'CANCELADO' || st === 'PERDIDO') {
        acc.count_cancelado += 1;
      } else if (st === 'RECEBIDO_PARCIAL') {
        acc.count_parcial += 1;
      }
      
      return acc;
    }, {
      total_bruto: 0,
      total_liquido: 0,
      total_pago: 0,
      valor_pendente: 0,
      valor_atrasado: 0,
      count_pendente: 0,
      count_pago: 0,
      count_atrasado: 0,
      count_cancelado: 0,
      count_parcial: 0
    });

    return NextResponse.json({
      data: lancamentos,
      total: count || 0,
      page,
      limit,
      totalizadores: totais
    });

  } catch (err) {
    console.error('[lancamentos] Erro nao tratado:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}