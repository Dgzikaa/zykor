/**
 * @camada bronze
 * @jobName contahub-caixa-turno-sync
 * @descricao Coleta a "Saída de dinheiro do caixa" (sangria) por turno do ContaHub.
 *
 * Fonte: GerenciaCmd/getRelatorioTurnoHtml (HTML, seção "Lançamentos do CAIXA").
 * Nenhum execQuery expõe isso — o relatório de turno em HTML é a única fonte.
 * Login reutiliza UsuarioCmd/login (SHA-1 da senha -> set-cookie), igual ao
 * contahub-sync-automatico. Escreve em bronze.bronze_contahub_caixa_turno
 * (idempotente por bar_id, trn, num_lancamento).
 *
 * Payload:
 *   { bar_id?, data_date?, data_inicio?, data_fim?, jitter_min_ms?, jitter_max_ms? }
 *   - sem bar_id  -> processa bares [3, 4]
 *   - sem data    -> ontem (BRT)
 *   - range       -> data_inicio..data_fim (inclusive)
 *   - jitter_*    -> delay aleatório entre requisições (anti-robô). Default 1500..4500.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BASE = "https://sp.contahub.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const BARES_PADRAO = [3, 4];

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function generateTimestamp(): string {
  const n = new Date();
  const p = (v: number, l = 2) => String(v).padStart(l, "0");
  return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}${p(n.getMilliseconds(), 3)}`;
}

function ontemBRT(): string {
  const agora = new Date(Date.now() - 3 * 3600 * 1000); // UTC-3
  agora.setUTCDate(agora.getUTCDate() - 1);
  return agora.toISOString().slice(0, 10);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function jitter(min: number, max: number): Promise<void> {
  const ms = Math.floor(min + Math.random() * Math.max(0, max - min));
  return sleep(ms);
}

async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loginContaHub(email: string, password: string): Promise<string> {
  const passwordSha1 = await sha1Hex(password);
  const body = new URLSearchParams({ usr_email: email, usr_password_sha1: passwordSha1 });
  const res = await fetch(`${BASE}/rest/contahub.cmds.UsuarioCmd/login/${generateTimestamp()}?emp=0`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA, Accept: "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`Login ContaHub falhou (${email}): ${res.status} ${res.statusText}`);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("Login ContaHub sem set-cookie");
  return cookie;
}

// ---- Parse do HTML do relatório de turno ---------------------------------
// Extrai o primeiro valor monetário BR de uma célula. signed=true respeita o
// "-" antes do R$ (Saídas às vezes vêm "-R$1200,00", às vezes "R$1200,00").
function brToNum(s: string | undefined, signed = false): number | null {
  if (!s) return null;
  const m = s.replace(/&nbsp;/g, " ").match(/(-?)\s*R\$\s*([\d.]+),(\d{2})/);
  if (!m) return null;
  const val = parseFloat(m[2].replace(/\./g, "") + "." + m[3]);
  return signed && m[1] === "-" ? -val : val;
}
const strip = (s: string | undefined) => (s || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
const norm = (s: string) => s.toLowerCase().replace(/[áàâã]/g,'a').replace(/[éê]/g,'e').replace(/í/g,'i').replace(/[óôõ]/g,'o').replace(/[úü]/g,'u').replace(/ç/g,'c').trim();

interface LinhaCaixa {
  linha_tipo: string;
  chave: string;
  num_lancamento: number | null;
  descricao: string;
  entrada: number | null;
  saida: number | null;
  diferenca: number | null;
  obs: string;
}

function classify(descricao: string, num: number | null): string {
  if (num !== null) return "lancamento";
  const d = norm(descricao);
  if (d.includes("turno anterior")) return "turno_anterior";
  if (d.includes("inicio declarado")) return "inicio_declarado";
  if (d.includes("recebimentos em dinheiro")) return "recebimentos_dinheiro";
  if (d.includes("saldo final")) return "saldo_final";
  if (d.includes("lancamentos do caixa")) return "header";
  return "outro";
}

// Captura a seção "Lançamentos do CAIXA" INTEIRA (entradas, saídas e resumos).
function parseLancamentosCaixa(html: string): LinhaCaixa[] {
  const start = html.indexOf("Lançamentos do CAIXA");
  if (start < 0) return [];
  const tableStart = html.lastIndexOf("<table", start);
  const tableEnd = html.indexOf("</table>", start);
  if (tableStart < 0 || tableEnd < 0) return [];
  const table = html.slice(tableStart, tableEnd);

  const out: LinhaCaixa[] = [];
  for (const row of table.split(/<tr[^>]*>/i).slice(1)) {
    const cells = row.split(/<td[^>]*>/i).slice(1).map((c) => c.replace(/<\/td>[\s\S]*/i, ""));
    if (cells.length < 2) continue;

    const numRaw = strip(cells[0]);
    const num = /^\d+$/.test(numRaw) ? parseInt(numRaw, 10) : null;
    const descricao = strip(cells[1]);
    const linha_tipo = classify(descricao, num);
    if (linha_tipo === "header") continue;

    const entrada = brToNum(cells[2]);
    const saida = brToNum(cells[3]); // magnitude (ignora sinal) — valor que saiu
    const obs = strip(cells[4]);
    // "Dif:" (Início Declarado) costuma cair na coluna Obs; com sinal
    const diferenca = brToNum(/dif/i.test(obs) ? obs : (/dif/i.test(descricao) ? descricao : undefined), true);

    // pula linhas sem nenhum sinal útil
    if (entrada === null && saida === null && diferenca === null && linha_tipo === "outro") continue;

    const chave = num !== null ? `lanc:${num}` : (linha_tipo !== "outro" ? linha_tipo : `outro:${norm(descricao).slice(0, 60)}`);
    out.push({ linha_tipo, chave, num_lancamento: num, descricao, entrada, saida, diferenca, obs });
  }
  return out;
}

// ---- Auth (mesmo padrão de validateCronOrJWT do projeto) ------------------
// Deploy com verify_jwt=true -> a plataforma Supabase já valida o JWT antes da
// função rodar. Aqui basta aceitar qualquer Bearer presente OU o cron secret.
function autorizado(req: Request): boolean {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === Deno.env.get("CRON_SECRET")) return true;
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  return /^Bearer\s+.+/i.test(auth);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!autorizado(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const {
      bar_id, data_date, data_inicio, data_fim,
      jitter_min_ms = 1500, jitter_max_ms = 4500,
    } = JSON.parse((await req.text()) || "{}");

    const bares: number[] = bar_id ? [Number(bar_id)] : BARES_PADRAO;
    const dtIni = data_inicio || data_date || ontemBRT();
    const dtFim = data_fim || data_date || dtIni;

    const resumo: any[] = [];

    for (const bar of bares) {
      // Credenciais + emp
      const { data: cred, error: credErr } = await supabase
        .from("api_credentials")
        .select("username, password, configuracoes")
        .eq("sistema", "contahub").eq("bar_id", bar).single();
      if (credErr || !cred) { resumo.push({ bar, erro: `sem credencial contahub (${credErr?.message || "não encontrada"})` }); continue; }
      const emp = String(cred.configuracoes?.empresa_id ?? "");
      if (!emp) { resumo.push({ bar, erro: "emp_id (empresa_id) não configurado" }); continue; }

      // Turnos do período (fonte: vendasperiodo)
      const { data: turnosRaw, error: trnErr } = await supabase
        .schema("bronze")
        .from("bronze_contahub_avendas_vendasperiodo")
        .select("trn, trn_dtgerencial")
        .eq("bar_id", bar)
        .gte("trn_dtgerencial", dtIni)
        .lte("trn_dtgerencial", dtFim)
        .not("trn", "is", null);
      if (trnErr) { resumo.push({ bar, erro: `falha ao resolver turnos: ${trnErr.message}` }); continue; }

      // Dedupe trn -> data
      const turnoMap = new Map<number, string>();
      for (const t of turnosRaw || []) if (t.trn != null) turnoMap.set(Number(t.trn), t.trn_dtgerencial);
      const turnos = [...turnoMap.entries()].sort((a, b) => a[0] - b[0]);

      if (turnos.length === 0) { resumo.push({ bar, emp, turnos: 0, msg: "nenhum turno no período" }); continue; }

      const cookie = await loginContaHub(cred.username, cred.password);
      let lancGravados = 0, saidasGravadas = 0, turnosOk = 0;

      for (let i = 0; i < turnos.length; i++) {
        const [trn, dt] = turnos[i];
        await jitter(jitter_min_ms, jitter_max_ms); // anti-robô

        const url = `${BASE}/rest/contahub.cmds.GerenciaCmd/getRelatorioTurnoHtml/${generateTimestamp()}?emp=${emp}&trn=${trn}`;
        const res = await fetch(url, { headers: { Cookie: cookie, "User-Agent": UA, Accept: "text/html" } });
        if (!res.ok) { resumo.push({ bar, trn, erro: `HTTP ${res.status}` }); continue; }
        const html = await res.text();
        const lancs = parseLancamentosCaixa(html);
        turnosOk++;
        if (lancs.length === 0) continue;

        const rows = lancs.map((l) => ({
          bar_id: bar, emp_id: emp, trn, dt_gerencial: dt,
          linha_tipo: l.linha_tipo, num_lancamento: l.num_lancamento, descricao: l.descricao,
          entrada: l.entrada, saida: l.saida, diferenca: l.diferenca, obs: l.obs,
          chave: l.chave, source: "getRelatorioTurnoHtml", updated_at: new Date().toISOString(),
        }));
        const { error: upErr } = await supabase
          .schema("bronze")
          .from("bronze_contahub_caixa_turno")
          .upsert(rows, { onConflict: "bar_id,trn,chave" });
        if (upErr) { resumo.push({ bar, trn, erro: `upsert: ${upErr.message}` }); continue; }
        lancGravados += rows.length;
        saidasGravadas += rows.filter((r) => r.saida != null && r.saida > 0).length;
      }

      resumo.push({ bar, emp, turnos: turnos.length, turnos_ok: turnosOk, lancamentos: lancGravados, saidas: saidasGravadas });
    }

    return new Response(JSON.stringify({ success: true, periodo: { dtIni, dtFim }, resumo }), {
      headers: { ...cors, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      headers: { ...cors, "Content-Type": "application/json" }, status: 500,
    });
  }
});
