import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Vigia da OPERAÇÃO — parte que AVISA.
 *
 * Nasceu do dia 22/08/2026, em que TODO problema apareceu por acaso: o xarope de gengibre zerou e
 * só se descobriu porque a Mafê resolveu seguir o plano à risca pra investigar; 9 lançamentos de
 * produção com erro de 1000× (kg num campo que espera grama) só apareceram porque eu mudei o
 * desvio; a Feijoada vende R$28 mil em 60 dias sem ficha; o Refri. de Gengibre está no Controle de
 * Produção com ficha vazia. O sistema tinha o dado pra avisar os quatro e não avisava nenhum.
 *
 * A detecção é do banco (`public.operacao_watchdog`), o alerta sai daqui — mesmo motivo do vigia do
 * ContaHub: o WhatsApp só entrega com o `UMBLER_API_TOKEN` da Vercel, via `dispatchNotification`.
 * Mandar do banco falha calado.
 *
 * Avisa UMA VEZ por ocorrência (`alertado_em`) e reabre se o problema voltar. `?dry=1` mostra o que
 * mandaria sem mandar.
 */
const DESTINATARIOS = [
  'ba36f97d-1c1f-4795-8a8a-85b9b494de5d', // Rodrigo Oliveira
  '97f533ab-af54-4dd4-849b-d772aec8fb0e', // Pedro Gonzalez
];

const BAR = (id: number) => (id === 3 ? 'Ordinário' : id === 4 ? 'Deboche' : `Bar ${id}`);
const n = (v: any) => Number(v ?? 0);
const fmt = (v: any) => n(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

interface Pendente { bar_id: number; tipo: string; chave: string; detalhe: any }

function bateSegredo(recebido: string, esperado: string): boolean {
  return !!recebido && !!esperado && recebido.length === esperado.length &&
    timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

/**
 * Uma linha por ocorrência, escrita pra quem vai AGIR — não pra quem programou.
 * Cada tipo diz o que aconteceu E o que fazer, senão o alerta vira aviso que ninguém trata.
 */
function linhaDe(p: Pendente): string {
  const d = p.detalhe || {};
  const bar = BAR(p.bar_id);
  switch (p.tipo) {
    case 'ruptura':
      return `⏳ ${bar}: *${d.nome}* dura ~${fmt(d.dias_de_estoque)} dia(s) — ${fmt(d.estoque)} ${d.unidade || ''} pra um consumo de ${fmt(d.por_dia)}/dia, e a produção sai ${fmt(d.lead)} dia(s) depois da contagem. Produza antes.`;
    case 'lancamento_torto':
      return `⚠️ ${bar}: em *${d.producao}* (${d.dia}${d.responsavel ? `, ${d.responsavel}` : ''}) lançaram *${fmt(d.lancado)}* de ${d.componente} onde a ficha esperava *${fmt(d.esperado)}*. Parece unidade trocada (kg × grama). Corrija a execução.`;
    case 'produto_sem_ficha':
      return `🧾 ${bar}: *${d.nome}* vendeu R$ ${fmt(d.faturamento_30d)} em 30 dias e não tem ficha técnica — o custo dele não entra em conta nenhuma.`;
    case 'producao_sem_ficha':
      return `📋 ${bar}: *${d.nome}* está no Controle de Produção com a ficha VAZIA — o sistema não sabe o que entra nela.`;
    default:
      return `${bar}: ${p.tipo} — ${p.chave}`;
  }
}

/** Ordem de leitura: o que fura hoje primeiro, cadastro por último. */
const PESO: Record<string, number> = { ruptura: 0, lancamento_torto: 1, produto_sem_ficha: 2, producao_sem_ficha: 3 };

export async function GET(request: NextRequest) {
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const autorizado =
    bateSegredo(bearer, process.env.CRON_SECRET || '') ||
    bateSegredo(bearer, process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!autorizado) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dryRun = request.nextUrl.searchParams.get('dry') === '1';
  const supabase = await getAdminClient();

  const { data: resumo, error: erroRpc } = await supabase.rpc('operacao_watchdog', { p_alertar: false });
  if (erroRpc) return NextResponse.json({ success: false, etapa: 'watchdog', erro: erroRpc.message }, { status: 500 });

  const { data: pendentes, error: erroPend } = await supabase.rpc('operacao_watchdog_pendentes');
  if (erroPend) return NextResponse.json({ success: false, etapa: 'pendentes', erro: erroPend.message }, { status: 500 });

  const lista = ((pendentes || []) as Pendente[])
    .sort((a, b) => (PESO[a.tipo] ?? 9) - (PESO[b.tipo] ?? 9) || a.bar_id - b.bar_id);
  if (!lista.length) {
    return NextResponse.json({ success: true, resumo: (resumo as any)?.abertos ?? null, alertou: false });
  }

  // Teto de 12 linhas: mensagem gigante no WhatsApp não é lida, e o resto continua na tabela
  // (sem `alertado_em`) pra entrar no próximo envio. Melhor 12 tratadas que 40 ignoradas.
  const MAX = 12;
  const mostrar = lista.slice(0, MAX);
  const sobra = lista.length - mostrar.length;
  const mensagem = [
    ...mostrar.map(linhaDe),
    sobra > 0 ? `\n_+${sobra} ocorrência(s) na próxima checagem._` : '',
  ].filter(Boolean).join('\n');

  if (dryRun) {
    return NextResponse.json({ success: true, dry: true, total: lista.length, mensagem, pendentes: lista });
  }

  const r = await dispatchNotification({
    barId: lista[0].bar_id,
    eventKey: 'sistema_alerta',
    titulo: 'Operação — pontos pra tratar',
    mensagem,
    url: '/operacional/plano-producao',
    destinatarios: { authIds: DESTINATARIOS },
    canais: ['whatsapp', 'in_app'],
  });

  // Discord SEMPRE: o canal Zykor da Umbler aceita a chamada (HTTP 200) mas a mensagem pode morrer
  // depois em messageState='Failed'. O Discord é o que comprovadamente entrega.
  let discord = false;
  try {
    const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/discord-dispatcher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        action: 'notification', canal: 'alertas_criticos',
        title: 'Operação — pontos pra tratar', custom_message: mensagem,
      }),
    });
    discord = resp.ok;
  } catch (e) {
    console.error('[operacao-watchdog] discord falhou (ignorado):', e);
  }

  // Só marca como avisado depois de algum canal ter saído — se todos falharem, tenta de novo.
  let marcados = 0;
  if (discord || r.enviadas > 0 || r.whatsapp.enviados > 0) {
    const { data } = await supabase.rpc('operacao_watchdog_marcar_alertado');
    marcados = (data as number) ?? 0;
  }

  return NextResponse.json({
    success: true, total: lista.length, alertou: true, mensagem,
    whatsapp: r.whatsapp, in_app: r.enviadas, discord, marcados,
  });
}
