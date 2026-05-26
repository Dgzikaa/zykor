'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogEntry {
  id: number;
  bar_id: number;
  ano: number;
  mes: number;
  categoria_nome: string;
  acao: 'insert' | 'update';
  campo: string;
  valor_antes: number | null;
  valor_depois: number | null;
  alterado_por: string | null;
  alterado_em: string;
  origem?: 'planilha' | 'dre_manual';
  descricao?: string | null;
}

const MESES_NOMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmtVal = (v: number | null | undefined, eh_pct: boolean): string => {
  if (v === null || v === undefined) return '—';
  if (eh_pct) return `${Number(v).toFixed(2)}%`;
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const fmtCampo = (campo: string): string => {
  if (campo === 'valor_planejado') return 'Planejado';
  if (campo === 'valor_projetado') return 'Projetado';
  if (campo === 'valor_realizado_manual') return 'Realizado (manual)';
  if (campo === 'dre_manual') return 'DRE manual';
  return campo;
};

const ehPercentual = (cat: string): boolean => cat === 'IMPOSTO/TX MAQ/COMISSAO' || cat === 'CMV';

export function HistoricoOrcamentoTab({ barId }: { barId: number }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetch(`/api/estrategico/orcamentacao/historico?bar_id=${barId}&limit=200`);
      const d = await r.json();
      if (d.success) setLogs(d.data || []);
      else setErro(d.error || 'Erro');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barId]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (erro) return <p className="text-red-500 p-4">{erro}</p>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Histórico de alterações</h2>
          <Badge variant="outline">{logs.length} registros</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} className="gap-1">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Toda alteração em Planejado/Projetado/Realizado é registrada aqui automaticamente.
            Mostra quem mudou, quando, o valor antes e depois.
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma alteração registrada ainda. Quando alguém editar valores, vai aparecer aqui.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Quando</th>
                    <th className="text-left py-2 px-3">Quem</th>
                    <th className="text-left py-2 px-3">Origem</th>
                    <th className="text-left py-2 px-3">Mês</th>
                    <th className="text-left py-2 px-3">Categoria</th>
                    <th className="text-left py-2 px-3">Descrição / Campo</th>
                    <th className="text-right py-2 px-3">Antes</th>
                    <th className="text-center py-2 px-3" />
                    <th className="text-right py-2 px-3">Depois</th>
                    <th className="text-left py-2 px-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const pct = ehPercentual(log.categoria_nome);
                    return (
                      <tr key={`${log.origem || 'planilha'}-${log.id}`} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-3 text-xs text-muted-foreground font-mono">
                          {new Date(log.alterado_em).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <Badge variant={log.alterado_por?.startsWith('cron') || log.alterado_por?.startsWith('import') || log.alterado_por?.startsWith('socio_') ? 'secondary' : 'default'} className="text-[10px]">
                            {log.alterado_por || 'sistema'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <Badge variant={log.origem === 'dre_manual' ? 'outline' : 'secondary'} className="text-[10px]">
                            {log.origem === 'dre_manual' ? 'DRE manual' : 'planilha'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-xs font-medium">
                          {MESES_NOMES[log.mes]}/{String(log.ano).slice(-2)}
                        </td>
                        <td className="py-2 px-3 text-xs">{log.categoria_nome}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {log.descricao ? <span className="text-foreground">{log.descricao}</span> : fmtCampo(log.campo)}
                        </td>
                        <td className="py-2 px-3 text-right text-xs font-mono text-gray-500">
                          {fmtVal(log.valor_antes, pct)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <ArrowRight className="w-3 h-3 text-muted-foreground inline" />
                        </td>
                        <td className="py-2 px-3 text-right text-xs font-mono font-semibold">
                          {fmtVal(log.valor_depois, pct)}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <Badge variant={log.acao === 'insert' ? 'default' : 'outline'} className="text-[10px]">
                            {log.acao}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
