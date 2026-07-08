'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Activity, RefreshCw, Database, HardDrive, Cpu, Gauge, Server, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Kpis {
  conexoes_ativas: number | null;
  max_conexoes: number | null;
  conexoes_pct: number | null;
  cache_hit_pct: number | null;
  db_size_bytes: number | null;
  load1: number | null;
  memoria_usada_pct: number | null;
  disco_usado_pct: number | null;
  disco_size_bytes: number | null;
}

interface MetricsResp {
  configured: boolean;
  error?: string;
  fetched_at?: string;
  total_metrics?: number;
  kpis?: Kpis;
}

// Public dashboard do Grafana Cloud (Supabase). Padrão fixo (não é segredo — já é público);
// sobrescrevível por env se um dia trocar por um embed autenticado.
const GRAFANA_URL =
  process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_URL ||
  'https://zykor.grafana.net/public-dashboards/c7ad8e7c4fbf435086b106300507452c';

function fmtBytes(b: number | null | undefined): string {
  if (b === null || b === undefined) return '—';
  const gb = b / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(b / 1024 ** 2).toFixed(0)} MB`;
}
const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);
const fmtNum = (v: number | null | undefined) => (v === null || v === undefined ? '—' : String(v));

// cor por limiar: "usado" (maior = pior) vs "saude" (maior = melhor)
function corUsado(v: number | null | undefined, amarelo = 70, vermelho = 85): string {
  if (v === null || v === undefined) return 'text-gray-400';
  if (v >= vermelho) return 'text-red-600 dark:text-red-400';
  if (v >= amarelo) return 'text-amber-600 dark:text-amber-400';
  return 'text-green-600 dark:text-green-400';
}
function corSaude(v: number | null | undefined, amarelo = 95, vermelho = 90): string {
  if (v === null || v === undefined) return 'text-gray-400';
  if (v < vermelho) return 'text-red-600 dark:text-red-400';
  if (v < amarelo) return 'text-amber-600 dark:text-amber-400';
  return 'text-green-600 dark:text-green-400';
}

function KpiCard({
  icon, titulo, valor, sub, cor,
}: { icon: React.ReactNode; titulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
          {icon}
          <span className="text-xs font-medium">{titulo}</span>
        </div>
        <div className={cn('text-2xl font-bold font-mono', cor || 'text-gray-900 dark:text-white')}>{valor}</div>
        {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

interface PipelineJob {
  camada: string; kind: string; job_name: string; bar_id: number | null;
  status: string; records_affected: number | null; error_message: string | null;
  idade: string | null; health_color: 'red' | 'yellow' | 'green'; descricao: string | null;
}
function PipelineHealth() {
  const [jobs, setJobs] = useState<PipelineJob[] | null>(null);
  const [resumo, setResumo] = useState<{ total: number; red: number; yellow: number; green: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/configuracoes/painel/pipeline', { cache: 'no-store' });
      const j = await r.json();
      if (j.success) { setJobs(j.jobs); setResumo(j.resumo); }
    } catch { /* noop */ }
  }, []);
  useEffect(() => { carregar(); const id = setInterval(carregar, 60_000); return () => clearInterval(id); }, [carregar]);

  const cor = (c: string) => c === 'red' ? 'bg-rose-500' : c === 'yellow' ? 'bg-amber-400' : 'bg-emerald-500';
  const idadeCurta = (s: string | null) => !s ? '' : s.replace(/\.\d+$/, '').replace(/(\d+) days?/, '$1d').replace(/:\d\d:\d\d$/, m => m.slice(0, 3) + 'h');
  const lista = jobs && !showAll ? jobs.filter(j => j.health_color !== 'green') : jobs || [];

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />Saúde do pipeline de dados
          </CardTitle>
          {resumo && (
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{resumo.green} ok</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{resumo.yellow} atenção</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />{resumo.red} erro</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!jobs ? (
          <div className="h-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
        ) : lista.length === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Tudo rodando normalmente ✓</p>
        ) : (
          <div className="space-y-1.5">
            {lista.map((j, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2">
                <span className={cn('w-2.5 h-2.5 rounded-full flex-none', cor(j.health_color))} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{j.job_name}</span>
                    {j.bar_id && <span className="text-[10px] text-gray-400">bar {j.bar_id}</span>}
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">{j.camada}</span>
                  </div>
                  {j.error_message && <p className="text-xs text-rose-500 truncate">{j.error_message}</p>}
                </div>
                <span className="text-xs text-gray-400 tabular-nums flex-none">{idadeCurta(j.idade)}</span>
              </div>
            ))}
          </div>
        )}
        {jobs && jobs.some(j => j.health_color === 'green') && (
          <button onClick={() => setShowAll(v => !v)} className="mt-3 text-xs text-emerald-600 hover:underline">
            {showAll ? 'Mostrar só o que precisa de atenção' : `Ver todos os ${jobs.length} jobs`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

interface CronJob {
  job: string; schedule: string; status: string | null; ultima: string | null;
  duracao_s: number | null; ha_segundos: number | null; ativo: boolean;
}
function CronStatus() {
  const [jobs, setJobs] = useState<CronJob[] | null>(null);
  const [resumo, setResumo] = useState<{ total: number; problema: number; inativos: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/configuracoes/painel/crons', { cache: 'no-store' });
      const j = await r.json();
      if (j.success) { setJobs(j.jobs); setResumo(j.resumo); }
    } catch { /* noop */ }
  }, []);
  useEffect(() => { carregar(); const id = setInterval(carregar, 120_000); return () => clearInterval(id); }, [carregar]);

  const haQuanto = (s: number | null) => {
    if (s == null) return 'nunca';
    if (s < 90) return 'agora';
    if (s < 5400) return `há ${Math.round(s / 60)} min`;
    if (s < 172800) return `há ${Math.round(s / 3600)} h`;
    return `há ${Math.round(s / 86400)} d`;
  };
  const problema = (j: CronJob) => j.ativo && j.status != null && j.status !== 'succeeded';
  const lista = jobs && !showAll ? jobs.filter(problema) : (jobs || []).filter(j => j.ativo);

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="w-4 h-4 text-blue-600" />Rotinas automáticas (cron)</CardTitle>
          {resumo && (
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{resumo.total - resumo.problema} ok</span>
              {resumo.problema > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />{resumo.problema} com erro</span>}
              {resumo.inativos > 0 && <span className="text-gray-400">{resumo.inativos} inativos</span>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!jobs ? (
          <div className="h-14 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
        ) : lista.length === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Todas as rotinas rodaram com sucesso ✓</p>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-auto">
            {lista.map((j, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2">
                <span className={cn('w-2.5 h-2.5 rounded-full flex-none', problema(j) ? 'bg-rose-500' : 'bg-emerald-500')} />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{j.job}</span>
                  <span className="ml-2 text-[10px] text-gray-400 font-mono">{j.schedule}</span>
                </div>
                <span className="text-xs text-gray-400 tabular-nums flex-none">{haQuanto(j.ha_segundos)}</span>
              </div>
            ))}
          </div>
        )}
        {jobs && (
          <button onClick={() => setShowAll(v => !v)} className="mt-3 text-xs text-blue-600 hover:underline">
            {showAll ? 'Mostrar só o que precisa de atenção' : `Ver todas as ${jobs.filter(j => j.ativo).length} rotinas`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function PainelSupabasePage() {
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('🖥️ Painel');
    return () => setPageTitle('');
  }, [setPageTitle]);
  const [data, setData] = useState<MetricsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroFetch, setErroFetch] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/configuracoes/supabase-metrics', { cache: 'no-store' });
      const j = (await r.json()) as MetricsResp;
      setData(j);
      setErroFetch(null);
    } catch (e: any) {
      setErroFetch(e?.message || 'Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 60_000); // scrape 1x/min, igual ao recomendado
    return () => clearInterval(id);
  }, [carregar]);

  const k = data?.kpis;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Server className="w-6 h-6 text-emerald-600" />
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Saúde da infraestrutura agora (scrape do Metrics API). Histórico e alertas no Grafana.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.fetched_at && (
            <span className="text-xs text-gray-400">
              {new Date(data.fetched_at).toLocaleTimeString('pt-BR')}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); carregar(); }} className="h-9">
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Central de Operações — saúde do pipeline + rotinas automáticas */}
      <PipelineHealth />
      <CronStatus />

      {/* Estados de erro/config */}
      {erroFetch && (
        <Card className="border-red-300 dark:border-red-700">
          <CardContent className="p-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {erroFetch}
          </CardContent>
        </Card>
      )}

      {data && data.configured === false && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" /> Configuração pendente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <p>
              O painel usa a <code>SUPABASE_SERVICE_ROLE_KEY</code> que o projeto já tem.
              Se aparecer esta mensagem, é porque essa env não está disponível neste ambiente.
            </p>
            <p className="text-xs text-gray-500">
              Opcional: definir <code>SUPABASE_METRICS_SECRET</code> (Secret API key sb_secret_…,
              em Project Settings → API Keys) como credencial dedicada. Sempre server-side, nunca no browser.
            </p>
          </CardContent>
        </Card>
      )}

      {data?.configured && data.error && (
        <Card className="border-red-300 dark:border-red-700">
          <CardContent className="p-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {data.error}
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {loading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : k ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<Activity className="w-4 h-4" />} titulo="Conexões ativas"
            valor={`${fmtNum(k.conexoes_ativas)}${k.max_conexoes ? ` / ${k.max_conexoes}` : ''}`}
            sub={k.conexoes_pct !== null ? `${k.conexoes_pct!.toFixed(0)}% do limite` : undefined}
            cor={corUsado(k.conexoes_pct, 60, 80)}
          />
          <KpiCard
            icon={<Gauge className="w-4 h-4" />} titulo="Cache hit (banco)"
            valor={fmtPct(k.cache_hit_pct)} cor={corSaude(k.cache_hit_pct)}
            sub="ideal ≥ 99%"
          />
          <KpiCard
            icon={<Database className="w-4 h-4" />} titulo="Tamanho do banco"
            valor={fmtBytes(k.db_size_bytes)}
          />
          <KpiCard
            icon={<Cpu className="w-4 h-4" />} titulo="Load average (1m)"
            valor={k.load1 !== null ? k.load1!.toFixed(2) : '—'}
          />
          <KpiCard
            icon={<Server className="w-4 h-4" />} titulo="Memória usada"
            valor={fmtPct(k.memoria_usada_pct)} cor={corUsado(k.memoria_usada_pct)}
          />
          <KpiCard
            icon={<HardDrive className="w-4 h-4" />} titulo="Disco usado"
            valor={fmtPct(k.disco_usado_pct)} cor={corUsado(k.disco_usado_pct)}
            sub={k.disco_size_bytes ? `de ${fmtBytes(k.disco_size_bytes)}` : undefined}
          />
        </div>
      ) : null}

      {/* Grafana — histórico e alertas */}
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" />
            Histórico & Alertas (Grafana Cloud)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {GRAFANA_URL ? (
            // O Grafana não permite ser embutido em iframe (frame-ancestors 'none'), então abrimos
            // em nova aba em vez de mostrar uma tela grande com erro de CSP.
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                O histórico completo, os gráficos e os alertas ficam no Grafana Cloud — abre em uma nova aba.
              </p>
              <a href={GRAFANA_URL} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Activity className="w-4 h-4 mr-2" />Abrir dashboard no Grafana
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </a>
            </div>
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
              <p>
                Pra ter histórico e alertas, configure o <strong>Grafana Cloud (free)</strong> pra fazer
                scrape do Metrics API e importe o dashboard oficial da Supabase. Depois defina a URL de embed:
              </p>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded p-2 text-xs overflow-x-auto">
NEXT_PUBLIC_GRAFANA_DASHBOARD_URL=https://...grafana.net/d/.../...?kiosk
              </pre>
              <div className="flex flex-wrap gap-2">
                <a href="https://supabase.com/docs/guides/telemetry/metrics" target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="cursor-pointer">Guia Metrics API <ExternalLink className="w-3 h-3 ml-1" /></Badge>
                </a>
                <a href="https://grafana.com/products/cloud/" target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="cursor-pointer">Grafana Cloud <ExternalLink className="w-3 h-3 ml-1" /></Badge>
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.total_metrics ? (
        <p className="text-[11px] text-gray-400 text-right">{data.total_metrics} métricas lidas do endpoint</p>
      ) : null}
    </div>
  );
}
