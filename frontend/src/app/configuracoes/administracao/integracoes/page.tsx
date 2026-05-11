'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Search,
  ExternalLink,
  Instagram,
  Unplug,
  Plug,
  Clock,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIA_INFO, ORDEM_CATEGORIAS, type Categoria } from './catalog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IntegracaoApi {
  id: string;
  nome: string;
  descricao: string;
  categoria: Categoria;
  logoLabel: string;
  logoCor: string;
  acento: string;
  global: boolean;
  statusGeral: 'conectada' | 'parcial' | 'desconectada' | 'nao_configurada';
  statusCredencial: 'ok' | 'ausente' | 'expirando' | 'expirado' | 'desativada';
  problemas: string[];
  credencial: {
    fonte: string | null;
    valor_mascarado: Record<string, string | null>;
    expires_at: string | null;
    detalhes_extras: Record<string, unknown>;
  };
  ultimaSync: string | null;
  ultimaSyncStatus: string | null;
  volume7d: number | null;
  crons: string[];
  acoes: Array<{ id: string; label: string; tipo: string; url?: string }>;
}

interface ResumoApi {
  total: number;
  conectadas: number;
  parciais: number;
  desconectadas: number;
  nao_configuradas: number;
}

function StatusBadge({ status }: { status: IntegracaoApi['statusGeral'] }) {
  const cfg = {
    conectada: { label: 'Conectada', icon: CheckCircle2, classe: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
    parcial: { label: 'Atenção', icon: AlertTriangle, classe: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
    desconectada: { label: 'Desconectada', icon: XCircle, classe: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
    nao_configurada: { label: 'Não configurada', icon: HelpCircle, classe: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/30' },
  }[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${cfg.classe}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

function Logo({ label, cor }: { label: string; cor: string }) {
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-sm"
      style={{ backgroundColor: cor }}
    >
      {label}
    </div>
  );
}

function formatarRelativo(iso: string | null): string {
  if (!iso) return 'nunca';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return iso;
  }
}

export default function AdministracaoIntegracoesPage() {
  const { selectedBar } = useBar();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [integracoes, setIntegracoes] = useState<IntegracaoApi[]>([]);
  const [resumo, setResumo] = useState<ResumoApi | null>(null);
  const [filtro, setFiltro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<IntegracaoApi['statusGeral'] | 'todas'>('todas');
  const [detalheAberto, setDetalheAberto] = useState<IntegracaoApi | null>(null);
  const [acaoPendente, setAcaoPendente] = useState<string | null>(null);

  const carregar = async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/configuracoes/administracao/integracoes?bar_id=${selectedBar.id}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Erro');
      setIntegracoes(json.integracoes || []);
      setResumo(json.resumo || null);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBar?.id]);

  // Resultado do OAuth Instagram
  useEffect(() => {
    const igStatus = searchParams.get('ig_status');
    if (!igStatus) return;
    if (igStatus === 'ok') {
      const username = searchParams.get('ig_username');
      toast.success(`Instagram conectado${username ? `: @${username}` : ''}`);
    } else {
      const msg = searchParams.get('ig_msg') || 'erro desconhecido';
      toast.error(`Falha: ${decodeURIComponent(msg)}`);
    }
    window.history.replaceState({}, '', window.location.pathname);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const conectarInstagram = async () => {
    if (!selectedBar?.id) return;
    setAcaoPendente('instagram_connect');
    try {
      const resp = await fetch(`/api/integracoes/instagram/iniciar?bar_id=${selectedBar.id}`);
      const json = await resp.json();
      if (!resp.ok || !json.url) throw new Error(json?.error || 'Falha');
      window.location.href = json.url;
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
      setAcaoPendente(null);
    }
  };

  const desconectarInstagram = async () => {
    if (!selectedBar?.id) return;
    if (!confirm('Desconectar Instagram desse bar? Histórico fica preservado.')) return;
    setAcaoPendente('instagram_disconnect');
    try {
      const resp = await fetch('/api/integracoes/instagram/desconectar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id }),
      });
      if (!resp.ok) throw new Error('Erro');
      toast.success('Instagram desconectado');
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setAcaoPendente(null);
    }
  };

  const executarAcao = (acao: IntegracaoApi['acoes'][number]) => {
    if (acao.tipo === 'instagram_connect') return conectarInstagram();
    if (acao.tipo === 'instagram_disconnect') return desconectarInstagram();
    if (acao.tipo === 'externa' && acao.url) {
      window.open(acao.url, '_blank');
    }
  };

  const integracoesPorCategoria = useMemo(() => {
    const filtradas = integracoes.filter((i) => {
      if (filtroStatus !== 'todas' && i.statusGeral !== filtroStatus) return false;
      if (filtro) {
        const q = filtro.toLowerCase();
        if (!i.nome.toLowerCase().includes(q) && !i.descricao.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const grupos = new Map<Categoria, IntegracaoApi[]>();
    for (const i of filtradas) {
      const arr = grupos.get(i.categoria) || [];
      arr.push(i);
      grupos.set(i.categoria, arr);
    }
    return grupos;
  }, [integracoes, filtro, filtroStatus]);

  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <Card className="card-dark">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Plug className="w-5 h-5 text-emerald-500" />
                Integrações {selectedBar ? `· ${selectedBar.nome}` : ''}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Saúde de todas as conexões externas, credenciais, syncs e volumes.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {resumo && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
              <ResumoCard label="Total" valor={resumo.total} cor="text-gray-700 dark:text-gray-300" onClick={() => setFiltroStatus('todas')} ativo={filtroStatus === 'todas'} />
              <ResumoCard label="Conectadas" valor={resumo.conectadas} cor="text-emerald-600 dark:text-emerald-400" onClick={() => setFiltroStatus('conectada')} ativo={filtroStatus === 'conectada'} />
              <ResumoCard label="Atenção" valor={resumo.parciais} cor="text-amber-600 dark:text-amber-400" onClick={() => setFiltroStatus('parcial')} ativo={filtroStatus === 'parcial'} />
              <ResumoCard label="Desconectadas" valor={resumo.desconectadas} cor="text-red-600 dark:text-red-400" onClick={() => setFiltroStatus('desconectada')} ativo={filtroStatus === 'desconectada'} />
              <ResumoCard label="Sem config" valor={resumo.nao_configuradas} cor="text-gray-500 dark:text-gray-400" onClick={() => setFiltroStatus('nao_configurada')} ativo={filtroStatus === 'nao_configurada'} />
            </div>
          )}

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar integração (ex: ContaHub, Instagram, NIBO)..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cards agrupados por categoria */}
      {ORDEM_CATEGORIAS.map((cat) => {
        const itens = integracoesPorCategoria.get(cat);
        if (!itens || itens.length === 0) return null;
        const info = CATEGORIA_INFO[cat];
        return (
          <div key={cat}>
            <div className="flex items-baseline gap-2 mb-2 px-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{info.nome}</h2>
              <span className="text-xs text-muted-foreground">— {info.descricao}</span>
              <span className="ml-auto text-xs text-muted-foreground">{itens.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {itens.map((item) => (
                <IntegracaoCard
                  key={item.id}
                  item={item}
                  onDetalhe={() => setDetalheAberto(item)}
                  onAcao={executarAcao}
                  acaoPendente={acaoPendente}
                />
              ))}
            </div>
          </div>
        );
      })}

      {integracoes.length > 0 && integracoesPorCategoria.size === 0 && (
        <Card className="card-dark">
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma integração corresponde aos filtros.
          </CardContent>
        </Card>
      )}

      <Dialog open={!!detalheAberto} onOpenChange={(open) => !open && setDetalheAberto(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detalheAberto && <Detalhe item={detalheAberto} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResumoCard({
  label, valor, cor, onClick, ativo,
}: { label: string; valor: number; cor: string; onClick: () => void; ativo: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-all hover:border-primary ${
        ativo ? 'border-primary bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
    </button>
  );
}

function IntegracaoCard({
  item, onDetalhe, onAcao, acaoPendente,
}: {
  item: IntegracaoApi;
  onDetalhe: () => void;
  onAcao: (a: IntegracaoApi['acoes'][number]) => void;
  acaoPendente: string | null;
}) {
  const eAtencao = item.statusGeral === 'parcial';
  const eErro = item.statusGeral === 'desconectada';

  return (
    <Card
      className={`card-dark transition-all hover:shadow-md cursor-pointer ${
        eErro ? 'border-red-500/30' : eAtencao ? 'border-amber-500/30' : ''
      }`}
      onClick={onDetalhe}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Logo label={item.logoLabel} cor={item.logoCor} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm truncate">{item.nome}</h3>
              <StatusBadge status={item.statusGeral} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.descricao}</p>
          </div>
        </div>

        {item.problemas.length > 0 && (
          <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1">
            {item.problemas[0]}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {item.ultimaSync ? formatarRelativo(item.ultimaSync) : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Database className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {item.volume7d != null ? `${item.volume7d.toLocaleString('pt-BR')} novos (7d)` : '—'}
            </span>
          </div>
        </div>

        {item.acoes.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            {item.acoes.map((acao) => {
              const isPendente = acaoPendente === acao.tipo;
              const isConectarIg = acao.tipo === 'instagram_connect';
              const isDesconectar = acao.tipo === 'instagram_disconnect';
              const Icone = isConectarIg ? Instagram : isDesconectar ? Unplug : ExternalLink;
              return (
                <Button
                  key={acao.id}
                  size="sm"
                  variant={isConectarIg ? 'default' : 'outline'}
                  onClick={() => onAcao(acao)}
                  disabled={isPendente}
                  className="text-xs h-7"
                >
                  <Icone className="w-3 h-3 mr-1.5" />
                  {isPendente ? 'Aguarde…' : acao.label}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Detalhe({ item }: { item: IntegracaoApi }) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-3">
          <Logo label={item.logoLabel} cor={item.logoCor} />
          <div className="flex-1">
            <DialogTitle className="flex items-center gap-2">
              {item.nome}
              <StatusBadge status={item.statusGeral} />
            </DialogTitle>
            <DialogDescription className="mt-1">{item.descricao}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        {item.problemas.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">Atenção</p>
            <ul className="text-sm space-y-0.5">
              {item.problemas.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          </div>
        )}

        <SecaoDetalhe titulo="Credencial">
          <Linha k="Fonte" v={item.credencial.fonte || '—'} />
          {item.credencial.expires_at && (
            <Linha k="Expira em" v={`${new Date(item.credencial.expires_at).toLocaleString('pt-BR')} (${formatarRelativo(item.credencial.expires_at)})`} />
          )}
          {Object.entries(item.credencial.valor_mascarado).filter(([, v]) => v).map(([k, v]) => (
            <Linha key={k} k={k} v={v as string} mono />
          ))}
          {Object.keys(item.credencial.detalhes_extras).length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Detalhes adicionais (JSON)
              </summary>
              <pre className="text-[10px] mt-2 p-2 bg-muted/40 rounded overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(item.credencial.detalhes_extras, null, 2)}
              </pre>
            </details>
          )}
        </SecaoDetalhe>

        <SecaoDetalhe titulo="Sincronização">
          <Linha k="Última sync" v={item.ultimaSync ? `${new Date(item.ultimaSync).toLocaleString('pt-BR')} (${formatarRelativo(item.ultimaSync)})` : 'Nunca'} />
          {item.ultimaSyncStatus && <Linha k="Status última sync" v={item.ultimaSyncStatus} />}
          <Linha k="Volume últimos 7 dias" v={item.volume7d != null ? `${item.volume7d.toLocaleString('pt-BR')} registros` : 'sem tabela mapeada'} />
        </SecaoDetalhe>

        {item.crons.length > 0 && (
          <SecaoDetalhe titulo="Jobs agendados">
            <ul className="text-sm space-y-1">
              {item.crons.map((c) => (
                <li key={c} className="font-mono text-xs bg-muted/40 px-2 py-1 rounded">{c}</li>
              ))}
            </ul>
          </SecaoDetalhe>
        )}
      </div>
    </>
  );
}

function SecaoDetalhe({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{titulo}</h4>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function Linha({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={`text-right truncate max-w-[60%] ${mono ? 'font-mono text-xs' : ''}`}>{v}</span>
    </div>
  );
}
