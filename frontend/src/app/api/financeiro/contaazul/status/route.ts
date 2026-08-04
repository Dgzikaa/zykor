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

    const bronzeClient = supabase.schema('bronze' as any);
    // Nota: categorias/centros_custo/contas_financeiras NAO tem coluna 'id' — PK eh contaazul_id (uuid).
    // Usar count head:true com '*' pra evitar dependencia de coluna especifica.
    const [lancamentosCount, categoriasCount, centrosCustoCount, pessoasCount, contasCount] = await Promise.all([
      bronzeClient.from('bronze_contaazul_lancamentos').select('*', { count: 'exact', head: true }).eq('bar_id', parseInt(barId)).is('excluido_em', null),
      bronzeClient.from('bronze_contaazul_categorias').select('*', { count: 'exact', head: true }).eq('bar_id', parseInt(barId)),
      bronzeClient.from('bronze_contaazul_centros_custo').select('*', { count: 'exact', head: true }).eq('bar_id', parseInt(barId)),
      bronzeClient.from('bronze_contaazul_pessoas').select('*', { count: 'exact', head: true }).eq('bar_id', parseInt(barId)),
      bronzeClient.from('bronze_contaazul_contas_financeiras').select('*', { count: 'exact', head: true }).eq('bar_id', parseInt(barId))
    ]);

    // "Último sync" = a última execução que REALMENTE CONCLUIU.
    // Antes pegava o log mais recente por data_inicio e devolvia data_fim: quando esse log estava
    // preso em 'iniciado' (que é comum — 87 dos 182 `alteracao_full_ano` nunca gravam o fim), a
    // data vinha null e a tela exibia "31/12/1969, 21:00" (new Date(null) = epoch em GMT-3), com
    // "0 registros - iniciado" do lado. Parecia integração quebrada quando estava tudo certo.
    const logs = supabase.schema('integrations' as any).from('contaazul_logs_sincronizacao');
    const [{ data: lastLog }, { data: emAndamento }] = await Promise.all([
      logs
        .select('data_fim, status, total_registros')
        .eq('bar_id', parseInt(barId))
        .eq('status', 'success')
        .not('data_fim', 'is', null)
        .order('data_fim', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Um sync em curso (ou preso) é informação útil — só não pode virar o "último sync".
      logs
        .select('data_inicio, tipo_sincronizacao')
        .eq('bar_id', parseInt(barId))
        .eq('status', 'iniciado')
        .order('data_inicio', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // O access_token do CA vive ~2h e é renovado SOB DEMANDA (lib/contaazul/token.ts) — ficar
    // com expires_at no passado é o normal depois de um tempo sem uso, não um defeito. Sem esta
    // flag a tela mostrava "token expirado" em vermelho com o refresh_token são no banco, e o
    // financeiro achava que a integração tinha caído (David, 04/08). Só é problema DE VERDADE
    // quando não há refresh_token: aí precisa reconectar na mão.
    const { data: credCA } = await supabase
      .from('api_credentials')
      .select('refresh_token')
      .eq('bar_id', parseInt(barId))
      .eq('sistema', 'conta_azul')
      .eq('ativo', true)
      .maybeSingle();
    const pode_renovar = !!credCA?.refresh_token;

    return NextResponse.json({
      connected: authData.connected || false,
      has_credentials: authData.has_credentials || false,
      needs_refresh: authData.needs_refresh || false,
      expires_at: authData.expires_at || null,
      pode_renovar,
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
      } : null,
      sync_em_andamento: emAndamento ? {
        iniciado_em: emAndamento.data_inicio,
        tipo: emAndamento.tipo_sincronizacao,
      } : null
    });

  } catch (err) {
    console.error('[status] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}