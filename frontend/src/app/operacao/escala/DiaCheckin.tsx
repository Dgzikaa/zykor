'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { ChevronLeft, ChevronRight, Loader2, Search, Check, UserPlus } from 'lucide-react';

/**
 * VISÃO DIA da Escala — quem está escalado hoje e o check do líder.
 *
 * Veio da aba Check-ins que morava no RH. Mudou de lugar porque a operação já vive na Escala:
 * mandar o líder abrir outra aba dentro do RH pra dizer quem veio era atrito puro.
 *
 * DESENHADA PRO CELULAR, que é onde o líder está quando faz isso:
 *  - uma linha por pessoa, alta o suficiente pro dedo;
 *  - um chip só com o status atual, em vez de cinco botões espremidos;
 *  - tocar o chip ABRE a linha com as cinco opções em botões grandes e escritas.
 *
 * Por que não o "toque que cicla o status" (1x presente, 2x atrasado...): com cinco estados,
 * chegar em "Escala errada" custa cinco toques, passar do ponto obriga a dar a volta inteira, e
 * nada na tela diz qual é o próximo. Funciona com dois ou três estados, não com cinco.
 *
 * E o líder quase não toca em nada: a lista já vem preenchida com o que o PONTO sugere, então
 * ele só corrige a exceção e aperta Salvar.
 */

type Linha = {
  funcionario_id: number; nome: string; funcao_nome: string | null;
  hora_inicio: string | null; hora_fim: string | null;
  entrada: string | null; ponto_situacao: string | null; atraso_min: number | null;
  checkin_status: string | null; fora_escala: boolean;
  sugestao: 'ok' | 'ok_atraso' | 'falta' | null;
  /** líder direto, do organograma — é por ele que a lista do dia se separa */
  lider_id: number | null; lider_nome: string | null;
};
type Elegivel = { id: number; nome: string };
type Resposta = {
  data: string; linhas: Linha[]; equipe_de: string | null; elegiveis?: Elegivel[];
  resumo: { escalados: number; marcados: number; pendentes: number; faltas: number };
};

/** As mesmas cinco opções que existiam no check-in do RH. */
const OPCOES = [
  { id: 'ok', label: 'Presente', cls: 'bg-emerald-600 text-white border-emerald-600' },
  { id: 'ok_atraso', label: 'Presente c/ atraso', cls: 'bg-amber-500 text-white border-amber-500' },
  { id: 'atestado', label: 'Atestado', cls: 'bg-sky-600 text-white border-sky-600' },
  { id: 'escala_errada', label: 'Não está na escala', cls: 'bg-slate-500 text-white border-slate-500' },
  { id: 'falta', label: 'Faltou', cls: 'bg-rose-600 text-white border-rose-600' },
] as const;

const rotulo = (id: string | null) => OPCOES.find(o => o.id === id)?.label ?? 'marcar';
const corDe = (id: string | null) => OPCOES.find(o => o.id === id)?.cls
  ?? 'bg-transparent text-muted-foreground border-dashed border-[hsl(var(--border))]';

/**
 * Hoje no fuso de QUEM ESTÁ OLHANDO, não em UTC.
 *
 * `toISOString()` devolve UTC: às 21h no Brasil já é o dia seguinte lá, então a tela abria em
 * amanhã — justamente no horário em que o líder faz o check-in do turno da noite. Pego em
 * produção no teste de 19/08/2026, 22h: a tela abriu em 20/08.
 */
const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hojeISO = () => localISO(new Date());
const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return localISO(d);
};
const fmtBR = (iso: string) => iso.split('-').reverse().join('/');
/** o Postgres devolve `time` como 17:00:00 — a operação lê 17:00 */
const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : '');
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function DiaCheckin({ soLeitura }: { soLeitura: boolean }) {
  const { showToast } = useToast();
  const [dia, setDia] = useState(hojeISO());
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** o que o líder escolheu nesta sessão — sobrepõe o gravado e a sugestão */
  const [escolha, setEscolha] = useState<Record<number, string>>({});

  const { data, isLoading, mutate } = useApiSWR<Resposta>(`/api/operacao/escala/dia?data=${dia}`);
  const linhas = useMemo(() => data?.linhas || [], [data]);
  const elegiveis = data?.elegiveis || [];

  /**
   * "Veio e não estava escalado". A grade semanal não aceita mais nome digitado (a escala
   * espelha o organograma), então é aqui que o líder registra quem apareceu — que é justamente
   * o caso de escala não feita.
   */
  const [addAberto, setAddAberto] = useState(false);
  const [addPessoa, setAddPessoa] = useState('');
  const adicionar = async () => {
    if (!addPessoa) return;
    try {
      const r = await api.post('/api/operacao/escala/dia', {
        data: dia, acao: 'adicionar', funcionario_id: Number(addPessoa),
      });
      showToast({ type: 'success', title: 'Adicionado ao dia', message: `${r.adicionado} entrou como "fora da escala".` });
      setAddPessoa(''); setAddAberto(false);
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não adicionou', message: e?.message });
    }
  };

  const trocarDia = (novo: string) => { setDia(novo); setEscolha({}); setAberta(null); };

  /** status efetivo: o que o líder escolheu > o que já estava gravado > o que o ponto sugere */
  const statusDe = useCallback(
    (l: Linha) => escolha[l.funcionario_id] ?? l.checkin_status ?? l.sugestao ?? null,
    [escolha],
  );

  /**
   * Vai pro servidor tudo que DIFERE do gravado — inclusive a sugestão do ponto que o líder
   * aceitou sem tocar. Se só mandasse o que ele clicou, conferir a lista e apertar Salvar não
   * registraria nada, que é justamente o caso comum.
   */
  const pendentes = useMemo(
    () => linhas.filter(l => { const s = statusDe(l); return s && s !== l.checkin_status; }),
    [linhas, statusDe],
  );

  const visiveis = useMemo(() => {
    const q = semAcento(busca.trim());
    return !q ? linhas : linhas.filter(l => semAcento(l.nome).includes(q) || semAcento(l.funcao_nome || '').includes(q));
  }, [linhas, busca]);

  /**
   * AGRUPADO POR LÍDER DIRETO — a mesma divisão que decide quem enxerga quem (Rodrigo,
   * 20/08/2026: "tem como deixar separado por líder? na mesma separação de pra quem aparece").
   *
   * No Ordinário são 56 pessoas num dia: a lista corrida não se lê, e o líder tem que caçar a
   * gente dele no meio da casa toda. Quem não tem chefe na cadeira cai em "Sem líder direto",
   * que além de honesto serve de alerta de cadeira de chefia vaga.
   *
   * Grupos ordenados pelo maior primeiro; "Sem líder direto" sempre por último.
   */
  const grupos = useMemo(() => {
    const mapa = new Map<string, { nome: string; itens: Linha[] }>();
    for (const l of visiveis) {
      const chave = l.lider_nome || '__sem__';
      const g = mapa.get(chave) ?? { nome: l.lider_nome || 'Sem líder direto', itens: [] };
      g.itens.push(l);
      mapa.set(chave, g);
    }
    return [...mapa.entries()]
      .sort((a, b) => (a[0] === '__sem__' ? 1 : b[0] === '__sem__' ? -1 : b[1].itens.length - a[1].itens.length))
      .map(([chave, g]) => ({ chave, ...g }));
  }, [visiveis]);

  const salvar = async () => {
    if (!pendentes.length) return;
    setSalvando(true);
    try {
      const r = await api.post('/api/operacao/escala/dia', {
        data: dia,
        marcacoes: pendentes.map(l => ({ funcionario_id: l.funcionario_id, status: statusDe(l) })),
      });
      if (r.erros?.length) {
        showToast({ type: 'warning', title: `${r.gravados} salvos, ${r.erros.length} não`, message: r.erros[0] });
      } else {
        showToast({ type: 'success', title: `${r.gravados} check-ins salvos` });
      }
      setEscolha({});
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    } finally { setSalvando(false); }
  };

  const r = data?.resumo;

  return (
    <div className="space-y-3 pb-24">
      {/* dia + resumo */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => trocarDia(somaDias(dia, -1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium tabular-nums min-w-[86px] text-center">{fmtBR(dia)}</span>
          <Button variant="ghost" size="sm" onClick={() => trocarDia(somaDias(dia, 1))}><ChevronRight className="w-4 h-4" /></Button>
          {dia !== hojeISO() && <Button variant="ghost" size="sm" onClick={() => trocarDia(hojeISO())}>hoje</Button>}
        </div>
        {data?.equipe_de && (
          <span className="text-[11px] rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            equipe de {data.equipe_de}
          </span>
        )}
        {r && (
          <span className="text-xs text-muted-foreground">
            {r.escalados} escalados · {r.marcados} marcados · <b className={r.pendentes ? 'text-amber-600' : ''}>{r.pendentes} pendentes</b>
          </span>
        )}
      </div>

      {/* lupa */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pessoa ou função…"
          className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-[hsl(var(--border))] bg-transparent"
        />
      </div>

      {!soLeitura && (
        addAberto ? (
          <div className="flex items-center gap-2 flex-wrap rounded-lg border border-[hsl(var(--border))] p-2">
            <select value={addPessoa} onChange={(e) => setAddPessoa(e.target.value)}
              className="flex-1 min-w-[180px] h-10 px-2 text-sm rounded border border-[hsl(var(--border))] bg-transparent">
              <option value="">quem veio?</option>
              {elegiveis.map(el => <option key={el.id} value={el.id}>{el.nome}</option>)}
            </select>
            <Button onClick={adicionar} disabled={!addPessoa} className="h-10">Adicionar</Button>
            <Button variant="ghost" onClick={() => { setAddAberto(false); setAddPessoa(''); }} className="h-10">Cancelar</Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAddAberto(true)} className="h-10 w-full sm:w-auto">
            <UserPlus className="w-4 h-4 mr-2" />Veio alguém fora da escala
          </Button>
        )
      )}

      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : !linhas.length ? (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          Ninguém escalado em {fmtBR(dia)}.<br />
          <span className="text-xs">Monte a escala na aba Semana — ou adicione quem veio marcando &ldquo;por fora da escala&rdquo;.</span>
        </div>
      ) : (
        <div className="space-y-3">
        {grupos.map(grupo => {
          const faltamNoGrupo = grupo.itens.filter(l => !statusDe(l)).length;
          return (
          <div key={grupo.chave} className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            {/* Cabeçalho do líder: nome + quantos ainda faltam marcar naquele time. É o número
                que o líder procura — "acabei o meu?" */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[hsl(var(--muted))]">
              <span className="text-[11px] font-semibold uppercase tracking-wide truncate">{grupo.nome}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {grupo.itens.length} pessoa{grupo.itens.length === 1 ? '' : 's'}
                {faltamNoGrupo > 0
                  ? <> · <b className="text-amber-600 dark:text-amber-400">{faltamNoGrupo} a marcar</b></>
                  : <> · <b className="text-emerald-600 dark:text-emerald-400">tudo marcado</b></>}
              </span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
          {grupo.itens.map(l => {
            const st = statusDe(l);
            const mudou = st && st !== l.checkin_status;
            return (
              <div key={l.funcionario_id}>
                <div className="flex items-center gap-3 px-3 py-2.5 min-h-[56px]">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {l.nome}
                      {l.fora_escala && (
                        <span className="ml-1.5 text-[10px] rounded px-1 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          fora da escala
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {l.funcao_nome || '—'}
                      {l.hora_inicio && ` · ${hhmm(l.hora_inicio)}${l.hora_fim ? `–${hhmm(l.hora_fim)}` : ''}`}
                      {/* o ponto é SUGESTÃO, não veredito: quem é PJ ou liderança não bate */}
                      {l.entrada ? ` · bateu ${String(l.entrada).slice(11, 16)}` : ' · sem marcação'}
                      {!!l.atraso_min && l.atraso_min > 0 && ` (${l.atraso_min}min)`}
                    </div>
                  </div>
                  <button
                    onClick={() => setAberta(a => (a === l.funcionario_id ? null : l.funcionario_id))}
                    disabled={soLeitura}
                    className={`shrink-0 h-9 px-3 rounded-full border text-xs font-medium disabled:opacity-50 ${corDe(st)} ${mudou ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                  >
                    {rotulo(st)}
                  </button>
                </div>

                {/* opções abrem NA LINHA, não em popover: no celular popover flutuante briga
                    com rolagem e com o teclado da busca. */}
                {aberta === l.funcionario_id && !soLeitura && (
                  <div className="px-3 pb-3 grid grid-cols-2 gap-1.5 max-w-md">
                    {OPCOES.map(o => (
                      <button key={o.id}
                        onClick={() => { setEscolha(x => ({ ...x, [l.funcionario_id]: o.id })); setAberta(null); }}
                        className={`h-10 rounded-lg border text-xs font-medium ${st === o.id ? o.cls : 'border-[hsl(var(--border))]'}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
            </div>
          </div>
          );
        })}
          {!visiveis.length && (
            <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">Ninguém com esse nome.</div>
          )}
          {/* respiro pra última pessoa da lista não nascer embaixo da barra de Salvar */}
          {!soLeitura && !!pendentes.length && <div className="h-16" aria-hidden />}
        </div>
      )}

      {/*
        Salvar FIXO: o líder rola a lista inteira, então o botão não pode ficar no fim dela.

        ACIMA da barra de navegação do app, não em bottom-0. A BottomNavigation do mobile é
        `fixed bottom-0 z-30` e cobria este botão inteiro (z-20, mesma posição): no celular o
        líder marcava a equipe toda e não tinha em que clicar — exatamente o "não tá salvando"
        que o Junin viu ao vivo em 20/08/2026. No desktop a barra não existe (lg:hidden), então
        o deslocamento só vale abaixo de lg.
      */}
      {!soLeitura && !!pendentes.length && (
        <div className="fixed bottom-[84px] lg:bottom-0 left-0 right-0 p-3 bg-[hsl(var(--card))] border-t border-[hsl(var(--border))] z-40 shadow-[0_-6px_16px_-8px_rgba(0,0,0,0.35)]">
          <Button onClick={salvar} disabled={salvando} className="w-full h-11">
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Salvar {pendentes.length} {pendentes.length === 1 ? 'marcação' : 'marcações'}
          </Button>
        </div>
      )}
    </div>
  );
}
