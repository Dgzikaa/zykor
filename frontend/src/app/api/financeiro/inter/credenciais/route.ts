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
    const barId = Number.parseInt(searchParams.get('bar_id') || '', 10);

    if (!Number.isFinite(barId)) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('api_credentials')
      .select('id, empresa_nome, empresa_cnpj, configuracoes')
      .eq('bar_id', barId)
      .in('sistema', ['inter', 'banco_inter'])
      .eq('ativo', true)
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const credenciais = (data || []).map((row: any) => ({
      id: row.id,
      nome: row.empresa_nome || `Inter #${row.id}`,
      cnpj: row.empresa_cnpj || null,
      conta_corrente: row.configuracoes?.conta_corrente || null
    }));

    return NextResponse.json({
      success: true,
      credenciais,
      total: credenciais.length
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
