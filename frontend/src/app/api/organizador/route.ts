import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser , permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

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
    const semestre = searchParams.get('semestre');
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

    // Buscar organizador por ano e semestre
    if (ano && semestre) {
      const { data: organizador, error } = await supabase
        .from('organizador_visao')
        .select('*')
        .eq('bar_id', barId)
        .eq('ano', parseInt(ano))
        .eq('semestre', parseInt(semestre))
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
      .select('id, bar_id, ano, trimestre, semestre, tipo, missao, tema_semestre, created_at, updated_at')
      .eq('bar_id', barId)
      .order('ano', { ascending: false })
      .order('semestre', { ascending: false, nullsFirst: true })
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
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const neg_request = negarPorRota(user, request); if (neg_request) return neg_request;
  try {
    const body = await request.json();
    const { bar_id, ano, trimestre, semestre, tipo, okrs, ...dados } = body;

    if (!bar_id || !ano) {
      return NextResponse.json(
        { error: 'bar_id e ano são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se já existe o mesmo período. O modelo atual é semestral;
    // trimestre só aparece em registros legados.
    let checagem = supabase
      .from('organizador_visao')
      .select('id')
      .eq('bar_id', bar_id)
      .eq('ano', ano);
    checagem = semestre
      ? checagem.eq('semestre', semestre)
      : checagem.eq('trimestre', trimestre || null);

    const { data: existente } = await checagem.maybeSingle();

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
        semestre: semestre || null,
        tipo: tipo || 'semestral',
        ...dados
      })
      .select()
      .single();

    if (error) throw error;

    // Criar OKRs se fornecidos
    if (okrs && okrs.length > 0) {
      const okrsComOrganizador = okrs.map((okr: any, index: number) => ({
        epico: okr.epico,
        historia: okr.historia,
        responsavel: okr.responsavel,
        observacoes: okr.observacoes,
        andamento: okr.andamento,
        status: okr.status || 'cinza',
        area: okr.area || 'GERAL',
        // is_nsm precisa estar nos DOIS mapeamentos (POST e PUT): aqui o OKR é montado campo a
        // campo, então campo que falta some no save sem erro nenhum.
        is_nsm: !!okr.is_nsm,
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
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const neg_request = negarPorRota(user, request); if (neg_request) return neg_request;
  try {
    const body = await request.json();
    const { id, okrs, bar_id, created_at, updated_at, ...dados } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }
    if (!user.bar_id) {
      return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });
    }

    // O período (ano/semestre) é editável na tela, então vai junto no update.
    // bar_id continua imutável — e o filtro por bar_id do USUÁRIO é o que impede
    // salvar por cima do OVT de outro bar mandando o id na mão.
    // maybeSingle e NÃO single: com `single`, 0 linhas viram erro do PostgREST (406) que caía no
    // catch genérico e devolvia "Erro ao atualizar organizador" — foi assim que um PUT batendo no
    // bar errado passou por "não salva" sem ninguém saber o motivo (20/08/2026).
    const { data: organizador, error } = await supabase
      .from('organizador_visao')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('bar_id', user.bar_id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('PUT organizador — update falhou:', error);
      return NextResponse.json({ error: `Não foi possível salvar: ${error.message}` }, { status: 500 });
    }
    if (!organizador) {
      return NextResponse.json(
        { error: `Este OVT (#${id}) não é do bar selecionado (bar ${user.bar_id}). Troque de bar e tente de novo.` },
        { status: 404 },
      );
    }

    // Atualizar OKRs se fornecidos.
    //
    // Isto é um REPLACE (apaga tudo e reinsere) e o PostgREST não dá transação: se o insert
    // falhasse, o OVT ficava VAZIO — foi o "apertei salvar e apagou tudo" do Gonza (19/08/2026,
    // OVT do Deboche). Agora guardamos os OKRs atuais antes de apagar e, se o insert falhar,
    // repomos o backup e devolvemos erro — o pior caso vira "não salvou", nunca "perdeu tudo".
    if (Array.isArray(okrs)) {
      const linhas = okrs.map((okr: any, index: number) => ({
        epico: okr.epico,
        historia: okr.historia,
        responsavel: okr.responsavel,
        observacoes: okr.observacoes,
        andamento: okr.andamento,
        status: okr.status || 'cinza',
        area: okr.area || 'GERAL',
        // is_nsm precisa estar nos DOIS mapeamentos (POST e PUT): aqui o OKR é montado campo a
        // campo, então campo que falta some no save sem erro nenhum.
        is_nsm: !!okr.is_nsm,
        organizador_id: id,
        ordem: index,
      }));

      const { data: antigos } = await supabase
        .from('organizador_okrs')
        .select('*')
        .eq('organizador_id', id);

      const { error: delErro } = await supabase
        .from('organizador_okrs')
        .delete()
        .eq('organizador_id', id);
      if (delErro) throw delErro;

      if (linhas.length > 0) {
        const { error: okrsError } = await supabase
          .from('organizador_okrs')
          .insert(linhas);

        if (okrsError) {
          if (antigos?.length) {
            await supabase.from('organizador_okrs').insert(antigos);
          }
          console.error('Erro ao gravar OKRs — backup reposto:', okrsError);
          return NextResponse.json(
            { error: 'Não foi possível salvar os OKRs. Nada foi perdido, tente de novo.' },
            { status: 500 },
          );
        }
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
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const neg_request = negarPorRota(user, request); if (neg_request) return neg_request;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    if (!user.bar_id) {
      return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });
    }

    // OKRs são deletados automaticamente pelo CASCADE.
    // O filtro por bar_id do usuário impede apagar o OVT de outro bar mandando o id na mão.
    const { error } = await supabase
      .from('organizador_visao')
      .delete()
      .eq('id', id)
      .eq('bar_id', user.bar_id);

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


















