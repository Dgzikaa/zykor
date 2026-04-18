import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { listarNotificacoes } from '@/lib/services/notificacoes/listar-notificacoes';
import { repos } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

// =====================================================
// GET — listar notificacoes paginadas
// =====================================================
const FiltrosSchema = z.object({
  status: z.enum(['pendente', 'enviada', 'lida', 'descartada']).optional(),
  modulo: z.string().optional(),
  tipo: z.string().optional(),
  prioridade: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  usuario_id: z.string().uuid().optional(),
  apenas_nao_lidas: z.union([z.literal('true'), z.literal('false')]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);

  const url = new URL(request.url);
  const params = FiltrosSchema.parse(Object.fromEntries(url.searchParams));

  const data = await listarNotificacoes(
    {
      barId: String(user.bar_id),
      usuarioId: params.usuario_id,
      status: params.status,
      modulo: params.modulo,
      tipo: params.tipo,
      prioridade: params.prioridade,
      dataInicio: params.data_inicio,
      dataFim: params.data_fim,
      apenasNaoLidas: params.apenas_nao_lidas === 'true',
      page: params.page,
      limit: params.limit,
    },
    { authId: user.auth_id, role: user.role }
  );

  return success(data);
});

// =====================================================
// POST — criar notificacao direta
// =====================================================
const CriarSchema = z.object({
  modulo: z.enum(['checklists', 'metas', 'relatorios', 'dashboard', 'sistema']),
  tipo: z.enum(['info', 'alerta', 'erro', 'sucesso']),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']).default('media'),
  categoria: z.string().optional(),
  titulo: z.string().min(1).max(255),
  mensagem: z.string().min(1),
  dados_extras: z.record(z.string(), z.unknown()).optional(),
  acoes: z.array(z.unknown()).optional(),
  canais: z.array(z.enum(['browser', 'whatsapp', 'email'])).default(['browser']),
  usuario_id: z.string().uuid().optional(),
  role_alvo: z.enum(['admin', 'financeiro', 'funcionario']).optional(),
  enviar_em: z.string().datetime().optional(),
  referencia_tipo: z.string().optional(),
  referencia_id: z.string().uuid().optional(),
  chave_duplicacao: z.string().optional(),
});

export const POST = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);

  const body = CriarSchema.parse(await request.json());
  const { notificacoes } = await repos();

  const nova = await notificacoes.criar({
    barId: user.bar_id,
    usuarioId: body.usuario_id,
    tipo: body.tipo,
    titulo: body.titulo,
    mensagem: body.mensagem,
    canais: body.canais,
    status: 'pendente',
    agendadaPara: body.enviar_em
      ? new Date(body.enviar_em).toISOString()
      : undefined,
    criadaPor: user.auth_id,
    roleAlvo: body.role_alvo,
    modulo: body.modulo,
    prioridade: body.prioridade,
    categoria: body.categoria,
    dadosExtras: body.dados_extras,
    acoes: body.acoes,
    referenciaTipo: body.referencia_tipo,
    referenciaId: body.referencia_id,
    chaveDuplicacao: body.chave_duplicacao,
  });

  // Browser notifications sao "instantaneas" — marca como enviada
  if (body.canais.includes('browser') && nova && (nova as { id?: string }).id) {
    await notificacoes
      .marcarEnviada((nova as { id: string }).id)
      .catch((err) => console.error('Erro ao marcar enviada:', err));
  }

  return success(nova, { status: 201 });
});
