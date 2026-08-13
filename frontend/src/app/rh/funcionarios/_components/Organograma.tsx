'use client';

import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { getSelectedBarId } from '@/lib/selected-bar';
import { cn } from '@/lib/utils';
import { Loader2, Network, Search, Cake, GripVertical, X, ChevronDown, ChevronRight, Plus, UserPlus, UserMinus, Trash2 } from 'lucide-react';

/**
 * Organograma por CADEIRA, não por pessoa.
 *
 * O card que se arrasta é a CADEIRA (CUMIN 1, CHEFE DE SALÃO 2) e o chefe direto é outra cadeira.
 * A pessoa é um ocupante — pode sair sem desmanchar a estrutura, e cadeira sem ocupante é uma VAGA
 * de verdade, que é o que o recrutamento precisa enxergar.
 */

type Ocupante = {
  id: number; nome: string; foto_url: string | null;
  data_admissao: string | null; data_nascimento: string | null;
  tipo_contratacao: string | null; desde: string | null;
};
type Cadeira = {
  id: string; codigo: string; cadeira_chefe_id: string | null; ordem: number; observacao: string | null;
  cargo_id: number | null; cargo_nome: string | null;
  area_id: number | null; area_nome: string | null; area_cor: string | null;
  vaga: boolean; ocupante: Ocupante | null;
};
type SemCadeira = { id: number; nome: string; foto_url: string | null; cargo_nome: string | null };
type Opcao = { id: number; nome: string };
type No = Cadeira & { filhos: No[]; total: number };
type Resposta = { cadeiras: Cadeira[]; sem_cadeira: SemCadeira[]; cargos: Opcao[]; areas: Opcao[] };

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
  const { data, isLoading, mutate } = useApiSWR<Resposta>(selectedBar ? '/api/rh/organograma' : null);
  const cadeiras = useMemo(() => data?.cadeiras || [], [data]);
  const semCadeira = useMemo(() => data?.sem_cadeira || [], [data]);

  const [busca, setBusca] = useState('');
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | 'raiz' | null>(null);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nova, setNova] = useState({ codigo: '', cargo_id: '', area_id: '' });

  const chamar = useCallback(async (metodo: 'PUT' | 'POST', corpo: Record<string, unknown>, erroPadrao: string) => {
    setSalvando(true);
    try {
      const barId = getSelectedBarId();
      const r = await fetch('/api/rh/organograma', {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(barId ? { 'x-selected-bar-id': barId } : {}) },
        credentials: 'include',
        body: JSON.stringify(corpo),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || erroPadrao);
      mutate();
      return true;
    } catch (e: any) {
      showToast({ type: 'error', title: erroPadrao, message: e?.message });
      return false;
    } finally {
      setSalvando(false);
    }
  }, [mutate, showToast]);

  // Monta a árvore. Cadeira cujo chefe não está na lista vira raiz — melhor solta que sumida.
  const { raizes, porId } = useMemo(() => {
    const mapa = new Map<string, No>();
    for (const c of cadeiras) mapa.set(c.id, { ...c, filhos: [], total: 0 });

    const raizes: No[] = [];
    for (const no of mapa.values()) {
      const pai = no.cadeira_chefe_id ? mapa.get(no.cadeira_chefe_id) : null;
      if (pai) pai.filhos.push(no); else raizes.push(no);
    }

    const contar = (no: No): number => {
      no.filhos.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
      no.total = no.filhos.reduce((soma, f) => soma + 1 + contar(f), 0);
      return no.total;
    };
    raizes.forEach(contar);
    raizes.sort((a, b) => b.total - a.total || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));

    return { raizes, porId: mapa };
  }, [cadeiras]);

  // Descendentes da cadeira arrastada: soltar dentro do próprio ramo criaria ciclo. O banco
  // recusaria (trigger), mas é melhor a área nem aceitar o drop.
  const descendentes = useMemo(() => {
    if (!arrastando) return new Set<string>();
    const set = new Set<string>();
    const desce = (id: string) => {
      const no = porId.get(id);
      for (const f of no?.filhos || []) { set.add(f.id); desce(f.id); }
    };
    desce(arrastando);
    return set;
  }, [arrastando, porId]);

  const soltar = (novoChefe: string | null) => {
    const id = arrastando;
    setArrastando(null); setAlvo(null);
    if (!id) return;
    if (novoChefe === id) return;
    if (novoChefe && descendentes.has(novoChefe)) {
      showToast({ type: 'error', title: 'Movimento inválido', message: 'Não dá pra colocar uma cadeira sob a própria equipe.' });
      return;
    }
    if ((porId.get(id)?.cadeira_chefe_id ?? null) === novoChefe) return;
    chamar('PUT', { cadeira_id: id, cadeira_chefe_id: novoChefe }, 'Não foi possível mover a cadeira');
  };

  const alternarRecolhido = (id: string) => {
    setRecolhidos((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const criarCadeira = async () => {
    if (!nova.codigo.trim()) return showToast({ type: 'error', title: 'Dê um nome à cadeira' });
    const ok = await chamar('POST', {
      acao: 'criar', codigo: nova.codigo,
      cargo_id: nova.cargo_id ? Number(nova.cargo_id) : null,
      area_id: nova.area_id ? Number(nova.area_id) : null,
    }, 'Não foi possível criar a cadeira');
    if (ok) { setNova({ codigo: '', cargo_id: '', area_id: '' }); setCriando(false); }
  };

  const buscaNorm = busca.trim().toLowerCase();
  const combina = (c: Cadeira) =>
    !buscaNorm
    || c.codigo.toLowerCase().includes(buscaNorm)
    || (c.ocupante?.nome || '').toLowerCase().includes(buscaNorm)
    || (c.cargo_nome || '').toLowerCase().includes(buscaNorm);

  const vagas = cadeiras.filter((c) => c.vaga).length;

  if (isLoading) return <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;

  if (!cadeiras.length) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Network className="w-9 h-9 mx-auto mb-2 opacity-40" />Nenhuma cadeira cadastrada para este bar.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Destacar por cadeira, pessoa ou cargo…" className="pl-8" />
        </div>
        <span className="text-xs text-muted-foreground">
          {cadeiras.length} cadeiras · {cadeiras.length - vagas} ocupadas · <strong className="text-amber-600 dark:text-amber-400">{vagas} vagas</strong>
        </span>
        <Button size="sm" variant="outline" onClick={() => setCriando((v) => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" />Nova cadeira
        </Button>
        {salvando && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {criando && (
        <Card><CardContent className="py-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] text-muted-foreground">Nome da cadeira</label>
            <Input value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value })} placeholder="CHEFE DE SALÃO 2" className="h-9" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block">Cargo</label>
            <select value={nova.cargo_id} onChange={(e) => setNova({ ...nova, cargo_id: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">—</option>
              {(data?.cargos || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block">Área</label>
            <select value={nova.area_id} onChange={(e) => setNova({ ...nova, area_id: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">—</option>
              {(data?.areas || []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={criarCadeira} disabled={salvando}>Criar</Button>
          <Button size="sm" variant="ghost" onClick={() => setCriando(false)}>Cancelar</Button>
        </CardContent></Card>
      )}

      <p className="text-xs text-muted-foreground">
        Arraste uma cadeira sobre outra para definir o chefe direto. A pessoa é ocupante da cadeira —
        tirar alguém deixa a cadeira vaga, sem desmanchar a estrutura.
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
        <X className="w-3.5 h-3.5 inline mr-1" />Solte aqui para deixar a cadeira sem chefe (topo do organograma)
      </div>

      <div className="space-y-1">
        {raizes.map((no) => (
          <Ramo
            key={no.id} no={no} nivel={0}
            recolhidos={recolhidos} alternarRecolhido={alternarRecolhido}
            arrastando={arrastando} setArrastando={setArrastando}
            alvo={alvo} setAlvo={setAlvo}
            descendentes={descendentes} soltar={soltar}
            combina={combina} temBusca={!!buscaNorm}
            onAbrirDossie={onAbrirDossie}
            semCadeira={semCadeira}
            chamar={chamar}
          />
        ))}
      </div>

      {semCadeira.length > 0 && (
        <Card><CardContent className="py-3">
          <div className="text-xs font-semibold mb-2">
            Sem cadeira ({semCadeira.length})
            <span className="font-normal text-muted-foreground"> — aloque em alguma cadeira vaga acima</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {semCadeira.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs">
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold', corAvatar(p.nome))}>{iniciais(p.nome)}</div>
                <button onClick={() => onAbrirDossie(p.id)} className="hover:underline">{p.nome}</button>
                {p.cargo_nome && <span className="text-muted-foreground">· {p.cargo_nome}</span>}
              </span>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

function Ramo({
  no, nivel, recolhidos, alternarRecolhido, arrastando, setArrastando, alvo, setAlvo,
  descendentes, soltar, combina, temBusca, onAbrirDossie, semCadeira, chamar,
}: {
  no: No; nivel: number; recolhidos: Set<string>; alternarRecolhido: (id: string) => void;
  arrastando: string | null; setArrastando: (id: string | null) => void;
  alvo: string | 'raiz' | null; setAlvo: (a: string | 'raiz' | null) => void;
  descendentes: Set<string>; soltar: (chefeId: string | null) => void;
  combina: (c: Cadeira) => boolean; temBusca: boolean; onAbrirDossie: (id: number) => void;
  semCadeira: SemCadeira[];
  chamar: (m: 'PUT' | 'POST', corpo: Record<string, unknown>, erro: string) => Promise<boolean>;
}) {
  const recolhido = recolhidos.has(no.id);
  const temFilhos = no.filhos.length > 0;
  const podeReceber = !!arrastando && arrastando !== no.id && !descendentes.has(no.id);
  const destacado = temBusca && combina(no);
  const p = no.ocupante;
  const tempo = tempoDeCasa(p?.data_admissao || null);
  const aniversario = aniversarioProximo(p?.data_nascimento || null);
  const [alocando, setAlocando] = useState(false);

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
          no.vaga && 'border-dashed border-amber-400/70 bg-amber-50/40 dark:bg-amber-900/10',
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

        {p ? (
          p.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.foto_url} alt={p.nome} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', corAvatar(p.nome))}>
              {iniciais(p.nome)}
            </div>
          )
        ) : (
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-amber-400/70 shrink-0" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-muted-foreground truncate">
            {no.codigo}
            {no.area_nome && <span className="font-normal opacity-70"> · {no.area_nome}</span>}
          </div>
          {p ? (
            <button onClick={() => onAbrirDossie(p.id)} className="text-left w-full">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {p.nome}
                {aniversario && <Cake className="w-3 h-3 text-pink-500 shrink-0" aria-label="Aniversário nos próximos 30 dias" />}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {no.cargo_nome || 'Sem cargo'}
                {tempo && <span className="opacity-70"> · {tempo} de casa</span>}
              </div>
            </button>
          ) : (
            <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
              VAGA <span className="text-[11px] font-normal text-muted-foreground">· {no.cargo_nome || 'sem cargo'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {temFilhos && (
            <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 tabular-nums" title={`${no.total} cadeira(s) abaixo`}>
              {no.total}
            </span>
          )}
          {no.vaga ? (
            semCadeira.length > 0 && (
              alocando ? (
                <select defaultValue=""
                  onChange={(e) => { if (e.target.value) { chamar('POST', { acao: 'alocar', cadeira_id: no.id, funcionario_id: Number(e.target.value) }, 'Não foi possível alocar'); setAlocando(false); } }}
                  onBlur={() => setAlocando(false)}
                  className="h-7 rounded-md border border-input bg-background px-1 text-xs">
                  <option value="">escolha…</option>
                  {semCadeira.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              ) : (
                <button onClick={() => setAlocando(true)} title="Alocar alguém nesta cadeira"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground">
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )
            )
          ) : (
            <button
              onClick={() => { if (window.confirm(`Tirar ${p?.nome} da cadeira ${no.codigo}? A cadeira fica vaga e o histórico é mantido.`)) chamar('POST', { acao: 'desalocar', cadeira_id: no.id }, 'Não foi possível desalocar'); }}
              title="Tirar a pessoa desta cadeira"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground">
              <UserMinus className="w-3.5 h-3.5" />
            </button>
          )}
          {no.vaga && !temFilhos && (
            <button
              onClick={() => { if (window.confirm(`Remover a cadeira ${no.codigo}?`)) chamar('POST', { acao: 'remover', cadeira_id: no.id }, 'Não foi possível remover'); }}
              title="Remover cadeira"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!recolhido && no.filhos.map((f) => (
        <Ramo
          key={f.id} no={f} nivel={nivel + 1}
          recolhidos={recolhidos} alternarRecolhido={alternarRecolhido}
          arrastando={arrastando} setArrastando={setArrastando}
          alvo={alvo} setAlvo={setAlvo}
          descendentes={descendentes} soltar={soltar}
          combina={combina} temBusca={temBusca}
          onAbrirDossie={onAbrirDossie}
          semCadeira={semCadeira}
          chamar={chamar}
        />
      ))}
    </div>
  );
}
