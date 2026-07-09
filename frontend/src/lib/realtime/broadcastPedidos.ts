/**
 * Push instantâneo da lista de Pedidos de Pagamento via Supabase Broadcast.
 *
 * Broadcast é um barramento pub/sub — NÃO passa por RLS de tabela e o payload NÃO
 * carrega dado financeiro (só um "ping"). O client reage buscando de novo pela API
 * autenticada (que aplica bar + permissão). Assim a tela atualiza no mesmo segundo em
 * que alguém sobe/aprova/paga, sem expor nada pro anon.
 *
 * Best-effort: qualquer falha é engolida (o poll de fallback cobre).
 */
export async function broadcastPedidoChange(barId: number | null | undefined, event = 'change'): Promise<void> {
  if (!barId) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ topic: `pedidos-pagamento:bar:${barId}`, event, payload: {} }],
      }),
    });
  } catch {
    // silencioso — o auto-refresh por poll garante consistência mesmo sem o push.
  }
}
