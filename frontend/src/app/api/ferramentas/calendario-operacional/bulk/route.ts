import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * API de Bulk Actions para Calendário Operacional
 * Permite atualizar múltiplos dias de uma vez
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datas, bar_id, status, motivo, observacao, usuario_nome } = body;

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!datas || !Array.isArray(datas) || datas.length === 0) {
      return NextResponse.json(
        { error: 'Datas são obrigatórias (array)' },
        { status: 400 }
      );
    }

    if (!status || !['aberto', 'fechado'].includes(status)) {
      return NextResponse.json(
        { error: 'Status deve ser "aberto" ou "fechado"' },
        { status: 400 }
      );
    }

    const resultados: any[] = [];
    const historico: any[] = [];

    // Processar cada data
    for (const data of datas) {
      // Buscar registro existente
      const { data: registroExistente } = await supabase
        .from('calendario_operacional')
        .select('*')
        .eq('data', data)
        .eq('bar_id', bar_id)
        .maybeSingle();

      // Upsert
      const { data: resultado, error } = await supabase
        .from('calendario_operacional')
        .upsert({
          data,
          bar_id,
          status,
          motivo: motivo || null,
          observacao: observacao || null,
          atualizado_em: new Date().toISOString()
        }, {
          onConflict: 'data,bar_id'
        })
        .select()
        .single();

      if (error) {
        console.error(`Erro ao atualizar ${data}:`, error);
        continue;
      }

      resultados.push(resultado);

      // Registrar no histórico
      historico.push({
        data,
        bar_id,
        status_anterior: registroExistente?.status || null,
        status_novo: status,
        motivo_anterior: registroExistente?.motivo || null,
        motivo_novo: motivo || null,
        observacao_anterior: registroExistente?.observacao || null,
        observacao_novo: observacao || null,
        tipo_acao: registroExistente ? 'bulk_update' : 'create',
        qtd_dias_afetados: datas.length,
        usuario_nome: usuario_nome || 'Sistema'
      });
    }

    // Salvar histórico
    if (historico.length > 0) {
      await supabase
        .from('calendario_historico')
        .insert(historico);
    }

    return NextResponse.json({
      success: true,
      data: resultados,
      message: `${resultados.length} ${resultados.length === 1 ? 'dia atualizado' : 'dias atualizados'} com sucesso`,
      qtd_atualizado: resultados.length,
      qtd_total: datas.length
    });

  } catch (error) {
    console.error('Erro na API de bulk update:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

