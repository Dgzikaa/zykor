import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Motivo da PAUSA de uma produção em andamento (aba Executar do Controle de Produção).
 *
 * POST { bar_id, idempotencia_key, motivos: string[], texto: string }
 *   → grava operations.producao_execucao_rascunho.obs_pausa = { motivos, texto, autor, em }.
 *   Vazio (sem motivos e sem texto) → limpa (null).
 *
 * Coluna SEPARADA do `estado` de propósito: o autosave da pessoa (PUT) não inclui obs_pausa,
 * então nunca sobrescreve a nota. Assim tanto a pessoa da produção quanto o gestor podem anotar
 * (de qualquer aparelho) sem conflito — o realtime da tabela propaga pra todos.
 */

const SCHEMA = 'operations';
const TABLE = 'producao_execucao_rascunho';

const MOTIVOS_VALIDOS = new Set(['Acabou insumo', 'Fim de turno', 'Aguardando etapa', 'Intervalo', 'Equipamento']);

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const body = await request.json().catch(() => ({}));
  const barId = Number(body?.bar_id) || user.bar_id;
  const key = String(body?.idempotencia_key || '').trim().slice(0, 80);
  if (!barId || !key) return NextResponse.json({ success: false, error: 'bar_id e idempotencia_key obrigatórios' }, { status: 400 });

  // motivos: só os presets conhecidos (evita lixo); texto livre limitado.
  const motivos = (Array.isArray(body?.motivos) ? body.motivos : [])
    .map((m: any) => String(m)).filter((m: string) => MOTIVOS_VALIDOS.has(m)).slice(0, 5);
  const texto = (typeof body?.texto === 'string' ? body.texto : '').trim().slice(0, 300);

  const vazio = motivos.length === 0 && !texto;
  const obs = vazio ? null : { motivos, texto, autor: user.nome ?? user.email ?? null, em: new Date().toISOString() };

  const supabase = await getAdminClient();
  const { error } = await (supabase as any).schema(SCHEMA).from(TABLE)
    .update({ obs_pausa: obs }).eq('bar_id', barId).eq('idempotencia_key', key);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, obs_pausa: obs });
}
