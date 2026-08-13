'use client';

import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { getSelectedBarId } from '@/lib/selected-bar';
import { cn } from '@/lib/utils';
import { Loader2, Network, Search, Cake, GripVertical, X, ChevronDown, ChevronRight } from 'lucide-react';

type Pessoa = {
  id: number; nome: string; gestor_id: number | null;
  cargo_nome: string | null; area_nome: string | null; area_cor: string | null;
  foto_url: string | null; data_admissao: string | null; data_nascimento: string | null;
  tipo_contratacao: string | null;
};
type No = Pessoa & { filhos: No[]; total: number };

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
  if (!admissao) return null;
  const d = new Date(admissao); const now = new Date();
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m--;
  if (m < 0) return null;
  const anos = Math.floor(m / 12); const meses = m % 12;
  return anos > 0 ? `${anos}a${meses ? ` ${meses}m` : ''}` : `${meses}m`;
};

/** Aniversário nos próximos 30 dias — a bolinha que a Thaís mantém no Canva à mão. */
const aniversarioProximo = (nascimento: string | null) => {
  if (!nascimento) return false;
  const [, m, d] = nascimento.split('-').map(Number);
  if (!m || !d) return false;
  const hoje = new Date();
  const esteAno = new Date(hoje.getFullYear(), m - 1, d);
  const alvo = esteAno >= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    ? esteAno
    : new Date(hoje.getFullYear() + 1, m - 1, d);
  return (alvo.getTime() - hoje.getTime()) / 864e5 <= 30;
};

export function Organograma({ onAbrirDossie }: { onAbrirDossie: (id: number) => void }) {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const { data, isLoading, mutate } = useApiSWR<{ pessoas: Pessoa[] }>(selectedBar ? '/api/rh/organograma' : null);
  const pessoas = useMemo(() => data?.pessoas || [], [data]);

  const [busca, setBusca] = useState('');
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<number | 'raiz' | null>(null);
  const [recolhidos, setRecolhidos] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState(false);

  // Monta a árvore. Quem aponta pra um gestor que não está na lista (desligado,
  // por exemplo) é tratado como raiz — melhor aparecer solto do que sumir.
  const { raizes, porId } = useMemo(() => {
    const mapa = new Map<number, No>();
    for (const p of pessoas) mapa.set(p.id, { ...p, filhos: [], total: 0 });

    const raizes: No[] = [];
    for (const no of mapa.values()) {
      const pai = no.gestor_id != null ? mapa.get(no.gestor_id) : null;
      if (pai) pai.filhos.push(no); else raizes.push(no);
    }

    const contar = (no: No): number => {
      no.filhos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      no.total = no.filhos.reduce((soma, f) => soma + 1 + contar(f), 0);
      return no.total;
    };
    raizes.forEach(contar);
    raizes.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

    return { raizes, porId: mapa };
  }, [pessoas]);

  // Descendentes do card arrastado: soltar dentro do próprio ramo criaria ciclo.
  // O banco recusaria (trigger), mas é melhor a área nem aceitar o drop.
  const descendentes = useMemo(() => {
    if (arrastando == null) return new Set<number>();
    const set = new Set<number>();
    const desce = (id: number) => {
      const no = porId.get(id);
      for (const f of no?.filhos || []) { set.add(f.id); desce(f.id); }
    };
    desce(arrastando);
    return set;
  }, [arrastando, porId]);

  const definirGestor = useCallback(async (funcionarioId: number, gestorId: number | null) => {
    setSalvando(true);
    try {
      const barId = getSelectedBarId();
      const r = await fetch('/api/rh/organograma', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(barId ? { 'x-selected-bar-id': barId } : {}) },
        credentials: 'include',
        body: JSON.stringify({ funcionario_id: funcionarioId, gestor_id: gestorId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível mudar o gestor');
      mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao mudar o gestor', message: e?.message });
    } finally {
      setSalvando(false);
    }
  }, [mutate, showToast]);

  const soltar = (novoGestor: number | null) => {
    const id = arrastando;
    setArrastando(null); setAlvo(null);
    if (id == null) return;
    if (novoGestor === id) return;
    if (novoGestor != null && descendentes.has(novoGestor)) {
      showToast({ type: 'error', title: 'Movimento inválido', message: 'Não dá pra colocar alguém sob a própria equipe.' });
      return;
    }
    const atual = porId.get(id)?.gestor_id ?? null;
    if (atual === novoGestor) return;
    definirGestor(id, novoGestor);
  };

  const alternarRecolhido = (id: number) => {
    setRecolhidos((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const buscaNorm = busca.trim().toLowerCase();
  const combina = (p: Pessoa) =>
    !buscaNorm || p.nome.toLowerCase().includes(buscaNorm) || (p.cargo_nome || '').toLowerCase().includes(buscaNorm);

  const semGestor = pessoas.filter((p) => p.gestor_id == null).length;

  if (isLoading) return <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;

  if (!pessoas.length) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Network className="w-9 h-9 mx-auto mb-2 opacity-40" />Nenhum funcionário ativo para montar o organograma.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Destacar por nome ou cargo…" className="pl-8" />
        </div>
        <span className="text-xs text-muted-foreground">
          {pessoas.length} pessoas · {semGestor} sem gestor definido
        </span>
        {salvando && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      <p className="text-xs text-muted-foreground">
        Arraste um card para cima de outra pessoa para mudar a quem ela se reporta.
        Solte na faixa abaixo para tirar o gestor e deixar a pessoa no topo.
      </p>

      {/* Área de soltar = virar raiz */}
      <div
        onDragOver={(e) => { e.preventDefault(); setAlvo('raiz'); }}
        onDragLeave={() => setAlvo((a) => (a === 'raiz' ? null : a))}
        onDrop={(e) => { e.preventDefault(); soltar(null); }}
        className={cn(
          'rounded-xl border-2 border-dashed px-3 py-2 text-xs text-center transition-colors',
          alvo === 'raiz' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'border-muted text-muted-foreground',
        )}
      >
        <X className="w-3.5 h-3.5 inline mr-1" />Solte aqui para deixar sem gestor (topo do organograma)
      </div>

      <div className="space-y-1">
        {raizes.map((no) => (
          <Ramo
            key={no.id}
            no={no}
            nivel={0}
            recolhidos={recolhidos}
            alternarRecolhido={alternarRecolhido}
            arrastando={arrastando}
            setArrastando={setArrastando}
            alvo={alvo}
            setAlvo={setAlvo}
            descendentes={descendentes}
            soltar={soltar}
            combina={combina}
            temBusca={!!buscaNorm}
            onAbrirDossie={onAbrirDossie}
          />
        ))}
      </div>
    </div>
  );
}

function Ramo({
  no, nivel, recolhidos, alternarRecolhido, arrastando, setArrastando, alvo, setAlvo,
  descendentes, soltar, combina, temBusca, onAbrirDossie,
}: {
  no: No; nivel: number; recolhidos: Set<number>; alternarRecolhido: (id: number) => void;
  arrastando: number | null; setArrastando: (id: number | null) => void;
  alvo: number | 'raiz' | null; setAlvo: (a: number | 'raiz' | null) => void;
  descendentes: Set<number>; soltar: (gestorId: number | null) => void;
  combina: (p: Pessoa) => boolean; temBusca: boolean; onAbrirDossie: (id: number) => void;
}) {
  const recolhido = recolhidos.has(no.id);
  const temFilhos = no.filhos.length > 0;
  const podeReceber = arrastando != null && arrastando !== no.id && !descendentes.has(no.id);
  const destacado = temBusca && combina(no);
  const tempo = tempoDeCasa(no.data_admissao);
  const aniversario = aniversarioProximo(no.data_nascimento);

  return (
    <div style={{ marginLeft: nivel ? 22 : 0 }} className={nivel ? 'border-l border-dashed border-muted-foreground/25 pl-3' : ''}>
      <div
        draggable
        onDragStart={() => setArrastando(no.id)}
        onDragEnd={() => { setArrastando(null); setAlvo(null); }}
        onDragOver={(e) => { if (podeReceber) { e.preventDefault(); setAlvo(no.id); } }}
        onDragLeave={() => setAlvo(alvo === no.id ? null : alvo)}
        onDrop={(e) => { e.preventDefault(); if (podeReceber) soltar(no.id); }}
        className={cn(
          'group flex items-center gap-2 rounded-xl border bg-background px-2 py-1.5 mb-1 transition-all cursor-grab active:cursor-grabbing',
          alvo === no.id && podeReceber && 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20',
          arrastando === no.id && 'opacity-40',
          destacado && 'ring-2 ring-amber-400',
          temBusca && !destacado && 'opacity-50',
        )}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />

        <button
          onClick={() => temFilhos && alternarRecolhido(no.id)}
          className={cn('w-4 h-4 shrink-0 flex items-center justify-center rounded', temFilhos ? 'hover:bg-muted text-muted-foreground' : 'invisible')}
          aria-label={recolhido ? 'Expandir equipe' : 'Recolher equipe'}
        >
          {recolhido ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {no.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={no.foto_url} alt={no.nome} className="w-8 h-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', corAvatar(no.nome))}>
            {iniciais(no.nome)}
          </div>
        )}

        <button onClick={() => onAbrirDossie(no.id)} className="min-w-0 flex-1 text-left">
          <div className="text-sm font-medium truncate flex items-center gap-1.5">
            {no.nome}
            {aniversario && <Cake className="w-3 h-3 text-pink-500 shrink-0" aria-label="Aniversário nos próximos 30 dias" />}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {no.cargo_nome || 'Sem cargo'}
            {no.area_nome && <span className="opacity-70"> · {no.area_nome}</span>}
            {tempo && <span className="opacity-70"> · {tempo} de casa</span>}
          </div>
        </button>

        {temFilhos && (
          <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 shrink-0 tabular-nums" title={`${no.total} pessoa(s) na equipe`}>
            {no.total}
          </span>
        )}
      </div>

      {!recolhido && no.filhos.map((f) => (
        <Ramo
          key={f.id}
          no={f}
          nivel={nivel + 1}
          recolhidos={recolhidos}
          alternarRecolhido={alternarRecolhido}
          arrastando={arrastando}
          setArrastando={setArrastando}
          alvo={alvo}
          setAlvo={setAlvo}
          descendentes={descendentes}
          soltar={soltar}
          combina={combina}
          temBusca={temBusca}
          onAbrirDossie={onAbrirDossie}
        />
      ))}
    </div>
  );
}
