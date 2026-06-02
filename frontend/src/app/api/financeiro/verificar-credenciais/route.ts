import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// GET - Verificar se um bar tem credenciais Inter configuradas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '0');

    if (!barId) {
      return NextResponse.json({
        success: false,
        error: 'bar_id é obrigatório',
        inter: false,
      });
    }

    // Pode haver MAIS DE UMA credencial por bar (ex.: Ordinário tem 2 contas Inter).
    // Por isso NÃO usar .single() — ele falha com múltiplas linhas e dava falso "não configurado".
    const { data: interCredenciais } = await supabase
      .from('api_credentials')
      .select('id')
      .eq('sistema', 'banco_inter')
      .eq('bar_id', barId)
      .eq('ativo', true);

    const temInter = Array.isArray(interCredenciais) && interCredenciais.length > 0;

    return NextResponse.json({
      success: true,
      bar_id: barId,
      inter: temInter,
      mensagem: temInter
        ? 'Credencial Inter configurada'
        : 'Credencial Inter não configurada',
    });

  } catch (error) {
    console.error('[VERIFICAR-CREDENCIAIS] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao verificar credenciais',
      inter: false,
    });
  }
}
