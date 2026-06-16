import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// As tabelas organizador_visao / organizador_okrs vivem no schema `meta` (não em
// public). Sem isto o PostgREST procura em public e devolve 500 "does not exist".
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: 'meta' } }
);

// GET - Listar organizadores ou buscar um específico
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ano = searchParams.get('ano');
    const trimestre = searchParams.get('trimestre');
    const id = searchParams.get('id');

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    // Buscar um organizador específico por ID
    if (id) {
      const { data: organizador, error } = await supabase
        .from('organizador_visao')
        .select('*')
        .eq('id', id)
        .eq('bar_id', barId)
        .single();

      if (error) throw error;

      // Buscar OKRs relacionados
      const { data: okrs, error: okrsError } = await supabase
        .from('organizador_okrs')
        .select('*')
        .eq('organizador_id', id)
        .order('ordem', { ascending: true });

      if (okrsError) throw okrsError;

      return NextResponse.json({ organizador, okrs });
    }

    // Buscar organizador por ano e trimestre
    if (ano && trimestre) {
      const { data: organizador, error } = await supabase
        .from('organizador_visao')
        .select('*')
        .eq('bar_id', barId)
        .eq('ano', parseInt(ano))
        .eq('trimestre', parseInt(trimestre))
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

      if (organizador) {
        const { data: okrs } = await supabase
          .from('organizador_okrs')
          .select('*')
          .eq('organizador_id', organizador.id)
          .order('ordem', { ascending: true });

        return NextResponse.json({ organizador, okrs: okrs || [] });
      }

      return NextResponse.json({ organizador: null, okrs: [] });
    }

    // Listar todos os organizadores do bar
    const { data: organizadores, error } = await supabase
      .from('organizador_visao')
      .select('id, bar_id, ano, trimestre, tipo, missao, created_at, updated_at')
      .eq('bar_id', barId)
      .order('ano', { ascending: false })
      .order('trimestre', { ascending: false, nullsFirst: true });

    if (error) throw error;

    return NextResponse.json({ organizadores });

  } catch (error) {
    console.error('Erro ao buscar organizador:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados do organizador' },
      { status: 500 }
    );
  }
}

// POST - Criar novo organizador
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bar_id, ano, trimestre, tipo, okrs, ...dados } = body;

    if (!bar_id || !ano) {
      return NextResponse.json(
        { error: 'bar_id e ano são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se já existe
    const { data: existente } = await supabase
      .from('organizador_visao')
      .select('id')
      .eq('bar_id', bar_id)
      .eq('ano', ano)
      .eq('trimestre', trimestre || null)
      .single();

    if (existente) {
      return NextResponse.json(
        { error: 'Já existe um organizador para este período' },
        { status: 409 }
      );
    }

    // Criar organizador
    const { data: organizador, error } = await supabase
      .from('organizador_visao')
      .insert({
        bar_id,
        ano,
        trimestre: trimestre || null,
        tipo: tipo || 'trimestral',
        ...dados
      })
      .select()
      .single();

    if (error) throw error;

    // Criar OKRs se fornecidos
    if (okrs && okrs.length > 0) {
      const okrsComOrganizador = okrs.map((okr: any, index: number) => ({
        ...okr,
        organizador_id: organizador.id,
        ordem: index
      }));

      const { error: okrsError } = await supabase
        .from('organizador_okrs')
        .insert(okrsComOrganizador);

      if (okrsError) throw okrsError;
    }

    return NextResponse.json({ organizador, success: true });

  } catch (error) {
    console.error('Erro ao criar organizador:', error);
    return NextResponse.json(
      { error: 'Erro ao criar organizador' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar organizador existente
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, okrs, bar_id, ano, trimestre, tipo, created_at, ...dados } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // Atualizar organizador
    const { data: organizador, error } = await supabase
      .from('organizador_visao')
      .update(dados)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Atualizar OKRs se fornecidos
    if (okrs !== undefined) {
      // Remover OKRs antigos
      await supabase
        .from('organizador_okrs')
        .delete()
        .eq('organizador_id', id);

      // Inserir novos
      if (okrs.length > 0) {
        const okrsComOrganizador = okrs.map((okr: any, index: number) => ({
          epico: okr.epico,
          historia: okr.historia,
          responsavel: okr.responsavel,
          observacoes: okr.observacoes,
          status: okr.status || 'cinza',
          organizador_id: id,
          ordem: index
        }));

        const { error: okrsError } = await supabase
          .from('organizador_okrs')
          .insert(okrsComOrganizador);

        if (okrsError) throw okrsError;
      }
    }

    return NextResponse.json({ organizador, success: true });

  } catch (error) {
    console.error('Erro ao atualizar organizador:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar organizador' },
      { status: 500 }
    );
  }
}

// DELETE - Remover organizador
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // OKRs são deletados automaticamente pelo CASCADE
    const { error } = await supabase
      .from('organizador_visao')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro ao deletar organizador:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar organizador' },
      { status: 500 }
    );
  }
}


















