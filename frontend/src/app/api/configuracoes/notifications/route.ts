import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic'

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const CriarNotificacaoSchema = z.object({
  modulo: z.enum(['checklists', 'metas', 'relatorios', 'dashboard', 'sistema']),
  tipo: z.enum(['info', 'alerta', 'erro', 'sucesso']),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']).default('media'),
  categoria: z.string().optional(),
  titulo: z.string().min(1).max(255),
  mensagem: z.string().min(1),
  dados_extras: z.record(z.string(), z.unknown()).optional(),
  acoes: z
    .array(
      z.object({
        label: z.string(),
        action: z.enum(['redirect', 'callback', 'download']),
        url: z.string().optional(),
        callback: z.string().optional(),
      })
    )
    .optional(),
  canais: z
    .array(z.enum(['browser', 'whatsapp', 'email']))
    .default(['browser']),
  usuario_id: z.string().uuid().optional(),
  role_alvo: z.enum(['admin', 'financeiro', 'funcionario']).optional(),
  enviar_em: z.string().datetime().optional(),
  referencia_tipo: z.string().optional(),
  referencia_id: z.string().uuid().optional(),
  chave_duplicacao: z.string().optional(),
});

const CriarNotificacaoTemplateSchema = z.object({
  template_nome: z.string(),
  template_modulo: z.string(),
  template_categoria: z.string(),
  variaveis: z.record(z.string(), z.unknown()),
  usuario_id: z.string().uuid().optional(),
  role_alvo: z.enum(['admin', 'financeiro', 'funcionario']).optional(),
  enviar_em: z.string().datetime().optional(),
});

const FiltrosSchema = z.object({
  status: z.enum(['pendente', 'enviada', 'lida', 'descartada']).optional(),
  modulo: z.string().optional(),
  tipo: z.string().optional(),
  prioridade: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  usuario_id: z.string().uuid().optional(),
  apenas_nao_lidas: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// =====================================================
// POST - CRIAR NOTIFICAÇÃO
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const modo = searchParams.get('modo'); // 'direta' ou 'template'

    const supabase = await getAdminClient();


    if (!user.bar_id) {
      return NextResponse.json({ error: 'Bar ID não encontrado' }, { status: 400 });
    }
    const barIdStr = user.bar_id.toString();

    if (modo === 'template') {
      // Criar notificação usando template
      const data = CriarNotificacaoTemplateSchema.parse(body);

      const { data: notificacao, error } = await supabase.rpc(
        'criar_notificacao_template',
        {
          p_bar_id: barIdStr,
          p_template_nome: data.template_nome,
          p_template_modulo: data.template_modulo,
          p_template_categoria: data.template_categoria,
          p_variaveis: data.variaveis,
          p_usuario_id: data.usuario_id,
          p_role_alvo: data.role_alvo,
          p_enviar_em: data.enviar_em
            ? new Date(data.enviar_em).toISOString()
            : null,
        }
      );

      if (error) {
        console.error('Erro ao criar notificação via template:', error);
        return NextResponse.json(
          {
            error: 'Erro ao criar notificação via template',
            details: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Notificação criada via template',
        notificacao_id: notificacao,
      });
    } else {
      // Criar notificação direta
      const data = CriarNotificacaoSchema.parse(body);

      // Validar permissões baseadas no módulo
      const permiteAcesso = validarPermissaoModulo(user.role, data.modulo);
      if (!permiteAcesso) {
        return NextResponse.json(
          {
            error: 'Sem permissão para criar notificações neste módulo',
          },
          { status: 403 }
        );
      }

      // Verificar duplicação se especificado
      if (data.chave_duplicacao) {
        const { data: existente } = await supabase
          .schema('system')
          .from('notificacoes')
          .select('id')
          .eq('bar_id', barIdStr)
          .eq('chave_duplicacao', data.chave_duplicacao)
          .eq('status', 'pendente')
          .single();

        if (existente) {
          return NextResponse.json({
            success: true,
            message: 'Notificação já existe (duplicação evitada)',
            notificacao_id: existente.id,
          });
        }
      }

      // Criar notificação
      const novaNotificacao = {
        bar_id: barIdStr,
        usuario_id: data.usuario_id,
        role_alvo: data.role_alvo,
        modulo: data.modulo,
        tipo: data.tipo,
        prioridade: data.prioridade,
        categoria: data.categoria,
        titulo: data.titulo,
        mensagem: data.mensagem,
        dados_extras: data.dados_extras,
        acoes: data.acoes,
        canais: data.canais,
        enviar_em: data.enviar_em
          ? new Date(data.enviar_em).toISOString()
          : new Date().toISOString(),
        referencia_tipo: data.referencia_tipo,
        referencia_id: data.referencia_id,
        chave_duplicacao: data.chave_duplicacao,
        criada_por: user.auth_id,
        status: 'pendente',
      };

      const { data: notificacao, error: createError } = await supabase
        .schema('system')
        .from('notificacoes')
        .insert(novaNotificacao)
        .select()
        .single();

      if (createError) {
        console.error('Erro ao criar notificação:', createError);
        return NextResponse.json(
          {
            error: 'Erro ao criar notificação',
          },
          { status: 500 }
        );
      }

      // Processar envio imediato se necessário
      if (data.canais.includes('browser')) {
        await processarEnvioBrowser(supabase, notificacao);
      }

      return NextResponse.json({
        success: true,
        message: 'Notificação criada com sucesso',
        data: notificacao,
      });
    }
  } catch (error: unknown) {
    console.error('Erro na API de criar notificação:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// GET - LISTAR NOTIFICAÇÕES
// =====================================================
export async function GET(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);
    const filtros: Record<string, string | number | boolean> = {};

    // Converter parâmetros para tipos corretos
    for (const [key, value] of searchParams.entries()) {
      if (key === 'page' || key === 'limit') {
        filtros[key] = parseInt(value);
      } else if (key === 'apenas_nao_lidas') {
        filtros[key] = value === 'true';
      } else {
        filtros[key] = value;
      }
    }

    const data = FiltrosSchema.parse(filtros);

    if (!user.bar_id) {
      return NextResponse.json({ error: 'Bar ID não encontrado' }, { status: 400 });
    }
    const barIdStr = user.bar_id.toString();

    const supabase = await getAdminClient();

    // Construir query base - CORRIGIDO: usar apenas colunas existentes
    let query = supabase
      .schema('system')
      .from('notificacoes')
      .select(
        `
        id,
        usuario_id,
        tipo,
        titulo,
        mensagem,
        dados,
        status,
        canais,
        agendada_para,
        enviada_em,
        lida_em,
        criada_em,
        bar_id
      `
      )
      .eq('bar_id', barIdStr);

    // Filtrar por usuário específico
    if (data.usuario_id) {
      query = query.eq('usuario_id', data.usuario_id);
    } else {
      // Mostrar todas as notificações do bar (temporariamente)
      // query = query.eq('usuario_id', user.auth_id)
    }

    // Aplicar filtros
    if (data.status) {
      query = query.eq('status', data.status);
    }

    if (data.modulo) {
      query = query.eq('dados->modulo', data.modulo);
    }

    if (data.tipo) {
      query = query.eq('tipo', data.tipo);
    }

    if (data.prioridade) {
      query = query.eq('dados->prioridade', data.prioridade);
    }

    if (data.data_inicio) {
      query = query.gte('criada_em', data.data_inicio);
    }

    if (data.data_fim) {
      query = query.lte('criada_em', data.data_fim);
    }

    if (data.apenas_nao_lidas) {
      query = query.in('status', ['pendente', 'enviada']);
    }

    // Buscar total para paginação
    const { count } = await query;

    // Buscar notificações com paginação
    const offset = (data.page - 1) * data.limit;
    const { data: notificacoes, error } = await query
      .order('criada_em', { ascending: false })
      .range(offset, offset + data.limit - 1);

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      return NextResponse.json(
        {
          error: 'Erro ao buscar notificações',
        },
        { status: 500 }
      );
    }

    // Transformar dados para formato esperado pelo frontend
    const notificacoesTransformadas = (notificacoes || []).map(
      (notificacao: NotificacaoData) => {
        const dados = notificacao.dados || {};

        return {
          id: notificacao.id,
          usuario_id: notificacao.usuario_id,
          modulo: dados.modulo || 'sistema',
          tipo: notificacao.tipo || 'info',
          prioridade: dados.prioridade || 'media',
          categoria: dados.categoria || '',
          titulo: notificacao.titulo || 'Notificação',
          mensagem: notificacao.mensagem || '',
          dados_extras: dados.dados_extras || {},
          acoes: dados.acoes || [],
          canais: notificacao.canais || ['browser'],
          status: notificacao.status || 'pendente',
          agendada_para: notificacao.agendada_para,
          enviada_em: notificacao.enviada_em,
          lida_em: notificacao.lida_em,
          criada_em: notificacao.criada_em,
          bar_id: notificacao.bar_id,
        };
      }
    );

    // Calcular estatísticas rápidas
    const estatisticas = await calcularEstatisticasRapidas(
      supabase,
      barIdStr,
      user.auth_id,
      user.role
    );

    return NextResponse.json({
      success: true,
      data: {
        notificacoes: notificacoesTransformadas,
        estatisticas,
        paginacao: {
          page: data.page,
          limit: data.limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / data.limit),
        },
      },
    });
  } catch (error: unknown) {
    console.error('Erro na API de listar notificações:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Parâmetros inválidos',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

function validarPermissaoModulo(role: string, modulo: string): boolean {
  const permissoes: Record<string, string[]> = {
    admin: ['checklists', 'metas', 'relatorios', 'dashboard', 'sistema'],
    financeiro: ['checklists', 'metas', 'relatorios', 'dashboard'],
    funcionario: ['checklists'],
  };

  return permissoes[role]?.includes(modulo) || false;
}

interface NotificacaoData {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  dados?: Record<string, any>;
  status: string;
  canais: string[];
  agendada_para?: string;
  enviada_em?: string;
  lida_em?: string;
  criada_em: string;
  bar_id: string;
}

async function processarEnvioBrowser(
  supabase: any,
  notificacao: NotificacaoData
) {
  try {
    // Marcar como enviada (browser notifications são "instantâneas")
    await supabase
      .schema('system')
      .from('notificacoes')
      .update({
        status: 'enviada',
        enviada_em: new Date().toISOString(),
      })
      .eq('id', notificacao.id);

    // Nota: tabela 'notificacoes_logs' nao existe no banco; log de entrega desabilitado.
  } catch (error: unknown) {
    console.error('Erro ao processar envio browser:', error);
  }
}

async function calcularEstatisticasRapidas(
  supabase: any,
  barId: string,
  userId: string,
  userRole: string
) {
  // Estatísticas para o usuário logado
  const { data: minhasStats } = await supabase
    .schema('system')
    .from('notificacoes')
    .select('status, tipo, dados')
    .eq('bar_id', barId)
    .or(`usuario_id.eq.${userId},dados->role_alvo.eq.${userRole}`)
    .gte(
      'criada_em',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    ); // últimos 7 dias

  if (!minhasStats) {
    return {
      total_semana: 0,
      nao_lidas: 0,
      alta_prioridade: 0,
      por_tipo: {},
      por_modulo: {},
    };
  }

  const naoLidas = minhasStats.filter((n: NotificacaoData) =>
    ['pendente', 'enviada'].includes(n.status)
  ).length;
  const altaPrioridade = minhasStats.filter((n: NotificacaoData) => {
    const prioridade = n.dados?.prioridade || 'media';
    return ['alta', 'critica'].includes(prioridade);
  }).length;

  const porTipo = minhasStats.reduce((acc: Record<string, number>, n: NotificacaoData) => {
    acc[n.tipo] = (acc[n.tipo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const porModulo = minhasStats.reduce((acc: Record<string, number>, n: NotificacaoData) => {
    const modulo = n.dados?.modulo || 'sistema';
    acc[modulo] = (acc[modulo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total_semana: minhasStats.length,
    nao_lidas: naoLidas,
    alta_prioridade: altaPrioridade,
    por_tipo: porTipo,
    por_modulo: porModulo,
  };
}

// =====================================================
// FUNÇÕES ESPECÍFICAS PARA CHECKLISTS
// =====================================================

function getTemplateNameByCategory(categoria: string): string {
  const templates: Record<string, string> = {
    lembrete: 'lembrete_agendamento',
    atraso: 'checklist_atrasado',
    conclusao: 'checklist_concluido',
    performance: 'baixa_performance',
  };

  return templates[categoria] || 'lembrete_agendamento';
}
