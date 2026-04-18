import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { listarPlanejamentoComercial } from '@/lib/services/eventos/listar-planejamento';
import { repos } from '@/lib/repositories';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// =====================================================
// GET — listar planejamento comercial do mes
// =====================================================
const QuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).optional(),
  ano: z.coerce.number().int().min(2024).max(2100).optional(),
});

export const GET = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);

  const url = new URL(request.url);
  const params = QuerySchema.parse(Object.fromEntries(url.searchParams));
  const hoje = new Date();
  const mes = params.mes ?? hoje.getMonth() + 1;
  const ano = params.ano ?? hoje.getFullYear();

  const result = await listarPlanejamentoComercial({
    barId: user.bar_id,
    mes,
    ano,
  });

  return success(result.items, { meta: result.meta });
});

// =====================================================
// POST — forcar recalculo de eventos
// =====================================================
const PostSchema = z.object({
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  evento_ids: z.array(z.number().int()).optional(),
});

export const POST = withAuth(async ({ user, request }) => {
  void user;
  const body = PostSchema.parse(await request.json());
  const { eventos } = await repos();

  let totalRecalculados = 0;

  if (body.evento_ids?.length) {
    for (const eventoId of body.evento_ids) {
      try {
        await eventos.recalcularMetricas(eventoId);
        totalRecalculados++;
      } catch (err) {
        console.error(`Erro ao recalcular evento ${eventoId}:`, err);
      }
    }
  } else if (body.data_inicio) {
    // Mantemos a chamada RPC direta aqui pois e bulk e nao foi modelada como repository ainda
    const { getAdminClient } = await import('@/lib/supabase-admin');
    const client = await getAdminClient();
    const { data, error } = await client.rpc('recalcular_eventos_periodo', {
      data_inicio: body.data_inicio,
      data_fim: body.data_fim ?? body.data_inicio,
    });
    if (!error) totalRecalculados = (data as number) || 0;
  } else {
    const { getAdminClient } = await import('@/lib/supabase-admin');
    const client = await getAdminClient();
    const { data, error } = await client.rpc('recalcular_eventos_pendentes', { limite: 50 });
    if (!error) totalRecalculados = (data as number) || 0;
  }

  return NextResponse.json({
    success: true,
    message: `${totalRecalculados} eventos recalculados com sucesso`,
    total_recalculados: totalRecalculados,
  });
});
