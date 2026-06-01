import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Status (não-sensível) da credencial Inter de um bar.
 * NUNCA retorna client_secret/cert/key — esses só existem cifrados e só são
 * descriptografados server-side no momento do uso (resolveInterCredential).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = Number.parseInt(searchParams.get('bar_id') || '', 10);

    if (!Number.isFinite(barId)) {
      return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('api_credentials')
      .select('id, empresa_nome, empresa_cnpj, configuracoes, ativo')
      .eq('bar_id', barId)
      .in('sistema', ['inter', 'banco_inter'])
      .eq('ativo', true)
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const data_safe = (data || []).map((row: any) => ({
      id: row.id,
      empresa_nome: row.empresa_nome || `Inter #${row.id}`,
      cnpj: row.empresa_cnpj || null,
      conta_corrente: row.configuracoes?.conta_corrente || null,
      // só indicadores — nenhum segredo
      formato: row.configuracoes?.enc ? 'envelope' : 'não-cifrado',
      configurado: !!(row.client_id || row.configuracoes?.enc),
    }));

    if (data_safe.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Credenciais do Inter não encontradas' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: data_safe });
  } catch (error) {
    console.error('❌ Erro ao buscar credenciais:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
