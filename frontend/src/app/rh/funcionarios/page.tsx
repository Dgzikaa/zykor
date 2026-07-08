'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Users, Loader2, Search, Plus, ChevronRight, AlertTriangle, LayoutDashboard, TrendingUp, LayoutGrid, List, Download, Network } from 'lucide-react';
import { FuncionarioDialog } from './_components/FuncionarioDialog';
import { DossieDialog } from './_components/DossieDialog';
import { DashboardRH } from './_components/DashboardRH';
import { IndicadoresRH } from './_components/IndicadoresRH';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';

export type Funcionario = {
  id: number; nome: string; cpf: string | null; telefone: string | null; email: string | null;
  data_admissao: string | null; data_demissao: string | null; data_nascimento: string | null;
  cargo_id: number | null; area_id: number | null; cargo_nome: string | null; area_nome: string | null;
  tipo_contratacao: string | null; salario_base: number | null; valor_diaria: number | null;
  vale_transporte_diaria: number | null; dias_trabalho_semana: number | null;
  chave_pix: string | null; tipo_chave_pix: string | null; observacoes: string | null;
  foto_url: string | null; ativo: boolean; portal_token?: string | null;
  alertas?: { tipo: string; label: string; nivel: string }[];
};
export type Opcao = { id: number; nome: string };

const AVATAR_CORES = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
];
const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const corAvatar = (nome: string) => { let h = 0; for (const c of nome) h = (h + c.charCodeAt(0)) % AVATAR_CORES.length; return AVATAR_CORES[h]; };
const tempoDeCasa = (admissao: string | null) => {
  if (!admissao) return '—';
  const d = new Date(admissao); const now = new Date();
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m--;
  if (m < 0) return '—';
  const anos = Math.floor(m / 12); const meses = m % 12;
  return anos > 0 ? `${anos}a ${meses}m` : `${meses}m`;
};

export default function FuncionariosPage() {
  const { selectedBar } = useBar();
  const { soLeitura } = useModuloPermissao('/rh/funcionarios');
  const { showToast } = useToast();
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('👥 Funcionários');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const [lista, setLista] = useState<Funcionario[]>([]);
  const [cargos, setCargos] = useState<Opcao[]>([]);
  const [areas, setAreas] = useState<Opcao[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('1');

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [dossieId, setDossieId] = useState<number | null>(null);
  const [vista, setVista] = useState<'cards' | 'tabela'>('cards');

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (filtroArea) sp.set('area_id', filtroArea);
      if (filtroTipo) sp.set('tipo', filtroTipo);
      if (filtroAtivo) sp.set('ativo', filtroAtivo);
      const res = await api.get(`/api/rh/funcionarios?${sp.toString()}`);
      setLista(res.funcionarios || []);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar funcionários', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, q, filtroArea, filtroTipo, filtroAtivo, showToast]);

  const carregarOpcoes = useCallback(async () => {
    if (!selectedBar) return;
    try { const res = await api.get('/api/rh/funcionarios/opcoes'); setCargos(res.cargos || []); setAreas(res.areas || []); }
    catch { /* silencioso */ }
  }, [selectedBar]);

  useEffect(() => { carregarOpcoes(); }, [carregarOpcoes]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);

  const novo = () => { setEditando(null); setFormAberto(true); };
  const editar = (f: Funcionario) => { setEditando(f); setFormAberto(true); setDossieId(null); };
  const onSalvo = () => { setFormAberto(false); setEditando(null); carregar(); };

  const tipoTag = useMemo(() => (t: string | null) => {
    if (t === 'Freela') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    if (t === 'PJ') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }, []);

  // Organograma: agrupa por área (e ordena por cargo dentro).
  const porArea = useMemo(() => {
    const m = new Map<string, Funcionario[]>();
    for (const f of lista) { const k = f.area_nome || 'Sem área'; const a = m.get(k) || []; a.push(f); m.set(k, a); }
    return Array.from(m.entries()).map(([area, fs]) => ({ area, fs: fs.sort((a, b) => (a.cargo_nome || '').localeCompare(b.cargo_nome || '')) }))
      .sort((a, b) => b.fs.length - a.fs.length);
  }, [lista]);

  const exportarCSV = () => {
    const head = ['Nome', 'CPF', 'Cargo', 'Área', 'Tipo', 'Admissão', 'Tempo de casa', 'Ativo'];
    const linhas = lista.map((f) => [f.nome, f.cpf || '', f.cargo_nome || '', f.area_nome || '', f.tipo_contratacao || '', f.data_admissao || '', tempoDeCasa(f.data_admissao), f.ativo ? 'Sim' : 'Não']);
    const csv = [head, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `funcionarios_${selectedBar?.id || ''}_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        {/* Header com destaque (gradiente) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 p-5 mb-5 shadow-sm">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-white">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="flex items-center gap-2 text-xl font-bold leading-tight">{soLeitura && <BadgeSomenteLeitura />}</h1>
                <p className="text-sm text-white/80">Central de RH — equipe, documentos e indicadores</p>
              </div>
            </div>
            <Button onClick={novo} className="bg-white text-indigo-700 hover:bg-white/90 shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" />Novo funcionário
            </Button>
          </div>
        </div>

        <Tabs defaultValue="visao" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="visao"><LayoutDashboard className="w-4 h-4 mr-1.5" />Visão geral</TabsTrigger>
            <TabsTrigger value="equipe"><Users className="w-4 h-4 mr-1.5" />Equipe</TabsTrigger>
            <TabsTrigger value="organograma"><Network className="w-4 h-4 mr-1.5" />Organograma</TabsTrigger>
            <TabsTrigger value="indicadores"><TrendingUp className="w-4 h-4 mr-1.5" />Indicadores</TabsTrigger>
          </TabsList>

          <TabsContent value="visao">
            <DashboardRH />
          </TabsContent>

          <TabsContent value="indicadores">
            <IndicadoresRH />
          </TabsContent>

          <TabsContent value="equipe">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CPF, email…" className="pl-8" />
              </div>
              <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Todas as áreas</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Todos os tipos</option>
                <option value="CLT">CLT</option><option value="PJ">PJ</option><option value="Freela">Freela</option>
              </select>
              <select value={filtroAtivo} onChange={(e) => setFiltroAtivo(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="1">Ativos</option><option value="0">Inativos</option><option value="">Todos</option>
              </select>
              <div className="flex items-center rounded-md border border-input overflow-hidden h-9">
                <button onClick={() => setVista('cards')} className={`px-2 h-full ${vista === 'cards' ? 'bg-indigo-600 text-white' : 'hover:bg-muted'}`} title="Cards"><LayoutGrid className="w-4 h-4" /></button>
                <button onClick={() => setVista('tabela')} className={`px-2 h-full ${vista === 'tabela' ? 'bg-indigo-600 text-white' : 'hover:bg-muted'}`} title="Tabela"><List className="w-4 h-4" /></button>
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={exportarCSV} disabled={!lista.length}><Download className="w-4 h-4 mr-1.5" />CSV</Button>
            </div>

            {loading ? (
              <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
            ) : lista.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><Users className="w-9 h-9 mx-auto mb-2 opacity-40" />Nenhum funcionário.</CardContent></Card>
            ) : vista === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lista.map((f) => (
                  <Card key={f.id} onClick={() => setDossieId(f.id)} className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${corAvatar(f.nome)}`}>{iniciais(f.nome)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate flex items-center gap-1">{f.nome}{!f.ativo && <span className="text-[10px] text-muted-foreground">(inativo)</span>}</div>
                          <div className="text-xs text-muted-foreground truncate">{[f.cargo_nome, f.area_nome].filter(Boolean).join(' · ') || 'Sem cargo'}</div>
                        </div>
                        {!!f.alertas?.length && <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 inline-flex items-center gap-0.5 shrink-0" title={f.alertas.map((a) => a.label).join(', ')}><AlertTriangle className="w-2.5 h-2.5" />{f.alertas.length}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className={`text-[10px] rounded px-1.5 py-0.5 ${tipoTag(f.tipo_contratacao)}`}>{f.tipo_contratacao || '—'}</span>
                        <span className="text-[11px] text-muted-foreground">{tempoDeCasa(f.data_admissao)} de casa</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-0 overflow-x-auto rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40"><tr>
                    <th className="text-left px-3 py-2 min-w-[200px]">Nome</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">Cargo</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">Área</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">Tipo</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Tempo de casa</th>
                  </tr></thead>
                  <tbody>
                    {lista.map((f) => (
                      <tr key={f.id} className="border-b last:border-0 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer" onClick={() => setDossieId(f.id)}>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${corAvatar(f.nome)}`}>{iniciais(f.nome)}</div>
                            <div className="font-medium flex items-center gap-1 min-w-0">
                              <span className="truncate">{f.nome}</span>{!f.ativo && <span className="text-[10px] text-muted-foreground">(inativo)</span>}
                              {!!f.alertas?.length && (
                                <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 inline-flex items-center gap-0.5 shrink-0" title={f.alertas.map((a) => a.label).join(', ')}>
                                  <AlertTriangle className="w-2.5 h-2.5" />{f.alertas.length}
                                </span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{f.cargo_nome || '—'}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{f.area_nome || '—'}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap"><span className={`text-[10px] rounded px-1.5 py-0.5 ${tipoTag(f.tipo_contratacao)}`}>{f.tipo_contratacao || '—'}</span></td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted-foreground">{tempoDeCasa(f.data_admissao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="organograma">
            {loading ? (
              <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {porArea.map(({ area, fs }) => (
                  <Card key={area} className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold">{area}</div>
                        <span className="text-[11px] rounded-full bg-muted px-2 py-0.5">{fs.length}</span>
                      </div>
                      <div className="space-y-1">
                        {fs.map((f) => (
                          <div key={f.id} onClick={() => setDossieId(f.id)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${corAvatar(f.nome)}`}>{iniciais(f.nome)}</div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{f.nome}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{f.cargo_nome || '—'}</div>
                            </div>
                            <span className={`text-[9px] rounded px-1 py-0.5 shrink-0 ${tipoTag(f.tipo_contratacao)}`}>{f.tipo_contratacao || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <FuncionarioDialog open={formAberto} onClose={() => setFormAberto(false)} onSalvo={onSalvo} cargos={cargos} areas={areas} funcionario={editando} />
        <DossieDialog funcionarioId={dossieId} onClose={() => setDossieId(null)} onEditar={editar} />
      </div>
    </ProtectedRoute>
  );
}
