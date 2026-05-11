import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const criadoApos = searchParams.get('criado_apos');
    const criadoAntes = searchParams.get('criado_antes');
    const competenciaAntes = searchParams.get('competencia_antes');
    const competenciaApos = searchParams.get('competencia_apos');
    const barId = searchParams.get('bar_id');
    const mesesRetroativos = parseFloat(searchParams.get('meses_retroativos') || '0');
    const categoriasParam = searchParams.get('categorias');
    const categorias = categoriasParam ? categoriasParam.split(',').map(c => c.trim()).filter(Boolean) : [];

    let query = supabase
      .schema('bronze' as any)
      .from('bronze_contaazul_lancamentos')
      .select(`
        contaazul_id, bar_id, tipo, status, status_traduzido,
        descricao, valor_bruto, valor_pago, valor_nao_pago,
        data_competencia, data_vencimento, data_pagamento,
        data_criacao_ca, data_alteracao_ca, synced_at,
        categoria_id, categoria_nome,
        pessoa_id, pessoa_nome,
        numero_parcela, total_parcelas,
        todos_centros_custo
      `)
      .is('excluido_em', null)
      .order('data_criacao_ca', { ascending: false })
      .limit(500);

    if (barId) query = query.eq('bar_id', parseInt(barId));
    if (criadoApos) query = query.gte('data_criacao_ca', criadoApos);
    if (criadoAntes) query = query.lte('data_criacao_ca', criadoAntes);
    if (competenciaAntes) query = query.lte('data_competencia', competenciaAntes);
    if (competenciaApos) query = query.gte('data_competencia', competenciaApos);
    if (categorias.length > 0) query = query.in('categoria_nome', categorias);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const lancamentos = data || [];

    // Filtrar retroativos: data_criacao_ca deve ser >= mesesRetroativos meses depois de data_competencia
    // mesesRetroativos=0 → mostra todos onde criacao > competencia (qualquer retroatividade)
    const limiteMs = mesesRetroativos * 30 * 24 * 60 * 60 * 1000;
    const retroativos = lancamentos.filter(l => {
      if (!l.data_criacao_ca || !l.data_competencia) return false;
      const diffMs = new Date(l.data_criacao_ca).getTime() - new Date(l.data_competencia).getTime();
      // Sempre exige que criação seja depois da competência (retroativo de verdade)
      // Se mesesRetroativos>0, exige diferença mínima específica
      return diffMs > 0 && diffMs >= limiteMs;
    });

    // Estatísticas
    const porCategoria: Record<string, { count: number; valor: number }> = {};
    const porUsuario: Record<string, { count: number; valor: number }> = {};
    let valorTotal = 0;
    let valorPago = 0;
    let totalPagos = 0;

    for (const l of retroativos) {
      const valor = parseFloat(l.valor_bruto) || 0;
      const pago = parseFloat(l.valor_pago) || 0;
      valorTotal += Math.abs(valor);
      valorPago += Math.abs(pago);
      if (l.status === 'PAGO' || l.status === 'LIQUIDADO' || l.status_traduzido === 'Pago') totalPagos++;

      const cat = l.categoria_nome || 'Sem categoria';
      if (!porCategoria[cat]) porCategoria[cat] = { count: 0, valor: 0 };
      porCategoria[cat].count++;
      porCategoria[cat].valor += Math.abs(valor);
    }

    const lancamentosFormatados = retroativos.map(l => ({
      id: l.contaazul_id,
      tipo: l.tipo,
      status: l.status_traduzido || l.status,
      valor: parseFloat(l.valor_bruto) || 0,
      valorPago: parseFloat(l.valor_pago) || 0,
      dataCompetencia: l.data_competencia,
      dataVencimento: l.data_vencimento,
      dataCriacao: l.data_criacao_ca,
      dataAtualizacao: l.data_alteracao_ca,
      criadoPor: null,
      atualizadoPor: null,
      descricao: l.descricao || '',
      referencia: '',
      categoriaId: l.categoria_id,
      categoriaNome: l.categoria_nome,
      categoriaTipo: null,
      stakeholderId: l.pessoa_id,
      stakeholderNome: l.pessoa_nome,
      stakeholderTipo: null,
      centrosCusto: l.todos_centros_custo || [],
      isPaid: ['PAGO', 'LIQUIDADO'].includes(l.status || ''),
      isDued: l.data_vencimento ? new Date(l.data_vencimento) < new Date() : false,
      isFlagged: false,
      hasInstallment: (l.total_parcelas || 1) > 1,
      hasRecurrence: false,
    }));

    return NextResponse.json({
      success: true,
      filtros: {
        criadoApos: criadoApos || '',
        criadoAntes: criadoAntes || null,
        competenciaAntes: competenciaAntes || '',
        competenciaApos: competenciaApos || null,
        barId: barId ? parseInt(barId) : null,
        mesesRetroativos,
        limiteAutoAplicado: false,
      },
      estatisticas: {
        total: retroativos.length,
        totalPagos,
        totalPendentes: retroativos.length - totalPagos,
        valorTotal,
        valorPago,
        valorPendente: valorTotal - valorPago,
        porUsuario,
        porCategoria,
      },
      data: lancamentosFormatados,
      total: retroativos.length,
      paginasConsultadas: 1,
      registrosApiOriginal: lancamentos.length,
    });
  } catch (error: any) {
    console.error('[CONSULTAS-RETROATIVOS] Erro:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno', stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined },
      { status: 500 }
    );
  }
}
