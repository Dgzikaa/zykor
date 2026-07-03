/**
 * @camada bronze
 * @jobName sympla-reverificar-cancelados
 * @descricao Detecta pedidos Sympla CANCELADOS que ficaram "fantasma" como aprovados.
 *
 * PROBLEMA: a lista /events/{id}/orders NÃO devolve pedidos cancelados (eles somem),
 * então nosso sync (que usa a lista) nunca atualiza o status — o pedido fica 'A'
 * eterno na nossa base e infla o líquido vs o repasse real.
 *
 * SOLUÇÃO: pagina a lista atual (só aprovados) -> os pedidos que temos como 'A'
 * (net>0) e NÃO estão mais na lista = sumiram = candidatos a cancelamento. Confirma
 * cada um no endpoint de DETALHE (/orders/{order_id} -> order_status) e atualiza.
 *
 * Payload: { bar_id?, event_id?, dias? }
 *  - event_id -> re-verifica só esse evento
 *  - dias (default 30) -> re-verifica eventos com pedidos aprovados nos últimos N dias
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BASE = "https://api.sympla.com.br/public/v3";
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function autorizado(req: Request): boolean {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === Deno.env.get("CRON_SECRET")) return true;
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  return /^Bearer\s+.+/i.test(auth);
}

async function fetchOrderIdsAtuais(token: string, eventId: number): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  for (;;) {
    const res = await fetch(`${BASE}/events/${eventId}/orders?page_size=100&page=${page}`, {
      headers: { s_token: token, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`lista orders ${eventId} p${page}: ${res.status}`);
    const j = await res.json();
    for (const o of j.data || []) ids.add(o.id);
    if (!j.pagination?.has_next) break;
    page++;
    await sleep(200);
  }
  return ids;
}

async function statusDetalhe(token: string, eventId: number, orderId: string): Promise<{ status: string; updated: string | null } | null> {
  const res = await fetch(`${BASE}/events/${eventId}/orders/${orderId}`, {
    headers: { s_token: token, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const j = await res.json();
  const d = j.data;
  return d ? { status: d.order_status, updated: d.updated_date ?? null } : null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!autorizado(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { bar_id = 3, event_id, dias = 30 } = JSON.parse((await req.text()) || "{}");

    // credencial sympla
    const { data: cred, error: credErr } = await supabase
      .from("api_credentials").select("api_token")
      .eq("sistema", "sympla").eq("bar_id", bar_id).single();
    if (credErr || !cred?.api_token) {
      return new Response(JSON.stringify({ error: `sem credencial sympla bar ${bar_id}` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const token = cred.api_token;

    // eventos a verificar
    let eventos: number[];
    if (event_id) {
      eventos = [Number(event_id)];
    } else {
      const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
      const { data: evs } = await supabase.schema("bronze")
        .from("bronze_sympla_pedidos")
        .select("event_id")
        .eq("bar_id", bar_id).eq("order_status", "A").gt("order_total_net_value", 0)
        .gte("approved_date", desde);
      eventos = [...new Set((evs || []).map((e: any) => Number(e.event_id)))];
    }

    const resumo: any[] = [];
    for (const ev of eventos) {
      // pedidos PAGOS que temos como 'A'
      const { data: nossos } = await supabase.schema("bronze")
        .from("bronze_sympla_pedidos")
        .select("order_id, order_total_net_value")
        .eq("bar_id", bar_id).eq("event_id", ev).eq("order_status", "A").gt("order_total_net_value", 0);
      if (!nossos || nossos.length === 0) { resumo.push({ event_id: ev, pagos: 0 }); continue; }

      const atuais = await fetchOrderIdsAtuais(token, ev);
      const sumidos = nossos.filter((o: any) => !atuais.has(o.order_id));

      let cancelados = 0, valorRecuperado = 0;
      for (const o of sumidos) {
        await sleep(150 + Math.floor(Math.random() * 250));
        const det = await statusDetalhe(token, ev, o.order_id);
        if (det && det.status !== "A") {
          await supabase.schema("bronze")
            .from("bronze_sympla_pedidos")
            .update({ order_status: det.status, updated_date: det.updated, synced_at: new Date().toISOString() })
            .eq("bar_id", bar_id).eq("order_id", o.order_id);
          cancelados++;
          valorRecuperado += Number(o.order_total_net_value) || 0;
        }
      }
      resumo.push({ event_id: ev, pagos: nossos.length, na_lista: atuais.size, sumidos: sumidos.length, cancelados, valor_recuperado: Number(valorRecuperado.toFixed(2)) });
    }

    return new Response(JSON.stringify({ success: true, bar_id, resumo }), { headers: { ...cors, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { headers: { ...cors, "Content-Type": "application/json" }, status: 500 });
  }
});
