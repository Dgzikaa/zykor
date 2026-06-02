import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/**
 * Lista as credenciais do Banco do Brasil (API Pagamentos em Lote) de um bar.
 * Espelha /api/financeiro/inter/credenciais. NÃO retorna client_secret/gw-dev-app-key.
 */
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
      .select('id, empresa_nome, empresa_cnpj, ambiente, configuracoes')
      .eq('bar_id', barId)
      .in('sistema', ['bb', 'banco_brasil'])
      .eq('ativo', true)
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const credenciais = (data || []).map((row: any) => ({
      id: row.id,
      nome: row.empresa_nome || `BB #${row.id}`,
      cnpj: row.empresa_cnpj || null,
      ambiente: row.ambiente || 'producao',
      numero_convenio: row.configuracoes?.numero_convenio || null,
      agencia: row.configuracoes?.agencia || null,
      conta: row.configuracoes?.conta || null,
    }));

    return NextResponse.json({ success: true, credenciais, total: credenciais.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
