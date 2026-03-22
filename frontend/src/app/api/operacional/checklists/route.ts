import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

// ========================================
// ✅ API PARA CHECKLISTS
// ========================================

interface ChecklistSecao {
  id: string;
  nome: string;
  checklist_itens?: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  titulo: string;
  tipo: string;
}

// ========================================
// ✅ GET /api/checklists
// ========================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // Buscar checklists com suas seções e itens
    const { data: checklists, error: checklistsError } = await supabase
      .from('checklists')
      .select(
        `
        id,
        nome,
        descricao,
        tipo,
        setor,
        frequencia,
        prioridade,
        tempo_estimado,
        responsavel_padrao,
        status,
        criado_em,
        atualizado_em,
        criado_por,
        bar_id,
        checklist_secoes!inner(
          id,
          nome,
          checklist_itens(
            id,
            titulo,
            tipo
          )
        )
      `
      )
      .eq('bar_id', 3) // Ordinário Bar
      .order('criado_em', { ascending: false });

    if (checklistsError) {
      // Tabela checklists pode ter sido removida - sistema usa checklist_agendamentos
      if (checklistsError.code === '42P01' || checklistsError.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('❌ Erro ao buscar checklists:', checklistsError);
      return NextResponse.json({ error: 'Erro ao buscar checklists' }, { status: 500 });
    }

    // Transformar dados para o formato esperado pela interface
    const checklistsFormatados =
      checklists?.map(checklist => {
        // Contar total de itens
        const totalItens =
          checklist.checklist_secoes?.reduce(
            (total: number, secao: ChecklistSecao) => {
              return total + (secao.checklist_itens?.length || 0);
            },
            0
          ) || 0;

        return {
          id: checklist.id,
          nome: checklist.nome,
          setor: checklist.setor,
          descricao: checklist.descricao || '',
          tipo: checklist.tipo,
          frequencia: checklist.frequencia,
          tempo_estimado: checklist.tempo_estimado || 30,
          itens_total: totalItens,
          responsavel_padrao: checklist.responsavel_padrao || 'Não definido',
          ativo: checklist.status === 'ativo',
          ultima_edicao: new Date(checklist.atualizado_em)
            .toISOString()
            .split('T')[0],
          criado_por: 'Sistema', // TODO: Buscar nome real do usuário
          usado_recentemente: false, // TODO: Implementar lógica de uso recente
        };
      }) || [];

    return NextResponse.json(checklistsFormatados);
  } catch (error) {
    console.error('💥 Erro na API de checklists:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validação básica
    if (!body.nome || !body.setor || !body.tipo) {
      return NextResponse.json(
        {
          error: 'Campos obrigatórios: nome, setor e tipo',
        },
        { status: 400 }
      );
    }

    // Buscar usuário admin
    const { data: adminUser } = await supabase
      .from('usuarios_bar')
      .select('id')
      .eq('email', 'admin@ordinario.com')
      .single();

    // bar_id pode vir do body ou do header x-selected-bar-id
    let barId = body.bar_id;
    if (!barId) {
      const barIdHeader = req.headers.get('x-selected-bar-id');
      if (barIdHeader) {
        barId = parseInt(barIdHeader, 10) || null;
      }
    }
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const checklistData = {
      nome: body.nome,
      descricao: body.descricao || '',
      tipo: body.tipo,
      setor: body.setor,
      frequencia: body.frequencia || 'diaria',
      tempo_estimado: body.tempo_estimado || 30,
      responsavel_padrao: body.responsavel_padrao || '',
      bar_id: barId,
      criado_por: adminUser?.id || null,
      status: 'ativo',
    };

    const { data: novoChecklist, error } = await supabase
      .from('checklists')
      .insert([checklistData])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar checklist:', error);
      return NextResponse.json(
        {
          error: 'Erro ao criar checklist',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(novoChecklist);
  } catch (error) {
    console.error('💥 Erro ao criar checklist:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
