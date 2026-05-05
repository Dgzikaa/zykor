import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const sync = searchParams.get('sync') === 'true';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (!sync) {
      const { data, error } = await (supabase
        .schema('integrations' as any) as any)
        .from('contaazul_contas_financeiras')
        .select('*')
        .eq('bar_id', parseInt(barId))
        .eq('ativo', true)
        .order('nome');
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ contas_financeiras: data || [] });
    }

    // Sync com CA
    const { data: credentials, error: credError } = await supabase
      .from('api_credentials')
      .select('access_token, expires_at')
      .eq('sistema', 'conta_azul')
      .eq('bar_id', parseInt(barId))
      .single();

    if (credError || !credentials?.access_token) {
      return NextResponse.json(
        { error: 'Credenciais CA não encontradas' },
        { status: 404 }
      );
    }
    if (credentials.expires_at && new Date(credentials.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token CA expirado' }, { status: 401 });
    }

    const url = new URL(`${CONTA_AZUL_API_URL}/v1/conta-financeira`);
    url.searchParams.set('pagina', '1');
    url.searchParams.set('tamanho_pagina', '500');

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('[CA-CONTAS] erro CA:', resp.status, txt);
      return NextResponse.json(
        { error: 'Erro ao buscar contas financeiras', details: txt },
        { status: resp.status }
      );
    }
    const data = await resp.json();
    const contas = data.itens || data.content || data.items || [];

    const contasParaSalvar = contas.map((c: any) => ({
      bar_id: parseInt(barId),
      contaazul_id: c.id || c.uuid,
      nome: c.nome || c.name,
      tipo: c.tipo || null,
      banco: c.banco || c.codigo_banco || null,
      agencia: c.agencia || null,
      numero: c.numero || c.conta || null,
      ativo: c.ativo !== false && c.status !== 'INATIVO',
      conta_padrao: c.conta_padrao === true || c.padrao === true,
      updated_at: new Date().toISOString(),
    }));

    if (contasParaSalvar.length > 0) {
      const { error: upsertError } = await (supabase
        .schema('integrations' as any) as any)
        .from('contaazul_contas_financeiras')
        .upsert(contasParaSalvar, { onConflict: 'contaazul_id' });
      if (upsertError) {
        console.error('Erro upsert contas:', upsertError);
        return NextResponse.json(
          { error: 'Erro ao salvar contas', details: upsertError.message },
          { status: 500 }
        );
      }
    }

    // Soft-delete: marca ativo=false em contas que sumiram do CA
    const idsRecebidos = contasParaSalvar.map((c: any) => c.contaazul_id).filter(Boolean);
    if (idsRecebidos.length > 0) {
      const { error: deactivateError } = await (supabase
        .schema('integrations' as any) as any)
        .from('contaazul_contas_financeiras')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('bar_id', parseInt(barId))
        .not('contaazul_id', 'in', `(${idsRecebidos.map((id: string) => `"${id}"`).join(',')})`);
      if (deactivateError) {
        console.error('Aviso: erro ao desativar contas removidas:', deactivateError);
      }
    }

    return NextResponse.json({
      contas_financeiras: contasParaSalvar,
      total: contasParaSalvar.length,
      sincronizado_em: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Erro contas-financeiras:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}
