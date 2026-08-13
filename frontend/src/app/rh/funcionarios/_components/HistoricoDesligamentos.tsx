'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { cn } from '@/lib/utils';
import { Loader2, Search, UserMinus, Download, ArrowRightLeft, LogOut } from 'lucide-react';
import type { Funcionario } from '../page';

/**
 * Histórico de quem já passou pela casa.
 *
 * Fonte: o próprio cadastro. A aba "Tempo de Casa" da planilha "Indicadores - RH"
 * é importada pelo sync (`tempo-de-casa`), que preenche data de desligamento,
 * se foi voluntário/involuntário e o motivo.
 */

const fmtData = (d: string | null) => {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

const diasDeCasa = (admissao: string | null, demissao: string | null) => {
  if (!admissao || !demissao) return null;
  const dias = Math.round((new Date(demissao).getTime() - new Date(admissao).getTime()) / 864e5);
  return dias >= 0 ? dias : null;
};

const formatarPermanencia = (dias: number | null) => {
  if (dias == null) return '—';
  if (dias < 30) return `${dias} d`;
  const meses = Math.floor(dias / 30.44);
  if (meses < 12) return `${meses} m`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto ? `${anos}a ${resto}m` : `${anos}a`;
};

const tagTipo = (t: string | null) =>
  t === 'Involuntário' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  : t === 'Voluntário' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
  : 'bg-muted text-muted-foreground';

export function HistoricoDesligamentos({ onAbrirDossie }: { onAbrirDossie: (id: number) => void }) {
  const { selectedBar } = useBar();
  const [q, setQ] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [ano, setAno] = useState('');

  // ativo=0 traz os inativos; o corte de "desligado" é ter data de desligamento
  // (inativo sem data é cadastro antigo/duplicado, não uma saída registrada).
  const { data, isLoading } = useApiSWR<{ funcionarios: Funcionario[] }>(
    selectedBar ? '/api/rh/funcionarios?ativo=0' : null,
  );

  const desligados = useMemo(() => {
    const lista = (data?.funcionarios || []).filter((f) => !!f.data_demissao);
    return lista.sort((a, b) => String(b.data_demissao).localeCompare(String(a.data_demissao)));
  }, [data]);

  const anos = useMemo(
    () => [...new Set(desligados.map((f) => String(f.data_demissao).slice(0, 4)))].sort().reverse(),
    [desligados],
  );

  const filtrados = useMemo(() => {
    const busca = q.trim().toLowerCase();
    return desligados.filter((f) => {
      if (busca && !f.nome.toLowerCase().includes(busca) && !(f.cargo_nome || '').toLowerCase().includes(busca)) return false;
      if (filtroTipo && (f as any).tipo_desligamento !== filtroTipo) return false;
      if (ano && !String(f.data_demissao).startsWith(ano)) return false;
      return true;
    });
  }, [desligados, q, filtroTipo, ano]);

  const resumo = useMemo(() => {
    const involuntarios = filtrados.filter((f) => (f as any).tipo_desligamento === 'Involuntário').length;
    const voluntarios = filtrados.filter((f) => (f as any).tipo_desligamento === 'Voluntário').length;
    const permanencias = filtrados.map((f) => diasDeCasa(f.data_admissao, f.data_demissao)).filter((d): d is number => d != null);
    const media = permanencias.length ? Math.round(permanencias.reduce((a, b) => a + b, 0) / permanencias.length) : null;
    return { involuntarios, voluntarios, media };
  }, [filtrados]);

  const exportarCSV = () => {
    const head = ['Nome', 'Cargo', 'Área', 'Admissão', 'Desligamento', 'Tempo de casa (dias)', 'Tipo', 'Motivo'];
    const linhas = filtrados.map((f) => [
      f.nome, f.cargo_nome || '', f.area_nome || '', f.data_admissao || '', f.data_demissao || '',
      String(diasDeCasa(f.data_admissao, f.data_demissao) ?? ''),
      (f as any).tipo_desligamento || '', (f as any).motivo_desligamento || '',
    ]);
    // Separador ';' e BOM porque o Excel pt-BR abre assim sem pedir importação.
    const csv = [head, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_desligamentos_${selectedBar?.id || ''}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;

  if (!desligados.length) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <UserMinus className="w-9 h-9 mx-auto mb-2 opacity-40" />
        Nenhum desligamento registrado ainda.
        <div className="text-xs mt-1">O histórico vem da aba &quot;Tempo de Casa&quot; da planilha Indicadores - RH.</div>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou cargo…" className="pl-8" />
        </div>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Voluntário e involuntário</option>
          <option value="Voluntário">Só voluntários</option>
          <option value="Involuntário">Só involuntários</option>
        </select>
        <select value={ano} onChange={(e) => setAno(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <Button variant="outline" size="sm" className="h-9" onClick={exportarCSV} disabled={!filtrados.length}>
          <Download className="w-4 h-4 mr-1.5" />CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini icon={UserMinus} label="Desligamentos" valor={String(filtrados.length)} />
        <Mini icon={LogOut} label="Pediram pra sair" valor={String(resumo.voluntarios)} cor="text-sky-600 dark:text-sky-400" />
        <Mini icon={ArrowRightLeft} label="Empresa desligou" valor={String(resumo.involuntarios)} cor="text-red-600 dark:text-red-400" />
        <Mini icon={UserMinus} label="Permanência média" valor={formatarPermanencia(resumo.media)} />
      </div>

      <Card className="p-0 overflow-x-auto rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2 min-w-[180px]">Nome</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Cargo</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Admissão</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Desligamento</th>
              <th className="text-right px-3 py-2 whitespace-nowrap">Tempo de casa</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Tipo</th>
              <th className="text-left px-3 py-2 min-w-[160px]">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((f) => {
              const dias = diasDeCasa(f.data_admissao, f.data_demissao);
              return (
                <tr
                  key={f.id}
                  onClick={() => onAbrirDossie(f.id)}
                  className="border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <td className="px-3 py-1.5 font-medium">{f.nome}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{f.cargo_nome || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{fmtData(f.data_admissao)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(f.data_demissao)}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                    {formatarPermanencia(dias)}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className={cn('text-[10px] rounded px-1.5 py-0.5', tagTipo((f as any).tipo_desligamento))}>
                      {(f as any).tipo_desligamento || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{(f as any).motivo_desligamento || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtrados.length && (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum desligamento com esses filtros.</div>
        )}
      </Card>
    </div>
  );
}

function Mini({ icon: Icon, label, valor, cor }: { icon: any; label: string; valor: string; cor?: string }) {
  return (
    <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />{label}
        </div>
        <div className={cn('text-xl font-bold mt-1 leading-none tabular-nums', cor)}>{valor}</div>
      </CardContent>
    </Card>
  );
}
