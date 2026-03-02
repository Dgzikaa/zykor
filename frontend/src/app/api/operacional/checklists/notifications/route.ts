import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

// =====================================================
// TIPOS E INTERFACES
// =====================================================

interface ResponsavelWhatsApp {
  nome: string;
  numero: string;
  cargo?: string;
}

interface Agendamento {
  titulo: string;
  responsaveis_whatsapp?: ResponsavelWhatsApp[];
  notificacoes_ativas?: boolean;
}

interface Checklist {
  id: string;
  nome: string;
  setor: string;
  tipo: string;
  checklist_schedules?: Agendamento[];
}

interface Funcionario {
  nome: string;
  email: string;
  telefone?: string;
}

interface ExecucaoChecklist {
  id: string;
  checklist_id: string;
  funcionario_id: string;
  status: string;
  iniciado_em: string;
  prazo_conclusao?: string;
  concluido_em?: string;
  checklist: Checklist;
  funcionario: Funcionario;
  agendamento?: Agendamento;
  respostas?: Record<string, unknown>;
  progresso?: {
    total_itens: number;
    itens_respondidos: number;
    percentual_completo: number;
  };
}

interface DadosNotificacao {
  checklist_execucao_id: string;
  tipo_notificacao: 'completado' | 'atrasado' | 'iniciado' | 'problema';
  destinatarios_customizados?: string[];
  observacoes_extras?: string;
  incluir_fotos: boolean;
  incluir_relatorio: boolean;
}

interface Destinatario {
  nome: string;
  numero: string;
  cargo: string;
}

interface AdminUsuario {
  nome: string;
  telefone: string;
}

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const NotificacaoChecklistSchema = z.object({
  checklist_execucao_id: z.string().uuid('ID da execução inválido'),
  tipo_notificacao: z.enum(['completado', 'atrasado', 'iniciado', 'problema']),
  destinatarios_customizados: z.array(z.string()).optional(),
  observacoes_extras: z.string().optional(),
  incluir_fotos: z.boolean().default(false),
  incluir_relatorio: z.boolean().default(true),
});

// =====================================================
// POST - ENVIAR NOTIFICAÇÃO DE CHECKLIST
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const body = await request.json();
    const data = NotificacaoChecklistSchema.parse(body);

    const supabase = await getAdminClient();

    // Buscar execução do checklist com dados completos
    const { data: execucao, error: execucaoError } = await supabase
      .from('checklist_execucoes')
      .select(
        `
        *,
        checklist:checklists (
          id, nome, setor, tipo,
          checklist_schedules (
            titulo, responsaveis_whatsapp, notificacoes_ativas
          )
        ),
        funcionario:usuarios_bar!funcionario_id (
          nome, email, telefone
        ),
        agendamento:checklist_schedules (
          titulo, responsaveis_whatsapp, notificacoes_ativas
        )
      `
      )
      .eq('id', data.checklist_execucao_id)
      .eq('bar_id', user.bar_id)
      .single();

    if (execucaoError || !execucao) {
      return NextResponse.json(
        { error: 'Execução de checklist não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se notificações estão ativas
    const notificacoesAtivas =
      execucao.agendamento?.notificacoes_ativas ||
      execucao.checklist.checklist_schedules?.[0]?.notificacoes_ativas ||
      true;

    if (!notificacoesAtivas) {
      return NextResponse.json({
        success: true,
        message: 'Notificações desabilitadas para este checklist',
      });
    }

    // Determinar destinatários
    const destinatarios = await determinarDestinatarios(
      supabase,
      execucao,
      data.destinatarios_customizados,
      user.bar_id
    );

    if (destinatarios.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum destinatário configurado',
      });
    }

    // Gerar mensagem personalizada
    const mensagem = await gerarMensagemWhatsApp(
      execucao,
      data as DadosNotificacao
    );

    // Enviar notificações
    const resultados = await enviarNotificacoesWhatsApp(
      supabase,
      destinatarios,
      mensagem,
      execucao,
      data.incluir_relatorio
    );

    // Registrar log da notificação
    await registrarLogNotificacao(supabase, {
      checklist_execucao_id: data.checklist_execucao_id,
      tipo_notificacao: data.tipo_notificacao,
      destinatarios_enviados: resultados.sucessos,
      destinatarios_falha: resultados.falhas,
      mensagem_enviada: mensagem,
      enviado_por: user.auth_id,
      bar_id: user.bar_id,
    } as any);

    console.log(
      `📱 Notificações enviadas para checklist ${execucao.checklist.nome}: ${resultados.sucessos.length} sucessos, ${resultados.falhas.length} falhas`
    );

    return NextResponse.json({
      success: true,
      message: 'Notificações processadas',
      resultados: {
        total_enviados: resultados.sucessos.length,
        total_falhas: resultados.falhas.length,
        destinatarios: destinatarios.map((d: any) => ({
          nome: d.nome,
          numero: d.numero,
        })),
      },
    });
  } catch (error: unknown) {
    console.error('Erro na API de notificações:', error);

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
// GET - HISTÓRICO DE NOTIFICAÇÕES
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get('checklist_id');
    const execucaoId = searchParams.get('execucao_id');
    const tipoNotificacao = searchParams.get('tipo_notificacao');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const supabase = await getAdminClient();

    let query = supabase
      .from('checklist_notification_logs')
      .select(
        `
        *,
        checklist_execucao:checklist_execucoes (
          checklist:checklists (nome, setor)
        ),
        enviado_por_usuario:usuarios_bar!enviado_por (nome, email)
      `
      )
      .eq('bar_id', user.bar_id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Aplicar filtros
    if (checklistId) {
      query = query.eq('checklist_execucao.checklist_id', checklistId);
    }
    if (execucaoId) {
      query = query.eq('checklist_execucao_id', execucaoId);
    }
    if (tipoNotificacao) {
      query = query.eq('tipo_notificacao', tipoNotificacao);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('Erro ao buscar logs de notificação:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar histórico' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: logs || [],
      pagination: { page, limit },
    });
  } catch (error: unknown) {
    console.error('Erro na API de histórico de notificações:', error);
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
// FUNÇÕES AUXILIARES
// =====================================================

async function determinarDestinatarios(
  supabase: SupabaseClient,
  execucao: ExecucaoChecklist,
  customizados?: string[],
  barId?: number
) {
  const destinatarios: Destinatario[] = [];

  // 1. Destinatários do agendamento
  if (execucao.agendamento?.responsaveis_whatsapp) {
    destinatarios.push(
      ...execucao.agendamento.responsaveis_whatsapp.map(r => ({
        nome: r.nome,
        numero: r.numero,
        cargo: r.cargo || 'Responsável',
      }))
    );
  }

  // 2. Destinatários customizados (números diretos)
  if (customizados && customizados.length > 0) {
    customizados.forEach(numero => {
      destinatarios.push({
        nome: 'Destinatário customizado',
        numero: numero,
        cargo: 'N/A',
      });
    });
  }

  // 3. Destinatários padrão do sistema (administradores)
  if (destinatarios.length === 0 && barId) {
    const { data: admins } = await supabase
      .from('usuarios_bar')
      .select('nome, telefone')
      .eq('bar_id', barId)
      .eq('role', 'admin')
      .not('telefone', 'is', null);

    if (admins) {
      admins.forEach((admin: AdminUsuario) => {
        if (admin.telefone) {
          destinatarios.push({
            nome: admin.nome,
            numero: admin.telefone,
            cargo: 'Administrador',
          });
        }
      });
    }
  }

  // Remover duplicatas por número
  const numerosUnicos = new Set();
  return destinatarios.filter(dest => {
    if (numerosUnicos.has(dest.numero)) {
      return false;
    }
    numerosUnicos.add(dest.numero);
    return true;
  });
}

async function gerarMensagemWhatsApp(
  execucao: ExecucaoChecklist,
  dados: DadosNotificacao
) {
  const checklist = execucao.checklist;
  const funcionario = execucao.funcionario;

  // Calcular estatísticas da execução
  const stats = calcularEstatisticasExecucao(execucao);

  const emojis = {
    completado: '✅',
    atrasado: '🚨',
    iniciado: '🚀',
    problema: '⚠️',
  };

  const emoji = emojis[dados.tipo_notificacao as keyof typeof emojis] || '📋';

  let mensagem = `${emoji} *SGB - Checklist ${dados.tipo_notificacao.toUpperCase()}*

📋 *Checklist:* ${checklist.nome}
🏢 *Setor:* ${checklist.setor}
👤 *Executado por:* ${funcionario?.nome || 'N/A'}
⏰ *Data/Hora:* ${new Date(execucao.iniciado_em).toLocaleString('pt-BR')}

📊 *Resultados:*`;

  if (dados.tipo_notificacao === 'completado') {
    mensagem += `
✅ *Status:* Concluído com sucesso
📈 *Progresso:* ${stats.percentual_completo}%
⏱️ *Tempo total:* ${stats.tempo_execucao}
⭐ *Score:* ${stats.score_qualidade}/100`;

    if (stats.problemas_encontrados > 0) {
      mensagem += `
⚠️ *Problemas:* ${stats.problemas_encontrados} item(s) com observações`;
    }
  } else if (
    dados.tipo_notificacao === 'atrasado' &&
    execucao.prazo_conclusao
  ) {
    const horasAtraso = Math.round(
      (new Date().getTime() - new Date(execucao.prazo_conclusao).getTime()) /
        (1000 * 60 * 60)
    );
    mensagem += `
🔥 *Situação:* Atrasado há ${horasAtraso}h
⏰ *Prazo era:* ${new Date(execucao.prazo_conclusao).toLocaleString('pt-BR')}
📈 *Progresso:* ${stats.percentual_completo}%`;
  }

  if (dados.observacoes_extras) {
    mensagem += `

💬 *Observações:*
${dados.observacoes_extras}`;
  }

  mensagem += `

_Sistema de Gestão de Bares_`;

  return mensagem;
}

async function enviarNotificacoesWhatsApp(
  supabase: SupabaseClient,
  destinatarios: Destinatario[],
  mensagem: string,
  execucao: ExecucaoChecklist,
  incluirRelatorio: boolean
) {
  const sucessos: unknown[] = [];
  const falhas: unknown[] = [];

  for (const destinatario of destinatarios) {
    try {
      // Usar a API existente de WhatsApp
      const { data: resultado, error } = await supabase.functions.invoke(
        'whatsapp-send',
        {
          body: {
            to: destinatario.numero,
            message: mensagem,
            type: 'text',
            modulo: 'checklists',
            checklist_id: execucao.checklist_id,
            checklist_execucao_id: execucao.id,
            prioridade: 'alta',
          },
        } as any
      );

      if (error) {
        falhas.push({ destinatario, erro: error.message });
      } else {
        sucessos.push({ destinatario, resultado });

        // Se incluir relatório, enviar link adicional
        if (incluirRelatorio) {
          const linkRelatorio = `${process.env.NEXT_PUBLIC_APP_URL}/relatorios/checklist/${execucao.id}`;
          await supabase.functions.invoke('whatsapp-send', {
            body: {
              to: destinatario.numero,
              message: `📄 *Relatório Completo:* ${linkRelatorio}`,
              type: 'text',
              modulo: 'checklists',
            },
          });
        }
      }
    } catch (error: unknown) {
      falhas.push({
        destinatario,
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }

  return { sucessos, falhas };
}

function calcularEstatisticasExecucao(execucao: ExecucaoChecklist) {
  const respostas = execucao.respostas || {};
  const totalItens = execucao.progresso?.total_itens || 0;
  const itensRespondidos = execucao.progresso?.itens_respondidos || 0;

  const tempoInicio = new Date(execucao.iniciado_em);
  const tempoFim = execucao.concluido_em
    ? new Date(execucao.concluido_em)
    : new Date();
  const tempoExecucao = Math.round(
    (tempoFim.getTime() - tempoInicio.getTime()) / (1000 * 60)
  ); // minutos

  // Calcular score de qualidade baseado nas respostas
  let scoreQualidade = 100;
  let problemasEncontrados = 0;

  if (respostas.secoes) {
    (respostas.secoes as any[]).forEach((secao: any) => {
      (secao.itens as any[])?.forEach((item: any) => {
        if (
          item.tipo === 'sim_nao' &&
          item.valor === 'nao' &&
          item.obrigatorio
        ) {
          scoreQualidade -= 10;
          problemasEncontrados++;
        }
        if (item.observacoes && (item.observacoes as any[]).length > 0) {
          problemasEncontrados++;
        }
      });
    });
  }

  return {
    percentual_completo:
      totalItens > 0 ? Math.round((itensRespondidos / totalItens) * 100) : 0,
    tempo_execucao: `${Math.floor(tempoExecucao / 60)}h ${tempoExecucao % 60}min`,
    score_qualidade: Math.max(scoreQualidade, 0),
    problemas_encontrados: problemasEncontrados,
  };
}

async function registrarLogNotificacao(
  supabase: SupabaseClient,
  dados: unknown
) {
  const { error } = await supabase.from('checklist_notification_logs').insert({
    ...(dados as Record<string, unknown>),
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Erro ao registrar log de notificação:', error);
  }
}
