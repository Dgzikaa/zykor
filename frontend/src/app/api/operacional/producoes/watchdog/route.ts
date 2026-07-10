import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Watchdog diário de execuções de produção com magnitude ABSURDA (erro de preenchimento de unidade
 * que passou pela trava dura, ou foi criado antes dela). Fonte: operations.fn_producoes_absurdas —
 * flag por quebra de proporção (rendimento >> meta, peso limpo > bruto, FC minúsculo, peso em
 * escala de tonelada), NÃO por tamanho de lote (fazer 400 pastéis é legítimo). Só REVISA — dispara
 * uma notificação por bar pros admins revisarem/corrigirem. Protegido pelo CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any)
    .schema('operations')
    .rpc('fn_producoes_absurdas', { p_horas: 26, p_limite: 20 });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const linhas: any[] = data || [];
  if (!linhas.length) return NextResponse.json({ success: true, flags: 0, bares: [] });

  // agrupa por bar; dentro do bar, uma linha por execução (a mesma execução pode ter vários motivos)
  const porBar = new Map<number, any[]>();
  for (const l of linhas) {
    const arr = porBar.get(l.bar_id) || [];
    arr.push(l);
    porBar.set(l.bar_id, arr);
  }

  const { dispatchNotification } = await import('@/lib/notifications/dispatch');
  const resultados: any[] = [];
  for (const [barId, flags] of porBar) {
    const execs = new Set(flags.map((f) => f.execucao_id));
    const detalhes = flags.slice(0, 5)
      .map((f) => `• ${f.producao_nome} (${f.responsavel_nome || 's/ resp.'}): ${f.motivo}`)
      .join('\n');
    const mensagem =
      `${execs.size} produção(ões) com valor suspeito de erro de unidade nas últimas 26h.\n${detalhes}` +
      (execs.size > 5 ? `\n…e mais.` : '') +
      `\nRevise em Controle de Produção → Histórico e corrija o peso/rendimento.`;
    try {
      const r = await dispatchNotification({
        barId,
        eventKey: 'producao_valor_suspeito',
        severidade: 'alerta',
        titulo: '⚠️ Produção com valor suspeito',
        mensagem,
        url: '/operacional/producoes',
        destinatarios: { roles: ['admin'] },
        dados: { execucoes: [...execs], flags: flags.length },
      });
      resultados.push({ bar_id: barId, execucoes: execs.size, enviadas: r.enviadas, pulado: r.pulado });
    } catch (e: any) {
      resultados.push({ bar_id: barId, error: e?.message || String(e) });
    }
  }

  return NextResponse.json({ success: true, flags: linhas.length, bares: resultados });
}
