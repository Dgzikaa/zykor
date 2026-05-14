import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const sync = searchParams.get('sync') === 'true';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Se não for para sincronizar, retorna do banco — paginando
    if (!sync) {
      const todos: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await (supabase
          .schema('bronze' as any) as any)
          .from('bronze_contaazul_centros_custo')
          .select('*')
          .eq('bar_id', parseInt(barId))
          .order('nome')
          .range(from, from + PAGE - 1);
        if (error) {
          console.error('Erro ao buscar centros de custo do banco:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const arr = (data as any[]) || [];
        todos.push(...arr);
        if (arr.length < PAGE) break;
        from += PAGE;
        if (from > 20000) break;
      }
      return NextResponse.json({ centros_custo: todos });
    }

    // Buscar credenciais do Conta Azul
    const { data: credentials, error: credError } = await supabase
      .from('api_credentials')
      .select('access_token, expires_at')
      .eq('sistema', 'conta_azul')
      .eq('bar_id', parseInt(barId))
      .single();

    if (credError || !credentials?.access_token) {
      return NextResponse.json(
        { error: 'Credenciais do Conta Azul não encontradas' },
        { status: 404 }
      );
    }

    // Verificar se token expirou
    if (credentials.expires_at && new Date(credentials.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Token expirado. Reconecte o Conta Azul.' },
        { status: 401 }
      );
    }

    // Buscar centros de custo da API do Conta Azul (CA v2 usa pagina + tamanho_pagina)
    const url = new URL(`${CONTA_AZUL_API_URL}/v1/centro-de-custo`);
    url.searchParams.set('status', 'TODOS');
    url.searchParams.set('pagina', '1');
    url.searchParams.set('tamanho_pagina', '500');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao buscar centros de custo do Conta Azul:', errorText);
      return NextResponse.json(
        { error: 'Erro ao buscar centros de custo do Conta Azul' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // CA v2 /v1/centro-de-custo retorna { itens_totais, itens } em pt-BR.
    const centros = data.itens || data.content || data.items || [];

    // Sincronizar com banco local (tabela: id, contaazul_id, bar_id, codigo, nome, ativo, created_at, updated_at)
    const centrosParaSalvar = centros.map((centro: any) => ({
      bar_id: parseInt(barId),
      contaazul_id: centro.id || centro.uuid,
      codigo: centro.codigo || null,
      nome: centro.nome || centro.name,
      ativo: centro.ativo !== false && centro.status !== 'INATIVO',
      synced_at: new Date().toISOString(),
    }));

    if (centrosParaSalvar.length > 0) {
      const { error: upsertError } = await supabase
        .schema('bronze' as any)
        .from('bronze_contaazul_centros_custo')
        .upsert(centrosParaSalvar, {
          onConflict: 'bar_id,contaazul_id',
        });

      if (upsertError) {
        console.error('Erro ao salvar centros de custo:', upsertError);
        return NextResponse.json(
          { error: 'Erro ao salvar centros de custo', details: upsertError.message },
          { status: 500 }
        );
      }
    }

    // Soft-delete: marca ativo=false em registros que sumiram do CA
    const idsRecebidos = centrosParaSalvar.map(c => c.contaazul_id).filter(Boolean);
    if (idsRecebidos.length > 0) {
      const { error: deactivateError } = await (supabase
        .schema('bronze' as any) as any)
        .from('bronze_contaazul_centros_custo')
        .update({ ativo: false, synced_at: new Date().toISOString() })
        .eq('bar_id', parseInt(barId))
        .not('contaazul_id', 'in', `(${idsRecebidos.map(id => `"${id}"`).join(',')})`);
      if (deactivateError) {
        console.error('Aviso: erro ao desativar centros removidos (não bloqueante):', deactivateError);
      }
    }

    return NextResponse.json({
      centros_custo: centrosParaSalvar,
      total: centrosParaSalvar.length,
      sincronizado_em: new Date().toISOString()
    });

  } catch (err) {
    console.error('Erro ao buscar centros de custo:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
