/**
 * Painel Supabase — scrape server-side do Metrics API (Prometheus) e extração de KPIs.
 *
 * O segredo (sb_secret_...) NUNCA vai pro browser: fica em env (SUPABASE_METRICS_SECRET)
 * e a auth Basic é montada aqui no servidor. A rota exige usuário autenticado.
 *
 * Histórico/alertas ficam no Grafana Cloud (scrape do mesmo endpoint). Aqui é só o
 * "estado agora" pro card nativo em Configurações → Painel.
 *
 * Debug: ?debug=1 retorna a lista de nomes de métricas encontradas (pra ajustar KPIs).
 */
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';

export const dynamic = 'force-dynamic';

interface Metric {
  name: string;
  labels: Record<string, string>;
  value: number;
}

function parsePrometheus(text: string): Metric[] {
  const out: Metric[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    let name: string;
    const labels: Record<string, string> = {};
    let rest: string;

    const brace = line.indexOf('{');
    if (brace !== -1) {
      name = line.slice(0, brace);
      const end = line.indexOf('}', brace);
      if (end === -1) continue;
      const labelStr = line.slice(brace + 1, end);
      rest = line.slice(end + 1).trim();
      const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(labelStr)) !== null) {
        labels[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    } else {
      const sp = line.indexOf(' ');
      if (sp === -1) continue;
      name = line.slice(0, sp);
      rest = line.slice(sp + 1).trim();
    }

    const value = parseFloat(rest.split(/\s+/)[0]);
    if (!Number.isNaN(value)) out.push({ name, labels, value });
  }
  return out;
}

const sumBy = (m: Metric[], name: string, f?: (l: Record<string, string>) => boolean) =>
  m.filter((x) => x.name === name && (!f || f(x.labels))).reduce((s, x) => s + x.value, 0);

const firstBy = (m: Metric[], name: string, f?: (l: Record<string, string>) => boolean) =>
  m.find((x) => x.name === name && (!f || f(x.labels)))?.value;

function maxBy(m: Metric[], name: string): number | undefined {
  const vals = m.filter((x) => x.name === name).map((x) => x.value);
  return vals.length ? Math.max(...vals) : undefined;
}

export const GET = withAuth(async ({ request }) => {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  // Basic Auth do Metrics API: username service_role + (Secret key sb_secret_... OU a
  // service_role key já configurada no projeto). Usa o segredo dedicado se existir,
  // senão cai pra SUPABASE_SERVICE_ROLE_KEY (que o app já tem) — sem precisar criar nada.
  const secret = process.env.SUPABASE_METRICS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !secret) {
    return NextResponse.json(
      {
        configured: false,
        error:
          'Faltam envs: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou ' +
          'SUPABASE_METRICS_SECRET = Secret API key sb_secret_...).',
      },
      { status: 200 },
    );
  }

  const url = `${baseUrl}/customer/v1/privileged/metrics`;
  const auth = 'Basic ' + Buffer.from(`service_role:${secret}`).toString('base64');

  let text: string;
  try {
    const resp = await fetch(url, { headers: { Authorization: auth }, cache: 'no-store' });
    if (!resp.ok) {
      return NextResponse.json(
        { configured: true, error: `Metrics API retornou ${resp.status}`, status: resp.status },
        { status: 200 },
      );
    }
    text = await resp.text();
  } catch (e: any) {
    return NextResponse.json(
      { configured: true, error: `Falha ao consultar Metrics API: ${e?.message || e}` },
      { status: 200 },
    );
  }

  const m = parsePrometheus(text);

  if (new URL(request.url).searchParams.get('debug') === '1') {
    const names = Array.from(new Set(m.map((x) => x.name))).sort();
    return NextResponse.json({ configured: true, total_metrics: m.length, nomes: names });
  }

  // ---- KPIs (estado atual). Nomes confirmados contra o endpoint do projeto (2026-06-14). ----
  const conexoes = sumBy(m, 'pg_stat_database_num_backends');
  const maxConex = firstBy(m, 'max_connections_connection_count');

  const blksHit = sumBy(m, 'pg_stat_database_blks_hit_total');
  const blksRead = sumBy(m, 'pg_stat_database_blks_read_total');
  const cacheHitPct = blksHit + blksRead > 0 ? (blksHit / (blksHit + blksRead)) * 100 : null;

  // só o banco real (postgres), sem template0/template1
  const dbSizeBytes =
    sumBy(m, 'pg_database_size_bytes', (l) => l.datname === 'postgres') ||
    sumBy(m, 'pg_database_size_bytes') ||
    null;

  const load1 = firstBy(m, 'node_load1') ?? null;

  const memTotal = firstBy(m, 'node_memory_MemTotal_bytes');
  const memAvail = firstBy(m, 'node_memory_MemAvailable_bytes');
  const memUsedPct = memTotal && memAvail !== undefined ? (1 - memAvail / memTotal) * 100 : null;

  // disco: prioriza /data (onde o banco cresce), depois /, depois o maior filesystem
  const isData = (l: Record<string, string>) => l.mountpoint === '/data';
  const isRoot = (l: Record<string, string>) => l.mountpoint === '/';
  const diskSize =
    firstBy(m, 'node_filesystem_size_bytes', isData) ??
    firstBy(m, 'node_filesystem_size_bytes', isRoot) ??
    maxBy(m, 'node_filesystem_size_bytes');
  const diskAvail =
    firstBy(m, 'node_filesystem_avail_bytes', isData) ??
    firstBy(m, 'node_filesystem_avail_bytes', isRoot) ??
    maxBy(m, 'node_filesystem_avail_bytes');
  const diskUsedPct =
    diskSize && diskAvail !== undefined ? (1 - diskAvail / diskSize) * 100 : null;

  return NextResponse.json({
    configured: true,
    fetched_at: new Date().toISOString(),
    total_metrics: m.length,
    kpis: {
      conexoes_ativas: conexoes || null,
      max_conexoes: maxConex ?? null,
      conexoes_pct: conexoes && maxConex ? (conexoes / maxConex) * 100 : null,
      cache_hit_pct: cacheHitPct,
      db_size_bytes: dbSizeBytes,
      load1,
      memoria_usada_pct: memUsedPct,
      disco_usado_pct: diskUsedPct,
      disco_size_bytes: diskSize ?? null,
    },
  });
});
