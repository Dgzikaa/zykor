import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { BARES_BRIEFING, montarBriefingBar } from '@/lib/briefing/build';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Briefing diário do dono. Toda manhã (09h30 BRT, após o sync do ContaHub das 07h),
 * monta o placar de ontem de cada bar e dispara por WhatsApp.
 *
 * PILOTO: envia só para Rodrigo e Pedro (auth_ids fixos abaixo). Depois vira regra por bar
 * na Central de Notificações. Protegido pelo CRON_SECRET; agendado no frontend/vercel.json.
 *
 * `?dry=1` (com o mesmo Bearer) monta e retorna as mensagens SEM disparar — para preview.
 */
const DESTINATARIOS = [
  'ba36f97d-1c1f-4795-8a8a-85b9b494de5d', // Rodrigo Oliveira
  '97f533ab-af54-4dd4-849b-d772aec8fb0e', // Pedro Gonzalez
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dry') === '1';

  // Brasil é UTC-3 fixo (sem horário de verão). "ontem" em BRT.
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hojeISO = nowBRT.toISOString().slice(0, 10);
  const ontemISO = new Date(nowBRT.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const supabase = await getAdminClient();
  const resultados: Array<Record<string, unknown>> = [];

  for (const bar of BARES_BRIEFING) {
    try {
      const briefing = await montarBriefingBar(supabase, bar, hojeISO, ontemISO);
      if (!briefing) {
        resultados.push({ bar: bar.nome, pulado: true, motivo: 'sem_movimento_ontem' });
        continue;
      }
      if (dryRun) {
        resultados.push({ bar: bar.nome, dry: true, ...briefing });
        continue;
      }
      const r = await dispatchNotification({
        barId: bar.barId,
        eventKey: 'briefing_diario',
        titulo: briefing.titulo,
        mensagem: briefing.mensagem,
        destinatarios: { authIds: DESTINATARIOS },
        canais: ['whatsapp'],
      });
      resultados.push({ bar: bar.nome, whatsapp: r.whatsapp, mensagem: briefing.mensagem });
    } catch (e) {
      resultados.push({ bar: bar.nome, erro: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ success: true, dry: dryRun, ontem: ontemISO, resultados });
}
