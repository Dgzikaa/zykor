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
    const tipo = searchParams.get('tipo'); // RECEITA ou DESPESA
    const sync = searchParams.get('sync') === 'true'; // Se true, sincroniza com API

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Se não for para sincronizar, retorna do banco — paginando
    if (!sync) {
      const todas: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let query = (supabase.schema('bronze' as any) as any)
          .from('bronze_contaazul_categorias')
          .select('*')
          .eq('bar_id', parseInt(barId));
        if (tipo) query = query.eq('tipo', tipo);
        const { data, error } = await query.order('nome').range(from, from + PAGE - 1);
        if (error) {
          console.error('Erro ao buscar categorias do banco:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const arr = (data as any[]) || [];
        todas.push(...arr);
        if (arr.length < PAGE) break;
        from += PAGE;
        if (from > 20000) break;
      }
      return NextResponse.json({ categorias: todas });
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

    // Buscar categorias da API do Conta Azul (CA v2 usa params em pt-BR: pagina + tamanho_pagina)
    const url = new URL(`${CONTA_AZUL_API_URL}/v1/categorias`);
    if (tipo) url.searchParams.set('tipo', tipo);
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
      console.error('Erro ao buscar categorias do Conta Azul:', errorText);
      return NextResponse.json(
        { error: 'Erro ao buscar categorias do Conta Azul' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // CA v2 retorna { itens_totais, itens } em pt-BR. Mantemos fallbacks por segurança.
    const categorias = data.itens || data.content || data.items || [];

    // Sincronizar com banco local (tabela tem: id, contaazul_id, bar_id, nome, tipo,
    // categoria_pai_id, apenas_filhos, ativo, categoria_macro, created_at, updated_at)
    const categoriasParaSalvar = categorias.map((cat: any) => ({
      bar_id: parseInt(barId),
      contaazul_id: cat.id || cat.uuid,
      nome: cat.nome || cat.name,
      tipo: cat.tipo || cat.type,
      categoria_pai_id: cat.categoria_pai || cat.categoria_pai_id || null,
      ativo: cat.ativo !== false,
      categoria_macro: cat.categoria_macro || null,
      updated_at: new Date().toISOString(),
    }));

    if (categoriasParaSalvar.length > 0) {
      const { error: upsertError } = await supabase
        .schema('bronze' as any)
        .from('bronze_contaazul_categorias')
        .upsert(categoriasParaSalvar, {
          onConflict: 'contaazul_id',
        });

      if (upsertError) {
        console.error('Erro ao salvar categorias:', upsertError);
        return NextResponse.json(
          { error: 'Erro ao salvar categorias', details: upsertError.message },
          { status: 500 }
        );
      }
    }

    // Soft-delete: marca ativo=false em registros que estão local mas sumiram do CA
    // (excluídos no CA aparecem como ausentes na listagem de retorno)
    const idsRecebidos = categoriasParaSalvar
      .map(c => c.contaazul_id)
      .filter(Boolean);
    if (idsRecebidos.length > 0) {
      const { error: deactivateError } = await (supabase
        .schema('bronze' as any) as any)
        .from('bronze_contaazul_categorias')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('bar_id', parseInt(barId))
        .not('contaazul_id', 'in', `(${idsRecebidos.map(id => `"${id}"`).join(',')})`);
      if (deactivateError) {
        console.error('Aviso: erro ao desativar categorias removidas (não bloqueante):', deactivateError);
      }
    }

    return NextResponse.json({
      categorias: categoriasParaSalvar,
      total: categoriasParaSalvar.length,
      sincronizado_em: new Date().toISOString()
    });

  } catch (err) {
    console.error('Erro ao buscar categorias:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
