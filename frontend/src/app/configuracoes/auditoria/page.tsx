'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Search, Download, Filter, User, Clock, Database, Loader2 } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/lib/api-client';

interface AuditLog {
  id: string;
  timestamp: string;
  bar_id: number | null;
  operation: string;
  table_name: string | null;
  record_id: string | null;
  user_email: string | null;
  user_role: string | null;
  description: string;
  old_values: any;
  new_values: any;
  severity: string;
  category: string | null;
  endpoint: string | null;
  method: string | null;
}

const PAGE = 100;

const opColor = (op: string) => {
  const t = (op || '').toUpperCase();
  if (t.includes('DELETE')) return 'bg-red-500';
  if (t.includes('UPDATE')) return 'bg-amber-500';
  if (t.includes('INSERT') || t.includes('CREATE')) return 'bg-blue-500';
  if (t.includes('LOGIN')) return 'bg-emerald-500';
  if (t.includes('LOGOUT')) return 'bg-gray-500';
  return 'bg-violet-500';
};

const fmtData = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

// colunas de "carimbo" que mudam sozinhas — não são alteração de conteúdo, ignora no diff
const IGN_DIFF = new Set(['atualizado_em', 'updated_at', 'criado_em', 'created_at', 'atualizado_por', 'updated_by', 'timestamp']);
const fmtVal = (v: any) => {
  if (v === null || v === undefined || v === '') return '∅';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 48 ? s.slice(0, 48) + '…' : s;
};
// campos que mudaram numa edição: [{campo, de, para}]
const diffCampos = (l: { operation: string; old_values: any; new_values: any }) => {
  if (l.operation !== 'UPDATE' || !l.old_values || !l.new_values) return [];
  const o = l.old_values, n = l.new_values;
  const out: { campo: string; de: any; para: any }[] = [];
  for (const k of Object.keys(n)) {
    if (IGN_DIFF.has(k)) continue;
    if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) out.push({ campo: k, de: o[k], para: n[k] });
  }
  return out;
};
// rótulo humano do registro (pra INSERT/DELETE): nome/descrição/código do que foi criado/removido
const rotuloRegistro = (l: { new_values: any; old_values: any }) => {
  const r = l.new_values || l.old_values || {};
  const v = r.nome ?? r.descricao ?? r.titulo ?? r.insumo_codigo ?? r.codigo ?? r.email ?? null;
  return v != null ? String(v) : null;
};

export default function AuditoriaPage() {
  const { setPageTitle } = usePageTitle();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [operacoes, setOperacoes] = useState<string[]>([]);
  const [tabelas, setTabelas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [auto, setAuto] = useState(true); // tempo real ligado por padrão (polling)

  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [operation, setOperation] = useState('');
  const [table, setTable] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => { setPageTitle('🛡️ Auditoria'); return () => setPageTitle(''); }, [setPageTitle]);

  const carregar = useCallback(async (novoOffset = 0, append = false, silent = false) => {
    if (!silent) setLoading(true);
    setErro(null);
    try {
      const p = new URLSearchParams({ limit: String(PAGE), offset: String(novoOffset) });
      if (de) p.set('de', de);
      if (ate) p.set('ate', ate);
      if (operation) p.set('operation', operation);
      if (table) p.set('table', table);
      if (q.trim()) p.set('q', q.trim());
      const r = await api.get(`/api/configuracoes/auditoria?${p.toString()}`);
      if (!r.success) throw new Error(r.error || 'Falha ao carregar');
      setLogs(prev => append ? [...prev, ...(r.logs || [])] : (r.logs || []));
      setTotal(r.total || 0);
      setOffset(novoOffset);
      if (r.operacoes) setOperacoes(r.operacoes);
      if (r.tabelas) setTabelas(r.tabelas);
    } catch (e: any) {
      setErro(e?.message || 'Erro');
      if (!append) setLogs([]);
    } finally { setLoading(false); }
  }, [de, ate, operation, table, q]);

  useEffect(() => { carregar(0, false); /* carga inicial */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tempo real: enquanto ligado, recarrega a 1ª página a cada 10s sem piscar o spinner
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => carregar(0, false, true), 10000);
    return () => clearInterval(t);
  }, [auto, carregar]);

  const buscar = () => carregar(0, false);
  const limpar = () => { setDe(''); setAte(''); setOperation(''); setTable(''); setQ(''); setTimeout(() => carregar(0, false), 0); };

  const exportarCSV = () => {
    const head = ['data', 'usuario', 'papel', 'operacao', 'tabela', 'registro', 'descricao', 'bar'];
    const linhas = logs.map(l => [fmtData(l.timestamp), l.user_email || '', l.user_role || '', l.operation, l.table_name || '', l.record_id || '', (l.description || '').replace(/"/g, '""'), l.bar_id ?? '']);
    const csv = [head, ...linhas].map(r => r.map(c => `"${String(c)}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[calc(100vh-8px)] bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 py-3 pb-6 max-w-[98vw] space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-violet-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Auditoria</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Quem fez o quê no sistema — criação, edição e exclusão de registros.</p>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4" />Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block text-gray-500">De</label>
                <Input type="date" value={de} onChange={e => setDe(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block text-gray-500">Até</label>
                <Input type="date" value={ate} onChange={e => setAte(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block text-gray-500">Operação</label>
                <select value={operation} onChange={e => setOperation(e.target.value)} className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
                  <option value="">Todas</option>
                  {operacoes.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block text-gray-500">Tabela</label>
                <select value={table} onChange={e => setTable(e.target.value)} className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
                  <option value="">Todas</option>
                  {tabelas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block text-gray-500">Buscar (usuário, descrição, ID)</label>
                <Input placeholder="ex.: joao@…, produção 12" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} className="h-9" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <Button onClick={buscar} size="sm" className="flex items-center gap-1"><Search className="h-4 w-4" />Buscar</Button>
              <Button variant="outline" size="sm" onClick={limpar}>Limpar</Button>
              <button onClick={() => setAuto(v => !v)} title="Atualiza a lista automaticamente a cada 10s"
                className={`inline-flex items-center gap-1.5 h-8 rounded-md border px-2.5 text-sm transition ${auto ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                <span className={`w-2 h-2 rounded-full ${auto ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
                Tempo real
              </button>
              <Button variant="outline" size="sm" onClick={exportarCSV} disabled={!logs.length} className="ml-auto flex items-center gap-1"><Download className="h-4 w-4" />Exportar CSV</Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registros</CardTitle>
            <CardDescription>{loading && !logs.length ? 'Carregando…' : `${logs.length} de ${total} registro(s)`}</CardDescription>
          </CardHeader>
          <CardContent>
            {erro ? (
              <div className="text-center py-8 text-red-600 dark:text-red-400 text-sm">{erro}</div>
            ) : loading && !logs.length ? (
              <div className="text-center py-10"><Loader2 className="h-7 w-7 animate-spin mx-auto text-gray-400" /></div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                Nenhum registro para os filtros atuais. A trilha registra criação, edição e exclusão em todo o sistema conforme as ações são feitas.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(l => { const diffs = diffCampos(l); const rot = rotuloRegistro(l); return (
                  <div key={l.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge className={`${opColor(l.operation)} text-white`}>{l.operation}</Badge>
                          {l.table_name && <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Database className="h-3 w-3" />{l.table_name}{l.record_id ? ` · #${l.record_id}` : ''}</span>}
                          {l.bar_id != null && <span className="text-[11px] text-gray-400">bar {l.bar_id}</span>}
                        </div>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {l.operation === 'UPDATE' ? `Editou ${l.table_name?.split('.').pop() || 'registro'}${l.record_id ? ` #${l.record_id}` : ''}`
                            : l.operation === 'INSERT' ? `Criou ${l.table_name?.split('.').pop() || 'registro'}${rot ? `: ${rot}` : ''}`
                            : l.operation === 'DELETE' ? `Excluiu ${l.table_name?.split('.').pop() || 'registro'}${rot ? `: ${rot}` : ''}`
                            : l.description}
                        </p>
                        {/* diff amigável na própria linha: campo antigo → novo */}
                        {diffs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {diffs.slice(0, 8).map((d, i) => (
                              <span key={i} className="inline-flex items-center gap-1 text-[11px] rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15 px-1.5 py-0.5">
                                <span className="font-medium text-gray-700 dark:text-gray-200">{d.campo}</span>
                                <span className="text-gray-500 line-through">{fmtVal(d.de)}</span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium text-emerald-700 dark:text-emerald-400">{fmtVal(d.para)}</span>
                              </span>
                            ))}
                            {diffs.length > 8 && <span className="text-[11px] text-gray-400 self-center">+{diffs.length - 8} campos</span>}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{l.user_email || 'sistema'}{l.user_role ? ` (${l.user_role})` : ''}</span>
                          {(l.old_values || l.new_values) && (
                            <details>
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-700">ver dados</summary>
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {l.old_values && (
                                  <div><div className="text-[10px] uppercase text-gray-400 mb-0.5">Antes / excluído</div>
                                    <pre className="p-2 bg-gray-100 dark:bg-gray-900 rounded text-[11px] overflow-auto max-h-64">{JSON.stringify(l.old_values, null, 2)}</pre></div>
                                )}
                                {l.new_values && (
                                  <div><div className="text-[10px] uppercase text-gray-400 mb-0.5">Depois</div>
                                    <pre className="p-2 bg-gray-100 dark:bg-gray-900 rounded text-[11px] overflow-auto max-h-64">{JSON.stringify(l.new_values, null, 2)}</pre></div>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-gray-500 whitespace-nowrap inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtData(l.timestamp)}</div>
                    </div>
                  </div>
                ); })}
                {logs.length < total && (
                  <div className="text-center pt-2">
                    <Button variant="outline" size="sm" onClick={() => carregar(offset + PAGE, true)} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Carregar mais (${total - logs.length} restantes)`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
