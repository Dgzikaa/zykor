import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Verificar se um bar tem credenciais configuradas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '0');

    if (!barId) {
      return NextResponse.json({
        success: false,
        error: 'bar_id é obrigatório',
        nibo: false,
        inter: false,
      });
    }

    // NIBO foi substituído pelo Conta Azul - sempre retorna false
    const niboCredencial = null;

    // Verificar credencial Inter
    const { data: interCredencial } = await supabase
      .from('api_credentials')
      .select('id, sistema')
      .eq('sistema', 'inter')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .single();

    const resultado = {
      success: true,
      bar_id: barId,
      nibo: false,
      inter: !!interCredencial,
      mensagem: !interCredencial
        ? 'Credencial Inter não configurada'
        : 'Credencial Inter configurada',
    };

    return NextResponse.json(resultado);

  } catch (error) {
    console.error('[VERIFICAR-CREDENCIAIS] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao verificar credenciais',
      nibo: false,
      inter: false,
    });
  }
}
