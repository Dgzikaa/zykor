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
import { Loader2, Network, Search, Cake, Plus, UserPlus, UserMinus, Trash2, Wand2, ZoomIn, ZoomOut, Pencil, ArrowLeftRight } from 'lucide-react';

/**
 * Organograma por CADEIRA, desenhado de cima para baixo como o quadro do Canva.
 *
 * A primeira versão era uma lista indentada e não servia: com a hierarquia vazia viravam 62 raízes
 * soltas, sem estrutura para enxergar ("não to conseguindo ter o organograma claro da empresa").
 * Aqui a leitura é a mesma do desenho que o RH já usa — caixa ligada por linha, chefe em cima,
 * equipe embaixo — e cadeira sem gente aparece como VAGA, que é como se enxerga que falta um chefe
 * de atendimento.
 *
 * O card é a CADEIRA; a pessoa é ocupante. Arrastar a cadeira muda o chefe direto.
 */

type Ocupante = {
  id: number; nome: string; foto_url: string | null; cargo_nome: string | null;
  data_admissao: string | null; data_nascimento: string | null;
  tipo_contratacao: string | null; desde: string | null;
  de_ferias: boolean; com_atestado: boolean;
  cartoes_amarelos: number; cartoes_vermelhos: number;
};
type Cadeira = {
  id: string; codigo: string; cadeira_chefe_id: string | null; ordem: number; observacao: string | null;
  cargo_id: number | null; cargo_nome: string | null;
  area_id: number | null; area_nome: string | null; area_cor: string | null;
  escopo: 'operacao' | 'administrativo';
  ocupante_nome: string | null;   // nome digitado (sócio, que não tem cadastro)
  vaga: boolean; ocupante: Ocupante | null;
};
type SemCadeira = { id: number; nome: string; foto_url: string | null; cargo_nome: string | null };
type Pessoa = { id: number; nome: string; cargo_nome: string | null; sem_cadeira: boolean };
type Opcao = { id: number; nome: string };
type Cargo = { id: number; nome: string; area_id: number | null };
type No = Cadeira & { filhos: No[]; total: number };
type Resposta = { cadeiras: Cadeira[]; sem_cadeira: SemCadeira[]; pessoas: Pessoa[]; cargos: Cargo[]; areas: Opcao[] };

/**
 * O que está sendo arrastado. São duas coisas diferentes e o alvo válido muda:
 *  · uma CADEIRA cai sobre outra cadeira e vira subordinada dela;
 *  · uma PESSOA cai sobre uma cadeira e passa a ocupá-la.
 * Antes só a cadeira era arrastável, e quem estava "sem cadeira" não tinha como entrar arrastando.
 */
type Arrasto = { tipo: 'cadeira'; id: string } | { tipo: 'pessoa'; id: number } | null;

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

export function Organograma({ onAbrirDossie, escopo = 'operacao' }: {
  onAbrirDossie: (id: number) => void;
  /** 'administrativo' = escritório e sócios: o ocupante é um nome digitado, não um cadastro. */
  escopo?: 'operacao' | 'administrativo';
}) {
  const admin = escopo === 'administrativo';
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const { data, isLoading, mutate } = useApiSWR<Resposta>(selectedBar ? `/api/rh/organograma?escopo=${escopo}` : null);
  const cadeiras = useMemo(() => data?.cadeiras || [], [data]);
  const todas = cadeiras;
  const semCadeira = useMemo(() => data?.sem_cadeira || [], [data]);
  const pessoas = useMemo(() => data?.pessoas || [], [data]);

  const [busca, setBusca] = useState('');
  const [arrasto, setArrasto] = useState<Arrasto>(null);
  const arrastando = arrasto?.tipo === 'cadeira' ? arrasto.id : null;
  const [alvo, setAlvo] = useState<string | 'raiz' | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nova, setNova] = useState({ codigo: '', cargo_id: '', area_id: '' });
  const [zoom, setZoom] = useState(1);

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
      if (j.mensagem) showToast({ type: 'success', title: 'Pronto', message: j.mensagem });
      mutate();
      return true;
    } catch (e: any) {
      showToast({ type: 'error', title: erroPadrao, message: e?.message });
      return false;
    } finally {
      setSalvando(false);
    }
  }, [mutate, showToast]);

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
      no.total = no.filhos.reduce((s, f) => s + 1 + contar(f), 0);
      return no.total;
    };
    raizes.forEach(contar);
    raizes.sort((a, b) => b.total - a.total || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
    return { raizes, porId: mapa };
  }, [cadeiras]);

  const descendentes = useMemo(() => {
    if (!arrastando) return new Set<string>();
    const set = new Set<string>();
    const desce = (id: string) => { for (const f of porId.get(id)?.filhos || []) { set.add(f.id); desce(f.id); } };
    desce(arrastando);
    return set;
  }, [arrastando, porId]);

  /** Soltou numa cadeira (ou na faixa do topo, com `null`). */
  const soltar = (destinoId: string | null) => {
    const a = arrasto;
    setArrasto(null); setAlvo(null);
    if (!a) return;

    if (a.tipo === 'pessoa') {
      if (!destinoId) return;                       // pessoa não vira "raiz"
      const cad = porId.get(destinoId);
      if (cad && !cad.vaga) {
        showToast({ type: 'error', title: 'Cadeira ocupada', message: `${cad.ocupante?.nome} já está nessa cadeira. Tire a pessoa antes.` });
        return;
      }
      chamar('POST', { acao: 'alocar', cadeira_id: destinoId, funcionario_id: a.id }, 'Não foi possível alocar');
      return;
    }

    const id = a.id;
    if (destinoId === id) return;
    if (destinoId && descendentes.has(destinoId)) {
      showToast({ type: 'error', title: 'Movimento inválido', message: 'Não dá pra colocar uma cadeira sob a própria equipe.' });
      return;
    }

    // Caixa COM PESSOA solta numa cadeira VAGA é ambígua, e a leitura natural é a que o dono tentou:
    // arrastou o Renato (Chefe de Salão) sobre CHEFE DE CUMINS esperando que ele ASSUMISSE a vaga —
    // e ele virou subordinado. As duas intenções existem, então a escolha fica explícita.
    const origem = porId.get(id);
    const destino = destinoId ? porId.get(destinoId) : null;
    if (origem?.ocupante && destino?.vaga) {
      const assumir = window.confirm(
        `${origem.ocupante.nome} sobre a cadeira ${destino.codigo}, que está VAGA.\n\n` +
        `OK = ${origem.ocupante.nome} passa a ocupar ${destino.codigo} (a cadeira ${origem.codigo} fica vaga).\n` +
        `Cancelar = a cadeira ${origem.codigo} vira subordinada de ${destino.codigo}.`,
      );
      if (assumir) {
        chamar('POST', { acao: 'alocar', cadeira_id: destino.id, funcionario_id: origem.ocupante.id }, 'Não foi possível alocar');
        return;
      }
    }

    if ((origem?.cadeira_chefe_id ?? null) === destinoId) return;
    chamar('PUT', { cadeira_id: id, cadeira_chefe_id: destinoId }, 'Não foi possível mover a cadeira');
  };

  const criarCadeira = async () => {
    if (!nova.codigo.trim()) return showToast({ type: 'error', title: 'Dê um nome à cadeira' });
    const ok = await chamar('POST', {
      acao: 'criar', codigo: nova.codigo, escopo,
      cargo_id: nova.cargo_id ? Number(nova.cargo_id) : null,
      area_id: nova.area_id ? Number(nova.area_id) : null,
    }, 'Não foi possível criar a cadeira');
    if (ok) { setNova({ codigo: '', cargo_id: '', area_id: '' }); setCriando(false); }
  };

  const buscaNorm = busca.trim().toLowerCase();
  const combina = (c: Cadeira) => !buscaNorm
    || c.codigo.toLowerCase().includes(buscaNorm)
    || (c.ocupante?.nome || '').toLowerCase().includes(buscaNorm)
    || (c.cargo_nome || '').toLowerCase().includes(buscaNorm);

  const vagas = cadeiras.filter((c) => c.vaga).length;
  const semHierarquia = cadeiras.length > 0 && raizes.length === cadeiras.length;

  if (isLoading) return <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;

  // No administrativo o quadro nasce vazio (ninguém foi semeado, porque sócio não é funcionário),
  // então a tela precisa deixar CRIAR — por isso não há early return aqui.
  if (!cadeiras.length && !admin) {
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
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {cadeiras.length} cadeiras · {cadeiras.length - vagas} ocupadas · <strong className="text-amber-600 dark:text-amber-400">{vagas} vagas</strong>
        </span>
        <div className="flex items-center rounded-md border border-input h-9">
          <button className="px-2 h-full hover:bg-muted rounded-l-md" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} aria-label="Diminuir"><ZoomOut className="w-4 h-4" /></button>
          <span className="px-1.5 text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button className="px-2 h-full hover:bg-muted rounded-r-md" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} aria-label="Aumentar"><ZoomIn className="w-4 h-4" /></button>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCriando((v) => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" />Nova cadeira
        </Button>
        {salvando && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {admin && (
        <p className="text-xs text-muted-foreground">
          Escritório e sócios. Aqui o ocupante é um <strong>nome digitado</strong> — sócio não vira cadastro de
          funcionário, então não entra em headcount, CMO nem absenteísmo. Quem é funcionário de verdade
          (ex.: Diego Galdino) pode ser alocado normalmente pelo <UserPlus className="w-3 h-3 inline" />.
        </p>
      )}

      {semHierarquia && !admin && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="py-3 flex flex-wrap items-center gap-3">
            <div className="text-sm flex-1 min-w-[260px]">
              <strong>Nenhuma chefia definida ainda.</strong>
              <span className="block text-xs text-muted-foreground">
                Sem isso são {cadeiras.length} cadeiras soltas e não há organograma para ler. Monto a
                estrutura padrão: <strong>Gerente Operacional</strong> no topo e as seis chefias abaixo
                (Atendimento, Fila, Limpeza/Infra, Bar, Cumins e Cozinha), com o time dentro de cada uma.
                As chefias nascem <strong>vagas</strong> — é assim que aparece que falta um chefe.
              </span>
            </div>
            <Button size="sm" onClick={() => chamar('POST', { acao: 'montar_padrao' }, 'Não foi possível montar')} disabled={salvando}>
              <Wand2 className="w-3.5 h-3.5 mr-1" />Montar estrutura padrão
            </Button>
          </CardContent>
        </Card>
      )}

      {criando && (
        <Card><CardContent className="py-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] text-muted-foreground">Nome da cadeira</label>
            <Input value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value })} placeholder="CHEFE DE ATENDIMENTO" className="h-9" />
          </div>
          {/* Área primeiro: é ela que filtra os cargos (cargo sem área — sócio, freela, gerência —
              aparece em qualquer uma). Trocar de área limpa o cargo, para não sobrar um cargo de
              outra área escolhido antes. */}
          <div>
            <label className="text-[11px] text-muted-foreground block">Área</label>
            <select value={nova.area_id} onChange={(e) => setNova({ ...nova, area_id: e.target.value, cargo_id: '' })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">—</option>
              {(data?.areas || []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block">Cargo</label>
            <select value={nova.cargo_id} onChange={(e) => setNova({ ...nova, cargo_id: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">—</option>
              {(data?.cargos || [])
                .filter((c) => !nova.area_id || c.area_id == null || String(c.area_id) === nova.area_id)
                .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={criarCadeira} disabled={salvando}>Criar</Button>
          <Button size="sm" variant="ghost" onClick={() => setCriando(false)}>Cancelar</Button>
        </CardContent></Card>
      )}

      <p className="text-xs text-muted-foreground">
        Passe o mouse na caixa: <Network className="w-3 h-3 inline" /> escolhe a quem ela responde,
        <Plus className="w-3 h-3 inline" /> cria uma cadeira já abaixo dela (é assim que se monta a
        cadeia: Assistente 1, Assistente 2…) e <UserPlus className="w-3 h-3 inline" /> aloca alguém na vaga.
        Arrastar também funciona, mas o seletor não depende de pontaria.
      </p>

      {/* faixa de soltar = tirar o chefe */}
      <div
        onDragOver={(e) => { e.preventDefault(); setAlvo('raiz'); }}
        onDragLeave={() => setAlvo((a) => (a === 'raiz' ? null : a))}
        onDrop={(e) => { e.preventDefault(); soltar(null); }}
        className={cn('rounded-xl border-2 border-dashed px-3 py-1.5 text-xs text-center transition-colors',
          alvo === 'raiz' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700' : 'border-muted text-muted-foreground')}
      >
        Solte aqui para deixar a cadeira no topo (sem chefe)
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="inline-flex gap-8 items-start p-2 origin-top-left" style={{ transform: `scale(${zoom})` }}>
          {raizes.map((no) => (
            <Ramo key={no.id} no={no}
              arrasto={arrasto} setArrasto={setArrasto}
              alvo={alvo} setAlvo={setAlvo} descendentes={descendentes} soltar={soltar}
              combina={combina} temBusca={!!buscaNorm}
              onAbrirDossie={onAbrirDossie} pessoas={pessoas} chamar={chamar} admin={admin} todas={todas} escopo={escopo} />
          ))}
        </div>
      </div>

      {semCadeira.length > 0 && (
        <Card><CardContent className="py-3">
          <div className="text-xs font-semibold mb-2">
            Sem cadeira ({semCadeira.length})
            <span className="font-normal text-muted-foreground"> — aloque numa cadeira vaga acima</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {semCadeira.map((p) => (
              // arrastável: soltar sobre uma cadeira VAGA aloca. Antes só dava pelo botão da caixa,
              // e quem cadastrava alguém novo ficava sem saber como colocar a pessoa no quadro.
              <span key={p.id} draggable
                onDragStart={() => setArrasto({ tipo: 'pessoa', id: p.id })}
                onDragEnd={() => { setArrasto(null); setAlvo(null); }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs cursor-grab active:cursor-grabbing',
                  arrasto?.tipo === 'pessoa' && arrasto.id === p.id && 'opacity-40',
                )}>
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

/**
 * Um nó e sua subárvore.
 *
 * O time EMPILHA embaixo do chefe; só quem tem equipe própria fica lado a lado. Com 13 garçons
 * abertos na horizontal o quadro fica quilométrico e "fica ruim de enxergar os chefes" — que é o
 * ponto de olhar o organograma. É também o formato do quadro do Canva: uma coluna por chefia.
 */
function Ramo({
  no, arrasto, setArrasto, alvo, setAlvo, descendentes, soltar,
  combina, temBusca, onAbrirDossie, pessoas, chamar, admin, todas, escopo,
}: {
  no: No;
  arrasto: Arrasto; setArrasto: (a: Arrasto) => void;
  alvo: string | 'raiz' | null; setAlvo: (a: string | 'raiz' | null) => void;
  descendentes: Set<string>; soltar: (chefeId: string | null) => void;
  combina: (c: Cadeira) => boolean; temBusca: boolean; onAbrirDossie: (id: number) => void;
  pessoas: Pessoa[];
  chamar: (m: 'PUT' | 'POST', corpo: Record<string, unknown>, erro: string) => Promise<boolean>;
  admin: boolean;
  /** lista chapada, para o seletor de chefe não depender de acertar o arrastar */
  todas: Cadeira[];
  escopo: 'operacao' | 'administrativo';
}) {
  const temFilhos = no.filhos.length > 0;
  // Empilha quando nenhum filho tem equipe própria — é o time de um chefe. Se algum filho for chefe
  // de alguém, os ramos vão lado a lado para cada um abrir a sua coluna.
  const empilhar = temFilhos && no.filhos.every((f) => f.filhos.length === 0);

  return (
    <div className="flex flex-col items-center">
      <Caixa no={no} arrasto={arrasto} setArrasto={setArrasto} alvo={alvo} setAlvo={setAlvo}
        descendentes={descendentes} soltar={soltar} combina={combina} temBusca={temBusca}
        onAbrirDossie={onAbrirDossie} pessoas={pessoas} chamar={chamar} admin={admin} todas={todas} escopo={escopo} />

      {temFilhos && (empilhar ? (
        /* time do chefe: coluna, com um prumo à esquerda e um traço para cada caixa */
        <>
          <div className="w-px h-3 bg-border" />
          <div className="relative pl-4 pt-1 self-start">
            <div className="absolute left-0 top-0 bottom-3 w-px bg-border" />
            <div className="flex flex-col gap-1.5">
              {no.filhos.map((f) => (
                <div key={f.id} className="relative">
                  <div className="absolute -left-4 top-1/2 w-4 h-px bg-border" />
                  <Caixa no={f} arrasto={arrasto} setArrasto={setArrasto} alvo={alvo} setAlvo={setAlvo}
                    descendentes={descendentes} soltar={soltar} combina={combina} temBusca={temBusca}
                    onAbrirDossie={onAbrirDossie} pessoas={pessoas} chamar={chamar} admin={admin} todas={todas} escopo={escopo} />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* chefias: lado a lado, porque cada uma abre a própria coluna embaixo */
        <>
          <div className="w-px h-4 bg-border" />
          <div className="relative flex items-start gap-5">
            {no.filhos.length > 1 && (
              <div className="absolute top-0 h-px bg-border"
                style={{ left: `calc(50% / ${no.filhos.length})`, right: `calc(50% / ${no.filhos.length})` }} />
            )}
            {no.filhos.map((f) => (
              <div key={f.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-border" />
                <Ramo no={f} arrasto={arrasto} setArrasto={setArrasto} alvo={alvo} setAlvo={setAlvo}
                  descendentes={descendentes} soltar={soltar} combina={combina} temBusca={temBusca}
                  onAbrirDossie={onAbrirDossie} pessoas={pessoas} chamar={chamar} admin={admin} todas={todas} escopo={escopo} />
              </div>
            ))}
          </div>
        </>
      ))}
    </div>
  );
}

function Caixa({
  no, arrasto, setArrasto, alvo, setAlvo, descendentes, soltar,
  combina, temBusca, onAbrirDossie, pessoas, chamar, admin, todas, escopo,
}: {
  no: No;
  arrasto: Arrasto; setArrasto: (a: Arrasto) => void;
  alvo: string | 'raiz' | null; setAlvo: (a: string | 'raiz' | null) => void;
  descendentes: Set<string>; soltar: (chefeId: string | null) => void;
  combina: (c: Cadeira) => boolean; temBusca: boolean; onAbrirDossie: (id: number) => void;
  pessoas: Pessoa[];
  chamar: (m: 'PUT' | 'POST', corpo: Record<string, unknown>, erro: string) => Promise<boolean>;
  admin: boolean;
  /** lista chapada, para o seletor de chefe não depender de acertar o arrastar */
  todas: Cadeira[];
  escopo: 'operacao' | 'administrativo';
}) {
  const [alocando, setAlocando] = useState(false);
  const [mudandoChefe, setMudandoChefe] = useState(false);

  // Arrastar exige pontaria e, numa coluna empilhada, encaixar a caixa no lugar certo vira sorte —
  // por isso existe o seletor: escolher o chefe numa lista é determinístico. Fora da lista ficam a
  // própria cadeira e as que estão abaixo dela, que criariam ciclo.
  const proibidos = useMemo(() => {
    const s = new Set<string>([no.id]);
    const desce = (n: No) => n.filhos.forEach((f) => { s.add(f.id); desce(f); });
    desce(no);
    return s;
  }, [no]);

  const podeReceber = arrasto?.tipo === 'pessoa'
    ? no.vaga                                              // pessoa só entra em cadeira vaga
    : !!arrasto && arrasto.id !== no.id && !descendentes.has(no.id);
  const destacado = temBusca && combina(no);
  const p = no.ocupante;
  const tempo = tempoDeCasa(p?.data_admissao || null);

  return (
    <div
      draggable
      onDragStart={() => setArrasto({ tipo: 'cadeira', id: no.id })}
      onDragEnd={() => { setArrasto(null); setAlvo(null); }}
      onDragOver={(e) => { if (podeReceber) { e.preventDefault(); setAlvo(no.id); } }}
      onDragLeave={() => setAlvo(alvo === no.id ? null : alvo)}
      onDrop={(e) => { e.preventDefault(); if (podeReceber) soltar(no.id); }}
      className={cn(
        'group relative w-[190px] shrink-0 rounded-lg border bg-background px-2 py-1.5 shadow-sm transition-all cursor-grab active:cursor-grabbing',
        alvo === no.id && podeReceber && 'ring-2 ring-indigo-500 border-indigo-500',
        arrasto?.tipo === 'cadeira' && arrasto.id === no.id && 'opacity-40',
        destacado && 'ring-2 ring-amber-400',
        temBusca && !destacado && 'opacity-40',
        no.vaga && 'border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-900/10',
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate" title={no.codigo}>
        {no.codigo}
      </div>

      <div className="flex items-center gap-2 mt-0.5">
        {p ? (
          p.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.foto_url} alt={p.nome} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', corAvatar(p.nome))}>{iniciais(p.nome)}</div>
          )
        ) : (
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-amber-400 shrink-0" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          {p ? (
            <button onClick={() => onAbrirDossie(p.id)} className="text-left w-full">
              <div className="text-xs font-semibold truncate flex items-center gap-1">
                {p.nome.split(' ').slice(0, 2).join(' ')}
                {aniversarioProximo(p.data_nascimento) && (
                  <span title="Aniversário nos próximos 30 dias" className="shrink-0 leading-none"><Cake className="w-3 h-3 text-pink-500" /></span>
                )}
              </div>
              {/* selos: quem está fora hoje e o histórico de cartões */}
              {(p.de_ferias || p.com_atestado || p.cartoes_amarelos > 0 || p.cartoes_vermelhos > 0) && (
                <div className="flex items-center gap-1 mt-0.5">
                  {p.de_ferias && (
                    <span title="De férias hoje" className="text-[9px] rounded px-1 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">férias</span>
                  )}
                  {p.com_atestado && (
                    <span title="Com atestado hoje" className="text-[9px] rounded px-1 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">atestado</span>
                  )}
                  {p.cartoes_amarelos > 0 && (
                    <span title={`${p.cartoes_amarelos} cartão(ões) amarelo(s)`} className="text-[9px] rounded px-1 bg-amber-400 text-amber-950 font-bold tabular-nums">{p.cartoes_amarelos}</span>
                  )}
                  {p.cartoes_vermelhos > 0 && (
                    <span title={`${p.cartoes_vermelhos} cartão(ões) vermelho(s)`} className="text-[9px] rounded px-1 bg-rose-600 text-white font-bold tabular-nums">{p.cartoes_vermelhos}</span>
                  )}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground truncate">
                {/* cargo da CADEIRA; se ela não tiver, mostra o da pessoa em vez de "sem cargo" */}
                {no.cargo_nome || p.cargo_nome || 'sem cargo'}{tempo && ` · ${tempo}`}
              </div>
            </button>
          ) : no.ocupante_nome ? (
            // administrativo: nome digitado, sem cadastro por trás — por isso não abre dossiê
            <div>
              <div className="text-xs font-semibold truncate" title={no.ocupante_nome}>{no.ocupante_nome}</div>
              <div className="text-[10px] text-muted-foreground truncate">{no.cargo_nome || 'sem cadastro'}</div>
            </div>
          ) : (
            <div>
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400">VAGA</div>
              <div className="text-[10px] text-muted-foreground truncate">{no.cargo_nome || no.area_nome || 'sem cargo'}</div>
            </div>
          )}
        </div>
      </div>

      {no.total > 0 && (
        <span className="absolute -top-2 -right-2 text-[10px] rounded-full bg-muted border px-1.5 tabular-nums" title={`${no.total} cadeira(s) abaixo`}>
          {no.total}
        </span>
      )}

      {mudandoChefe && (
        <select defaultValue={no.cadeira_chefe_id || ''}
          onChange={(e) => { chamar('PUT', { cadeira_id: no.id, cadeira_chefe_id: e.target.value || null }, 'Não foi possível mover'); setMudandoChefe(false); }}
          onBlur={() => setMudandoChefe(false)}
          className="mt-1 w-full h-7 rounded border border-input bg-background px-1 text-[10px]">
          <option value="">— sem chefe (topo) —</option>
          {todas.filter((c) => !proibidos.has(c.id))
            .slice().sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }))
            .map((c) => <option key={c.id} value={c.id}>{c.codigo}</option>)}
        </select>
      )}

      <div className="absolute -bottom-2 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {/* responde a quem: sem depender de acertar o arrastar */}
        <button onClick={() => setMudandoChefe((v) => !v)} title="Escolher a quem esta cadeira responde"
          className="rounded bg-background border p-0.5 text-muted-foreground hover:text-indigo-600"><Network className="w-3 h-3" /></button>

        {/* cria já pendurada aqui — é o jeito de montar a cadeia (Assistente 1, Assistente 2…) */}
        <button
          onClick={() => {
            const codigo = window.prompt(`Nova cadeira ABAIXO de ${no.codigo}.\n\nNome da cadeira:`, '');
            if (!codigo?.trim()) return;
            chamar('POST', {
              acao: 'criar', codigo, escopo,
              cadeira_chefe_id: no.id, cargo_id: no.cargo_id, area_id: no.area_id,
            }, 'Não foi possível criar');
          }}
          title="Criar uma cadeira abaixo desta"
          className="rounded bg-background border p-0.5 text-muted-foreground hover:text-emerald-600"><Plus className="w-3 h-3" /></button>

        {/* administrativo: escrever/limpar o nome direto na cadeira (sócio não tem cadastro) */}
        {admin && !no.ocupante && (
          <button
            onClick={() => {
              const atual = no.ocupante_nome || '';
              const nome = window.prompt(`Quem ocupa "${no.codigo}"?\n\nDeixe em branco para marcar a cadeira como vaga.`, atual);
              if (nome === null) return;
              chamar('POST', { acao: 'nomear', cadeira_id: no.id, ocupante_nome: nome }, 'Não foi possível salvar o nome');
            }}
            title="Escrever o nome de quem ocupa"
            className="rounded bg-background border p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
        )}
        {no.vaga ? (
          pessoas.length > 0 && (alocando ? (
            <select defaultValue=""
              onChange={(e) => { if (e.target.value) { chamar('POST', { acao: 'alocar', cadeira_id: no.id, funcionario_id: Number(e.target.value) }, 'Não foi possível alocar'); setAlocando(false); } }}
              onBlur={() => setAlocando(false)}
              className="h-6 rounded border border-input bg-background px-1 text-[10px]">
              <option value="">escolha…</option>
              {/* quem já está em outra cadeira também aparece: alocar fecha a ocupação anterior,
                  então dá para remanejar sem ter que tirar da cadeira antes */}
              {pessoas.map((s) => <option key={s.id} value={s.id}>{s.sem_cadeira ? s.nome : `${s.nome} (mover)`}</option>)}
            </select>
          ) : (
            <button onClick={() => setAlocando(true)} title="Alocar alguém nesta cadeira"
              className="rounded bg-background border p-0.5 text-muted-foreground hover:text-foreground"><UserPlus className="w-3 h-3" /></button>
          ))
        ) : (
          <button
            onClick={() => { if (window.confirm(`Tirar ${p?.nome} da cadeira ${no.codigo}? A cadeira fica vaga e o histórico é mantido.`)) chamar('POST', { acao: 'desalocar', cadeira_id: no.id }, 'Não foi possível desalocar'); }}
            title="Tirar a pessoa desta cadeira"
            className="rounded bg-background border p-0.5 text-muted-foreground hover:text-foreground"><UserMinus className="w-3 h-3" /></button>
        )}
        <button
          onClick={() => {
            const destino = admin ? 'operacao' : 'administrativo';
            if (window.confirm(`Mover ${no.codigo} para o organograma ${admin ? 'da operação' : 'administrativo'}?\n\nEla entra no topo de lá e as subordinadas sobem para o chefe atual.`)) {
              chamar('POST', { acao: 'mover_escopo', cadeira_id: no.id, escopo: destino }, 'Não foi possível mover');
            }
          }}
          title={admin ? 'Mover para o organograma da operação' : 'Mover para o organograma administrativo'}
          className="rounded bg-background border p-0.5 text-muted-foreground hover:text-indigo-600"><ArrowLeftRight className="w-3 h-3" /></button>
        {no.vaga && no.filhos.length === 0 && (
          <button
            onClick={() => { if (window.confirm(`Remover a cadeira ${no.codigo}?`)) chamar('POST', { acao: 'remover', cadeira_id: no.id }, 'Não foi possível remover'); }}
            title="Remover cadeira"
            className="rounded bg-background border p-0.5 text-muted-foreground hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
        )}
      </div>
    </div>
  );
}
