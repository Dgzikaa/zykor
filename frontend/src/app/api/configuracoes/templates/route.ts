import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  authenticateUser,
  checkPermission,
  authErrorResponse,
  permissionErrorResponse,
} from '@/middleware/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ========================================
// 📋 API PARA TEMPLATES DE CHECKLISTS
// ========================================

interface TemplateItem {
  titulo: string;
  descricao?: string;
  tipo: string;
  obrigatorio: boolean;
  ordem: number;
  opcoes?: {
    min?: number;
    max?: number;
    unidade?: string;
  };
}

interface TemplateSecao {
  nome: string;
  descricao?: string;
  cor: string;
  ordem: number;
  itens: TemplateItem[];
}

interface TemplateEstrutura {
  secoes: TemplateSecao[];
}

interface TemplatePredefinido {
  nome: string;
  descricao: string;
  categoria: string;
  setor: string;
  tipo: string;
  frequencia: string;
  tempo_estimado: number;
  tags: string[];
  estrutura: TemplateEstrutura;
}

// =====================================================
// SCHEMAS DE VALIDAÇÃO
// =====================================================

const TemplateCreateSchema = z.object({
  nome: z.string().min(1).max(255),
  descricao: z.string().optional(),
  categoria: z.enum([
    'limpeza',
    'seguranca',
    'qualidade',
    'manutencao',
    'abertura',
    'fechamento',
    'auditoria',
    'geral',
  ]),
  setor: z.string().min(1),
  tipo: z.enum([
    'abertura',
    'fechamento',
    'manutencao',
    'qualidade',
    'seguranca',
    'limpeza',
    'auditoria',
  ]),
  frequencia: z.enum([
    'diaria',
    'semanal',
    'quinzenal',
    'mensal',
    'bimestral',
    'trimestral',
    'conforme_necessario',
  ]),
  tempo_estimado: z.number().min(1).max(480).default(30),
  publico: z.boolean().default(false), // Se é público para todos os bares
  predefinido: z.boolean().default(false), // Se é template do sistema
  tags: z.array(z.string()).optional(),
  estrutura: z.object({
    secoes: z.array(
      z.object({
        nome: z.string(),
        descricao: z.string().optional(),
        cor: z.string().default('bg-blue-500'),
        ordem: z.number(),
        itens: z.array(
          z.object({
            titulo: z.string(),
            descricao: z.string().optional(),
            tipo: z.enum([
              'texto',
              'numero',
              'sim_nao',
              'data',
              'assinatura',
              'foto_camera',
              'foto_upload',
              'avaliacao',
            ]),
            obrigatorio: z.boolean().default(false),
            ordem: z.number(),
            opcoes: z.object({}).optional(),
            condicional: z
              .object({
                dependeDe: z.string(),
                valor: z.unknown(),
              })
              .optional(),
            validacao: z.object({}).optional(),
          })
        ),
      })
    ),
  }),
});

const TemplateQuerySchema = z.object({
  categoria: z.string().optional(),
  setor: z.string().optional(),
  tipo: z.string().optional(),
  publico: z
    .string()
    .transform((val: string) => val === 'true')
    .optional(),
  predefinido: z
    .string()
    .transform((val: string) => val === 'true')
    .optional(),
  busca: z.string().optional(),
  tags: z.string().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

// =====================================================
// TEMPLATES PREDEFINIDOS DO SISTEMA
// =====================================================

const TEMPLATES_PREDEFINIDOS: TemplatePredefinido[] = [
  {
    nome: 'Abertura de Cozinha - Básico',
    descricao: 'Checklist essencial para abertura segura da cozinha',
    categoria: 'abertura',
    setor: 'cozinha',
    tipo: 'abertura',
    frequencia: 'diaria',
    tempo_estimado: 15,
    tags: ['cozinha', 'abertura', 'higiene', 'básico'],
    estrutura: {
      secoes: [
        {
          nome: 'Higiene e Limpeza',
          descricao: 'Verificações básicas de higiene',
          cor: 'bg-blue-500',
          ordem: 1,
          itens: [
            {
              titulo: 'Bancadas limpas e sanitizadas',
              descricao:
                'Verificar se todas as bancadas estão limpas e sanitizadas',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 1,
            },
            {
              titulo: 'Pias e torneiras limpas',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 2,
            },
            {
              titulo: 'Lixeiras vazias e com sacos novos',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 3,
            },
          ],
        },
        {
          nome: 'Equipamentos',
          descricao: 'Verificação de equipamentos essenciais',
          cor: 'bg-green-500',
          ordem: 2,
          itens: [
            {
              titulo: 'Fogão funcionando corretamente',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 1,
            },
            {
              titulo: 'Geladeira - temperatura adequada',
              descricao: 'Entre 0°C e 4°C',
              tipo: 'numero',
              obrigatorio: true,
              ordem: 2,
              opcoes: { min: -5, max: 10, unidade: '°C' },
            },
            {
              titulo: 'Freezer - temperatura adequada',
              descricao: 'Entre -18°C e -25°C',
              tipo: 'numero',
              obrigatorio: true,
              ordem: 3,
              opcoes: { min: -30, max: -15, unidade: '°C' },
            },
          ],
        },
      ],
    },
  },
  {
    nome: 'Limpeza de Banheiros',
    descricao: 'Protocolo completo de limpeza e higienização de banheiros',
    categoria: 'limpeza',
    setor: 'banheiro',
    tipo: 'limpeza',
    frequencia: 'diaria',
    tempo_estimado: 20,
    tags: ['banheiro', 'limpeza', 'higiene', 'sanitização'],
    estrutura: {
      secoes: [
        {
          nome: 'Limpeza Geral',
          cor: 'bg-purple-500',
          ordem: 1,
          itens: [
            {
              titulo: 'Vasos sanitários limpos e desinfetados',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 1,
            },
            {
              titulo: 'Pias e torneiras limpas',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 2,
            },
            {
              titulo: 'Espelhos limpos',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 3,
            },
            {
              titulo: 'Chão lavado e seco',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 4,
            },
          ],
        },
        {
          nome: 'Suprimentos',
          cor: 'bg-orange-500',
          ordem: 2,
          itens: [
            {
              titulo: 'Papel higiênico disponível',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 1,
            },
            {
              titulo: 'Sabonete/sabão disponível',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 2,
            },
            {
              titulo: 'Papel toalha disponível',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 3,
            },
          ],
        },
      ],
    },
  },
  {
    nome: 'Checklist de Segurança - Básico',
    descricao: 'Verificações essenciais de segurança do estabelecimento',
    categoria: 'seguranca',
    setor: 'geral',
    tipo: 'seguranca',
    frequencia: 'diaria',
    tempo_estimado: 10,
    tags: ['segurança', 'prevenção', 'básico'],
    estrutura: {
      secoes: [
        {
          nome: 'Prevenção de Incêndio',
          cor: 'bg-red-500',
          ordem: 1,
          itens: [
            {
              titulo: 'Extintores no local e dentro da validade',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 1,
            },
            {
              titulo: 'Saídas de emergência desobstruídas',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 2,
            },
          ],
        },
        {
          nome: 'Segurança Geral',
          cor: 'bg-yellow-500',
          ordem: 2,
          itens: [
            {
              titulo: 'Instalações elétricas em bom estado',
              tipo: 'sim_nao',
              obrigatorio: true,
              ordem: 1,
            },
          ],
        },
      ],
    },
  },
];

// =====================================================
// GET - LISTAR TEMPLATES
// =====================================================
export async function GET(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);
    const query = TemplateQuerySchema.parse(Object.fromEntries(searchParams));

    const supabase = await getAdminClient();

    // Construir query base
    let dbQuery = supabase
      .from('checklist_templates')
      .select(
        `
        *,
        criado_por:usuarios_bar!criado_por (nome, email),
        template_tags (
          template_tags (nome, cor)
        )
      `
      )
      .order('predefinido', { ascending: false }) // Templates do sistema primeiro
      .order('criado_em', { ascending: false });

    // Filtrar por templates públicos OU do próprio bar
    dbQuery = dbQuery.or(`publico.eq.true,bar_id.eq.${user.bar_id.toString()}`);

    // Aplicar filtros
    if (query.categoria) {
      dbQuery = dbQuery.eq('categoria', query.categoria);
    }

    if (query.setor) {
      dbQuery = dbQuery.eq('setor', query.setor);
    }

    if (query.tipo) {
      dbQuery = dbQuery.eq('tipo', query.tipo);
    }

    if (query.publico !== undefined) {
      dbQuery = dbQuery.eq('publico', query.publico);
    }

    if (query.predefinido !== undefined) {
      dbQuery = dbQuery.eq('predefinido', query.predefinido);
    }

    if (query.busca) {
      dbQuery = dbQuery.or(
        `nome.ilike.%${query.busca}%,descricao.ilike.%${query.busca}%`
      );
    }

    // Paginação
    const offset = (query.page - 1) * query.limit;
    dbQuery = dbQuery.range(offset, offset + query.limit - 1);

    const { data: templates, error, count } = await dbQuery;

    if (error) {
      console.error('Erro ao buscar templates:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar templates' },
        { status: 500 }
      );
    }

    // Buscar estatísticas
    const { data: stats } = await supabase
      .from('checklist_templates')
      .select('categoria, publico, predefinido')
      .or(`publico.eq.true,bar_id.eq.${user.bar_id.toString()}`);

    interface TemplateStats {
      categoria: string;
      publico: boolean;
      predefinido: boolean;
    }

    const estatisticas = {
      total: stats?.length || 0,
      por_categoria: stats?.reduce(
        (acc: Record<string, number>, item: TemplateStats) => {
          acc[item.categoria] = (acc[item.categoria] || 0) + 1;
          return acc;
        },
        {}
      ),
      publicos:
        stats?.filter((item: TemplateStats) => item.publico).length || 0,
      predefinidos:
        stats?.filter((item: TemplateStats) => item.predefinido).length || 0,
    };

    return NextResponse.json({
      success: true,
      data: templates,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: count,
        pages: Math.ceil((count || 0) / query.limit),
      },
      estatisticas,
    });
  } catch (error: unknown) {
    const apiError = error as Error;
    console.error('Erro na API de templates GET:', apiError);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - CRIAR TEMPLATE OU INSTALAR PREDEFINIDOS
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    // 🔒 PERMISSÕES - Verificar se pode criar templates
    if (!checkPermission(user, { module: 'checklists', action: 'write' })) {
      return permissionErrorResponse('Sem permissão para criar templates');
    }

    const body = await request.json();
    const supabase = await getAdminClient();

    // Verificar se é uma solicitação para instalar templates predefinidos
    if (body.action === 'install_predefined') {
      console.log('📦 Instalando templates predefinidos...');

      const templatesParaInstalar: Array<{
        nome: string;
        descricao: string;
        categoria: string;
        setor: string;
        tipo: string;
        frequencia: string;
        tempo_estimado: number;
        tags: string[];
        estrutura: TemplateEstrutura;
        publico: boolean;
        predefinido: boolean;
        bar_id: null;
        criado_por: string;
      }> = [];

      for (const template of TEMPLATES_PREDEFINIDOS) {
        // Verificar se já existe
        const { data: existente } = await supabase
          .from('checklist_templates')
          .select('id')
          .eq('nome', template.nome)
          .eq('predefinido', true)
          .single();

        if (!existente) {
          templatesParaInstalar.push({
            ...template,
            publico: true,
            predefinido: true,
            bar_id: null, // Templates do sistema não pertencem a nenhum bar específico
            criado_por: user.user_id,
          });
        }
      }

      if (templatesParaInstalar.length > 0) {
        const { data: novosTemplates, error: insertError } = await supabase
          .from('checklist_templates')
          .insert(templatesParaInstalar)
          .select();

        if (insertError) {
          console.error('Erro ao instalar templates:', insertError);
          return NextResponse.json(
            { error: 'Erro ao instalar templates' },
            { status: 500 }
          );
        }

        console.log(
          `✅ ${novosTemplates.length} templates predefinidos instalados`
        );

        return NextResponse.json({
          success: true,
          message: `${novosTemplates.length} templates predefinidos instalados com sucesso`,
          data: novosTemplates,
        });
      } else {
        return NextResponse.json({
          success: true,
          message: 'Todos os templates predefinidos já estão instalados',
          data: [],
        });
      }
    }

    // Criar template personalizado
    const data = TemplateCreateSchema.parse(body);

    // Verificar se já existe template com mesmo nome
    const { data: existente } = await supabase
      .from('checklist_templates')
      .select('id')
      .eq('nome', data.nome)
      .eq('bar_id', data.publico ? null : user.bar_id)
      .single();

    if (existente) {
      return NextResponse.json(
        {
          error: 'Já existe um template com este nome',
        },
        { status: 400 }
      );
    }

    // Criar template
    const { data: template, error: templateError } = await supabase
      .from('checklist_templates')
      .insert({
        nome: data.nome,
        descricao: data.descricao,
        categoria: data.categoria,
        setor: data.setor,
        tipo: data.tipo,
        frequencia: data.frequencia,
        tempo_estimado: data.tempo_estimado,
        publico: data.publico,
        predefinido: false,
        estrutura: data.estrutura,
        bar_id: data.publico ? null : user.bar_id,
        criado_por: user.user_id,
      })
      .select()
      .single();

    if (templateError) {
      console.error('Erro ao criar template:', templateError);
      return NextResponse.json(
        { error: 'Erro ao criar template' },
        { status: 500 }
      );
    }

    // Adicionar tags se fornecidas
    if (data.tags && data.tags.length > 0) {
      for (const tagNome of data.tags) {
        // Buscar ou criar tag
        let { data: tag } = await supabase
          .from('template_tags')
          .select('id')
          .eq('nome', tagNome)
          .single();

        if (!tag) {
          const { data: novaTag } = await supabase
            .from('template_tags')
            .insert({ nome: tagNome })
            .select()
            .single();
          tag = novaTag;
        }

        if (tag) {
          // Associar tag ao template
          await supabase.from('checklist_tags').insert({
            template_id: template.id,
            tag_id: tag.id,
          });
        }
      }
    }

    console.log('✅ Template criado:', template.nome);

    return NextResponse.json(
      {
        success: true,
        message: 'Template criado com sucesso',
        data: template,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const apiError = error as Error;
    console.error('Erro na API de templates POST:', apiError);

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
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - REMOVER TEMPLATE
// =====================================================
export async function DELETE(request: NextRequest) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const supabase = await getAdminClient();

    // Verificar se template existe e se pode ser excluído
    const { data: template } = await supabase
      .from('checklist_templates')
      .select('id, nome, predefinido, publico, bar_id, criado_por')
      .eq('id', id)
      .single();

    if (!template) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    // Não permitir deletar templates predefinidos do sistema
    if (template.predefinido) {
      return NextResponse.json(
        {
          error: 'Templates predefinidos do sistema não podem ser removidos',
        },
        { status: 403 }
      );
    }

    // Verificar permissões
    if (template.publico) {
      // Template público só pode ser deletado por admin
      if (!checkPermission(user, { module: 'checklists', action: 'admin' })) {
        return permissionErrorResponse(
          'Apenas administradores podem deletar templates públicos'
        );
      }
    } else {
      // Template privado só pode ser deletado pelo criador ou admin do bar
      if (
        template.criado_por !== user.user_id &&
        template.bar_id !== user.bar_id
      ) {
        return permissionErrorResponse(
          'Sem permissão para deletar este template'
        );
      }
    }

    // Verificar se template está sendo usado
    const { data: checklists } = await supabase
      .from('checklists')
      .select('id')
      .eq('template_origem', id)
      .limit(1);

    if (checklists && checklists.length > 0) {
      return NextResponse.json(
        {
          error:
            'Template não pode ser removido pois está sendo usado por checklists existentes',
        },
        { status: 400 }
      );
    }

    // Deletar template (cascade remove tags automaticamente)
    const { error: deleteError } = await supabase
      .from('checklist_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar template:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao deletar template' },
        { status: 500 }
      );
    }

    console.log('✅ Template deletado:', template.nome);

    return NextResponse.json({
      success: true,
      message: 'Template deletado com sucesso',
    });
  } catch (error: unknown) {
    const apiError = error as Error;
    console.error('Erro na API de templates DELETE:', apiError);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
