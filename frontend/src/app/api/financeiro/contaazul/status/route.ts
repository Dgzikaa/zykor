import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');

    if (!barId) {
      return NextResponse.json({ error: 'bar_id e obrigatorio' }, { status: 400 });
    }

    const edgeFunctionUrl = supabaseUrl + '/functions/v1/contaazul-auth';
    
    const authResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        action: 'status',
        bar_id: parseInt(barId)
      })
    });

    const authData = await authResponse.json();

    const supabase = getSupabaseAdmin();

    const [lancamentosCount, categoriasCount, centrosCustoCount, pessoasCount, contasCount] = await Promise.all([
      supabase.from('contaazul_lancamentos').select('id', { count: 'exact', head: true }).eq('bar_id', parseInt(barId)),
      supabase.from('contaazul_categorias').select('id', { count: 'exact', head: true }).eq('bar_id', parseInt(barId)),
      supabase.from('contaazul_centros_custo').select('id', { count: 'exact', head: true }).eq('bar_id', parseInt(barId)),
      supabase.from('contaazul_pessoas').select('id', { count: 'exact', head: true }).eq('bar_id', parseInt(barId)),
      supabase.from('contaazul_contas_financeiras').select('id', { count: 'exact', head: true }).eq('bar_id', parseInt(barId))
    ]);

    const { data: lastLog } = await supabase
      .from('contaazul_logs_sincronizacao')
      .select('data_fim, status, total_registros')
      .eq('bar_id', parseInt(barId))
      .order('data_inicio', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      connected: authData.connected || false,
      has_credentials: authData.has_credentials || false,
      needs_refresh: authData.needs_refresh || false,
      expires_at: authData.expires_at || null,
      stats: {
        lancamentos: lancamentosCount.count || 0,
        categorias: categoriasCount.count || 0,
        centros_custo: centrosCustoCount.count || 0,
        pessoas: pessoasCount.count || 0,
        contas_financeiras: contasCount.count || 0
      },
      last_sync: lastLog ? {
        data: lastLog.data_fim,
        status: lastLog.status,
        registros: lastLog.total_registros
      } : null
    });

  } catch (err) {
    console.error('[status] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}