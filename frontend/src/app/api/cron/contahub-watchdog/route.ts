import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Vigia dos dados do ContaHub — parte que AVISA.
 *
 * O trabalho pesado é do banco (`public.contahub_watchdog`): detecta dia sem ingestão
 * cruzando com a Stone, dispara o retry do sync e conserta sozinho o dia que ficou órfão
 * na cadeia silver -> planejamento -> desempenho. Ver
 * database/migrations/20260810_contahub_watchdog_buracos.sql.
 *
 * O alerta sai DAQUI, e não do banco, por um motivo concreto: o token da Umbler que
 * realmente entrega é o `UMBLER_API_TOKEN` da Vercel (o mesmo que o briefing diário usa).
 * O token guardado em integrations.umbler_account pertence a um membro com
 * `allowedTemplates: false` — a API aceita (HTTP 200) mas a mensagem morre depois em
 * `messageState: 'Failed'`. Mandando pelo dispatcher reusamos o caminho comprovado.
 *
 * Só avisa depois de o retry automático ter falhado 2 vezes, e uma vez por dia furado.
 * Agendada em frontend/vercel.json. Aceita CRON_SECRET (o cron da Vercel) ou a
 * service-role key — mesmo padrão das rotas Stone, para dar pra rodar sob demanda a
 * partir do banco (`net.http_post` + get_service_role_key()) sem sessão de navegador.
 *
 * `?dry=1` roda a detecção e mostra o que alertaria, sem disparar.
 */
const DESTINATARIOS = [
  'ba36f97d-1c1f-4795-8a8a-85b9b494de5d', // Rodrigo Oliveira
  '97f533ab-af54-4dd4-849b-d772aec8fb0e', // Pedro Gonzalez
];

interface Pendente {
  bar_id: number;
  bar_nome: string;
  dia: string;
  tentativas: number;
}

/** "04/08" a partir de "2026-08-04" (sem passar por Date, que puxaria fuso). */
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Compara sem vazar tempo; exige mesmo tamanho (timingSafeEqual lança se diferir). */
function bateSegredo(recebido: string, esperado: string): boolean {
  return (
    !!recebido &&
    !!esperado &&
    recebido.length === esperado.length &&
    timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))
  );
}

export async function GET(request: NextRequest) {
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const autorizado =
    bateSegredo(bearer, process.env.CRON_SECRET || '') ||
    bateSegredo(bearer, process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!autorizado) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dry') === '1';
  const supabase = await getAdminClient();

  // 1. Detecção + retry + auto-cura (p_alertar=false: quem avisa é esta rota)
  const { data: resumo, error: erroRpc } = await supabase.rpc('contahub_watchdog', {
    p_dias: 10,
    p_alertar: false,
  });
  if (erroRpc) {
    return NextResponse.json({ success: false, etapa: 'watchdog', erro: erroRpc.message }, { status: 500 });
  }

  // 2. O que sobrou sem conserto depois de 2 tentativas
  const { data: pendentes, error: erroPend } = await supabase.rpc('contahub_watchdog_pendentes');
  if (erroPend) {
    return NextResponse.json({ success: false, etapa: 'pendentes', erro: erroPend.message }, { status: 500 });
  }

  const lista = (pendentes || []) as Pendente[];
  if (lista.length === 0) {
    return NextResponse.json({ success: true, resumo, alertou: false });
  }

  const detalhe = lista.map((p) => `${p.bar_nome} em ${ddmm(p.dia)}`).join('; ');
  const mensagem =
    `O ContaHub não entregou o faturamento de: ${detalhe}. ` +
    `O retry automático já tentou e não resolveu — esses dias estão zerados nas telas de ` +
    `planejamento e desempenho. Confira a integração.`;

  if (dryRun) {
    return NextResponse.json({ success: true, dry: true, resumo, mensagem, pendentes: lista });
  }

  // 3. Avisa pelo caminho que funciona (mesmo dispatcher do briefing diário)
  const r = await dispatchNotification({
    barId: lista[0].bar_id,
    eventKey: 'sistema_alerta',
    titulo: 'ContaHub sem dados',
    mensagem,
    url: '/alertas',
    destinatarios: { authIds: DESTINATARIOS },
    canais: ['whatsapp', 'in_app'],
  });

  // 4. Marca como avisado só depois de o envio ter saído — se falhar, tenta de novo
  //    na próxima execução em vez de silenciar o buraco.
  let marcados = 0;
  if (r.whatsapp.enviados > 0 || r.enviadas > 0) {
    const { data } = await supabase.rpc('contahub_watchdog_marcar_alertado');
    marcados = (data as number) ?? 0;
  }

  return NextResponse.json({
    success: true,
    resumo,
    alertou: true,
    mensagem,
    whatsapp: r.whatsapp,
    in_app: r.enviadas,
    marcados,
  });
}
