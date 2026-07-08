'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';

interface ExecLog {
  id: number;
  bar_id: number;
  data_consulta: string;
  executado_em: string;
  triggered_by: string;
  status: string;
  bronze_linhas: number | null;
  silver_linhas: number | null;
  incluidos: number | null;
  excluidos: number | null;
  percentual_stockout: number | null;
  tempo_total_ms: number | null;
  versao_regras: string | null;
  erro_msg: string | null;
}

interface ProdutoSilver {
  raw_id: number;
  prd: string;
  prd_desc: string;
  prd_venda: string;
  prd_ativo: string;
  prd_precovenda: number;
  prd_estoque: number;
  loc_desc: string;
  categoria_mix: string;
  categoria_local: string;
  incluido: boolean;
  motivo_exclusao: string | null;
  regra_aplicada: string | null;
  versao_regras: string;
  processado_em: string;
}

interface Props {
  historico: ExecLog[];
  produtos: ProdutoSilver[];
  barId: number;
  dataSelecionada: string;
}

export function AuditoriaV2Client({ historico, produtos, dataSelecionada }: Props) {
  const router = useRouter();
  const { setPageTitle } = usePageTitle();
  const [busca, setBusca] = useState('');
  const [filtroLocal, setFiltroLocal] = useState<string>('todos');
  const [filtroIncluido, setFiltroIncluido] = useState<string>('todos');
  const [filtroAtivo, setFiltroAtivo] = useState<string>('todos');

  useEffect(() => {
    setPageTitle('🔍 Stockout — Auditoria v2');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const ultimaExec = historico.find(h => h.data_consulta === dataSelecionada);

  const locais = useMemo(() => {
    const s = new Set<string>();
    produtos.forEach(p => p.loc_desc && s.add(p.loc_desc));
    return Array.from(s).sort();
  }, [produtos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter(p => {
      if (q && !p.prd_desc?.toLowerCase().includes(q) && !p.prd?.toLowerCase().includes(q)) return false;
      if (filtroLocal !== 'todos' && p.loc_desc !== filtroLocal) return false;
      if (filtroIncluido === 'incluidos' && !p.incluido) return false;
      if (filtroIncluido === 'excluidos' && p.incluido) return false;
      if (filtroAtivo === 'ativos' && p.prd_ativo !== 'S') return false;
      if (filtroAtivo === 'inativos' && p.prd_ativo === 'S') return false;
      return true;
    });
  }, [produtos, busca, filtroLocal, filtroIncluido, filtroAtivo]);

  const stats = useMemo(() => {
    const total = produtos.length;
    const incluidos = produtos.filter(p => p.incluido).length;
    const inativos = produtos.filter(p => p.prd_ativo !== 'S').length;
    const semVenda = produtos.filter(p => p.prd_venda === 'N').length;
    const stockoutReal = produtos.filter(p => p.incluido && (p.prd_ativo !== 'S' || p.prd_venda === 'N')).length;
    const pctStockout = incluidos > 0 ? (stockoutReal / incluidos) * 100 : 0;
    return { total, incluidos, excluidos: total - incluidos, inativos, semVenda, stockoutReal, pctStockout };
  }, [produtos]);

  const handleData = (nova: string) => {
    router.push(`/ferramentas/stockout/auditoria-v2?data=${nova}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico completo de execuções + estado de cada produto naquele dia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Data:</span>
          <Input
            type="date"
            value={dataSelecionada}
            onChange={e => handleData(e.target.value)}
            className="w-[180px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total produtos (bronze)" value={stats.total} />
        <StatCard label="Incluídos (silver)" value={stats.incluidos} sub={`${stats.excluidos} excluídos`} />
        <StatCard label="Inativos" value={stats.inativos} />
        <StatCard label="Sem venda" value={stats.semVenda} />
        <StatCard
          label="% Stockout real"
          value={`${stats.pctStockout.toFixed(1)}%`}
          accent={stats.pctStockout > 25 ? 'red' : stats.pctStockout > 15 ? 'amber' : 'green'}
        />
      </div>

      {ultimaExec ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {statusIcon(ultimaExec.status)}
              Última execução em {dataSelecionada}: {ultimaExec.status}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Quando</div>
              <div className="font-mono">{new Date(ultimaExec.executado_em).toLocaleString('pt-BR')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Trigger</div>
              <div>{ultimaExec.triggered_by}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Bronze</div>
              <div className="font-mono">{ultimaExec.bronze_linhas ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Silver</div>
              <div className="font-mono">{ultimaExec.silver_linhas ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Tempo</div>
              <div className="font-mono">{ultimaExec.tempo_total_ms ? `${(ultimaExec.tempo_total_ms / 1000).toFixed(1)}s` : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Regras</div>
              <div className="font-mono">{ultimaExec.versao_regras || '—'}</div>
            </div>
            {ultimaExec.erro_msg && (
              <div className="col-span-full mt-2 text-xs bg-red-50 text-red-700 rounded p-2 font-mono">
                ⚠ {ultimaExec.erro_msg}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/40">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Sem registro de execução para {dataSelecionada}. Pode ter sido um backfill manual antes do log existir, ou cron não rodou.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produtos no estoque do dia ({filtrados.length} de {produtos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
            <Input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
            <Select value={filtroLocal} onValueChange={setFiltroLocal}>
              <SelectTrigger>
                <SelectValue placeholder="Local" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os locais</SelectItem>
                {locais.map(l => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroIncluido} onValueChange={setFiltroIncluido}>
              <SelectTrigger>
                <SelectValue placeholder="Incluído" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Incluídos + Excluídos</SelectItem>
                <SelectItem value="incluidos">Só incluídos</SelectItem>
                <SelectItem value="excluidos">Só excluídos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
              <SelectTrigger>
                <SelectValue placeholder="Ativo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Ativos + Inativos</SelectItem>
                <SelectItem value="ativos">Só ativos</SelectItem>
                <SelectItem value="inativos">Só inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-2 px-3">Cód</th>
                  <th className="text-left py-2 px-3">Produto</th>
                  <th className="text-left py-2 px-3 hidden md:table-cell">Local</th>
                  <th className="text-left py-2 px-3 hidden lg:table-cell">Categoria</th>
                  <th className="text-center py-2 px-3">Ativo</th>
                  <th className="text-center py-2 px-3">Venda</th>
                  <th className="text-right py-2 px-3 hidden md:table-cell">Estoque</th>
                  <th className="text-right py-2 px-3 hidden md:table-cell">Preço</th>
                  <th className="text-center py-2 px-3">Incluído</th>
                  <th className="text-left py-2 px-3 hidden lg:table-cell">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 500).map(p => (
                  <tr key={p.raw_id} className={`border-b ${!p.incluido ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`}>
                    <td className="py-2 px-3 font-mono text-xs">{p.prd}</td>
                    <td className="py-2 px-3 max-w-[300px] truncate" title={p.prd_desc}>{p.prd_desc}</td>
                    <td className="py-2 px-3 hidden md:table-cell text-xs">{p.loc_desc}</td>
                    <td className="py-2 px-3 hidden lg:table-cell text-xs">
                      {p.categoria_mix && <Badge variant="outline" className="text-xs mr-1">{p.categoria_mix}</Badge>}
                    </td>
                    <td className="text-center py-2 px-3">
                      <Badge variant={p.prd_ativo === 'S' ? 'default' : 'destructive'} className="text-xs">
                        {p.prd_ativo}
                      </Badge>
                    </td>
                    <td className="text-center py-2 px-3">
                      <Badge variant={p.prd_venda === 'S' ? 'default' : 'secondary'} className="text-xs">
                        {p.prd_venda || '—'}
                      </Badge>
                    </td>
                    <td className="text-right py-2 px-3 hidden md:table-cell font-mono text-xs">{p.prd_estoque?.toFixed(0)}</td>
                    <td className="text-right py-2 px-3 hidden md:table-cell font-mono text-xs">
                      {p.prd_precovenda?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="text-center py-2 px-3">
                      {p.incluido ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 inline" />
                      )}
                    </td>
                    <td className="py-2 px-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {p.motivo_exclusao || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length > 500 && (
              <div className="text-xs text-muted-foreground mt-2 px-3">
                Mostrando 500 de {filtrados.length} resultados. Refine o filtro.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de execuções (últimas 30)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-3">Quando</th>
                <th className="text-left py-2 px-3">Data ref</th>
                <th className="text-left py-2 px-3">Trigger</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Bronze</th>
                <th className="text-right py-2 px-3">Silver</th>
                <th className="text-right py-2 px-3 hidden md:table-cell">% Stockout</th>
                <th className="text-right py-2 px-3 hidden md:table-cell">Tempo</th>
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Sem execuções registradas ainda. O log começa a popular automaticamente a partir de 2026-05-25.</td></tr>
              ) : (
                historico.map(h => (
                  <tr
                    key={h.id}
                    className={`border-b hover:bg-muted/30 cursor-pointer ${h.data_consulta === dataSelecionada ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
                    onClick={() => handleData(h.data_consulta)}
                  >
                    <td className="py-2 px-3 font-mono text-xs">{new Date(h.executado_em).toLocaleString('pt-BR')}</td>
                    <td className="py-2 px-3 font-mono">{h.data_consulta}</td>
                    <td className="py-2 px-3 text-xs">{h.triggered_by}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        {statusIcon(h.status)} {h.status}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3 font-mono">{h.bronze_linhas ?? '—'}</td>
                    <td className="text-right py-2 px-3 font-mono">{h.silver_linhas ?? '—'}</td>
                    <td className="text-right py-2 px-3 hidden md:table-cell font-mono">{h.percentual_stockout?.toFixed(1) ?? '—'}%</td>
                    <td className="text-right py-2 px-3 hidden md:table-cell font-mono">{h.tempo_total_ms ? `${(h.tempo_total_ms / 1000).toFixed(1)}s` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: 'green' | 'amber' | 'red' }) {
  const color = accent === 'red' ? 'text-red-600' : accent === 'amber' ? 'text-amber-600' : accent === 'green' ? 'text-green-700' : '';
  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function statusIcon(status: string) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'skip_bar_fechado') return <Clock className="h-4 w-4 text-blue-500" />;
  if (status.startsWith('erro')) return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertTriangle className="h-4 w-4 text-amber-500" />;
}
