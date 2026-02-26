import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH - Travar/Destravar simulação
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { simulacao_salva } = body;

    if (typeof simulacao_salva !== 'boolean') {
      return NextResponse.json(
        { error: 'simulacao_salva deve ser boolean' },
        { status: 400 }
      );
    }

    // Pegar user_id do header (se disponível)
    const userId = request.headers.get('x-user-id');
    const userIdInt = userId ? parseInt(userId) : null;

    const updateData: any = {
      simulacao_salva,
      updated_at: new Date().toISOString(),
    };

    // Se estiver travando, registrar quem e quando
    if (simulacao_salva) {
      updateData.travado_em = new Date().toISOString();
      updateData.travado_por = userIdInt;
    } else {
      // Se destravando, limpar campos
      updateData.travado_em = null;
      updateData.travado_por = null;
    }

    const { data, error } = await supabase
      .from('cmo_semanal')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: simulacao_salva ? 'Simulação travada' : 'Simulação destravada',
    });
  } catch (error) {
    console.error('Erro ao atualizar simulação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
