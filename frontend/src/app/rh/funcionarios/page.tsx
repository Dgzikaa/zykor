'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Users, Loader2, Search, Plus, ChevronRight } from 'lucide-react';
import { FuncionarioDialog } from './_components/FuncionarioDialog';
import { DossieDialog } from './_components/DossieDialog';

export type Funcionario = {
  id: number; nome: string; cpf: string | null; telefone: string | null; email: string | null;
  data_admissao: string | null; data_demissao: string | null; data_nascimento: string | null;
  cargo_id: number | null; area_id: number | null; cargo_nome: string | null; area_nome: string | null;
  tipo_contratacao: string | null; salario_base: number | null; valor_diaria: number | null;
  vale_transporte_diaria: number | null; dias_trabalho_semana: number | null;
  chave_pix: string | null; tipo_chave_pix: string | null; observacoes: string | null;
  foto_url: string | null; ativo: boolean;
};
export type Opcao = { id: number; nome: string };

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
  const { showToast } = useToast();
  const [lista, setLista] = useState<Funcionario[]>([]);
  const [resumo, setResumo] = useState<{ total: number; ativos: number; freelas: number } | null>(null);
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
      setLista(res.funcionarios || []); setResumo(res.resumo || null);
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

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-5 max-w-5xl">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" /><h1 className="text-xl font-bold">Funcionários</h1>
          </div>
          <Button size="sm" onClick={novo}><Plus className="w-4 h-4 mr-1.5" />Novo funcionário</Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Central de pessoas — cadastro, dossiê e documentos.</p>

        {resumo && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-lg font-bold">{resumo.total}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Ativos</div><div className="text-lg font-bold text-emerald-600">{resumo.ativos}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Freelas</div><div className="text-lg font-bold text-amber-600">{resumo.freelas}</div></CardContent></Card>
          </div>
        )}

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
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : lista.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Users className="w-9 h-9 mx-auto mb-2 opacity-40" />Nenhum funcionário.</CardContent></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b"><tr>
                <th className="text-left px-3 py-2 min-w-[180px]">Nome</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Cargo</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Área</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Tipo</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Tempo de casa</th>
              </tr></thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setDossieId(f.id)}>
                    <td className="px-3 py-1.5">
                      <div className="font-medium flex items-center gap-1">
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        {f.nome}{!f.ativo && <span className="text-[10px] text-muted-foreground ml-1">(inativo)</span>}
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

        <FuncionarioDialog open={formAberto} onClose={() => setFormAberto(false)} onSalvo={onSalvo} cargos={cargos} areas={areas} funcionario={editando} />
        <DossieDialog funcionarioId={dossieId} onClose={() => setDossieId(null)} onEditar={editar} />
      </div>
    </ProtectedRoute>
  );
}
