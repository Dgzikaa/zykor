import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST - Verificar e criar alertas para CMO acima da meta
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, ano } = body;

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar CMOs acima da meta que ainda não têm alerta
    let query = supabase
      .from('cmo_semanal')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('acima_meta', true)
      .eq('alerta_enviado', false);

    if (ano) {
      query = query.eq('ano', ano);
    }

    const { data: cmosAcimaMeta, error } = await query;

    if (error) throw error;

    const alertasCriados: any[] = [];

    // Criar alerta para cada CMO acima da meta
    for (const cmo of cmosAcimaMeta || []) {
      const diferenca = cmo.cmo_total - (cmo.meta_cmo || 0);
      const percentual = cmo.meta_cmo > 0 
        ? ((diferenca / cmo.meta_cmo) * 100).toFixed(1)
        : 0;

      const mensagem = `⚠️ CMO da Semana ${cmo.semana}/${cmo.ano} ultrapassou a meta!\n` +
        `Valor: R$ ${cmo.cmo_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `Meta: R$ ${(cmo.meta_cmo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `Diferença: R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+${percentual}%)`;

      const { data: alerta, error: alertaError } = await supabase
        .from('cmo_alertas')
        .insert({
          cmo_semanal_id: cmo.id,
          bar_id: cmo.bar_id,
          tipo_alerta: 'ACIMA_META',
          mensagem,
          valor_cmo: cmo.cmo_total,
          valor_meta: cmo.meta_cmo,
          diferenca,
          percentual_diferenca: parseFloat(percentual as string),
        })
        .select()
        .single();

      if (!alertaError && alerta) {
        // Marcar como alerta enviado
        await supabase
          .from('cmo_semanal')
          .update({
            alerta_enviado: true,
            alerta_enviado_em: new Date().toISOString(),
          })
          .eq('id', cmo.id);

        alertasCriados.push(alerta);
      }
    }

    return NextResponse.json({
      success: true,
      alertas_criados: alertasCriados.length,
      data: alertasCriados,
    });
  } catch (error) {
    console.error('Erro ao verificar alertas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
