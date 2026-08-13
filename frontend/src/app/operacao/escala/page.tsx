'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { ChevronLeft, ChevronRight, Loader2, CalendarRange, Plus, X } from 'lucide-react';

type Funcao = { id: string; codigo: string; nome: string; entra_no_custo: boolean; ordem: number };
type Celula = { id: string; entra: string | null; sai: string | null; horas: number | null; marcador: string | null; turno: string };
type Pessoa = { chave: string; funcao_id: string; slot: number; nome: string; dias: Record<string, Celula> };

/** Marcadores que a operação usa. Digitar qualquer um deles no lugar do horário grava o marcador. */
const MARCADORES = ['FOLGA', 'FÉRIAS', 'ATESTADO', 'BANCO', 'ABRE', 'FECHA', 'INTERMEDIÁRIO'];

/** Os que aparecem como botão no painel — o resto continua funcionando digitado. */
const MARCADORES_RAPIDOS = ['FOLGA', 'FÉRIAS', 'ATESTADO', 'BANCO'];

/**
 * Turnos padrão da casa, na ordem de uso REAL (contagem em `escala_dia` desde 01/06):
 * 367, 307, 162, 147, 95 lançamentos. Não são invenção — são os horários que a operação
 * já usa, e cobrem a grande maioria dos dias. O 18:00-02:30 entra porque é o da segurança.
 */
const PRESETS = ['17:00-02:30', '15:00-01:00', '15:00-02:30', '17:00-03:00', '16:00-02:00', '18:00-02:30'];

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTOS = ['00', '15', '30', '45'];

const COR_MARCADOR: Record<string, string> = {
  FOLGA: 'text-gray-400',
  'FÉRIAS': 'text-blue-500',
  ATESTADO: 'text-red-500',
  BANCO: 'text-purple-500',
};

const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const somaDias = (d: Date, n: number) => { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
function segundaDa(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return x;
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');
const rotuloCurto = (dataISO: string) => {
  const [a, m, d] = dataISO.split('-').map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIA_CURTO[dow]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

/** Texto que a célula mostra: marcador, horário, ou vazio. */
function textoDaCelula(cel: Celula | undefined): string {
  if (!cel) return '';
  if (cel.marcador) return cel.marcador;
  if (cel.entra) return `${hhmm(cel.entra)}${cel.sai ? '-' + hhmm(cel.sai) : ''}`;
  return '';
}

/**
 * Célula da escala — só mostra e abre o painel. A edição toda vive no `PainelHorario`,
 * um único painel por vez na página.
 */
function CelulaEscala({ cel, onAbrir, disabled }: {
  cel: Celula | undefined; onAbrir: (rect: DOMRect) => void; disabled?: boolean;
}) {
  const atual = textoDaCelula(cel);
  const cor = cel?.marcador ? (COR_MARCADOR[cel.marcador] || 'text-amber-600') : '';

  if (disabled) return <span className={`block px-1 py-1 text-center text-[11px] ${cor}`}>{atual || '—'}</span>;

  return (
    <button
      onClick={(e) => onAbrir((e.currentTarget as HTMLElement).getBoundingClientRect())}
      className={`w-full px-1 py-1 text-center text-[11px] rounded hover:ring-1 hover:ring-blue-400 ${cor} ${!atual ? 'text-gray-300' : ''}`}
    >
      {atual || '·'}
    </button>
  );
}

/**
 * Painel de horário da célula.
 *
 * O campo era texto livre. Trocar por dois seletores de hora resolveria a validação e
 * mataria a velocidade: são 7 dias × ~50 pessoas, e a graça de sair do Excel é preencher
 * rápido. Então o painel tem os TRÊS caminhos, do mais rápido pro mais raro:
 *
 *   1. digitar (o campo já vem focado — "17-2:30" e Enter continua funcionando);
 *   2. clicar num turno padrão da casa;
 *   3. montar hora a hora nos selects, pro caso fora do padrão.
 *
 * `position: fixed` com as coordenadas da célula porque a grade vive dentro de um
 * `overflow-x-auto` — um painel `absolute` seria cortado pela borda do card.
 */
function PainelHorario({ titulo, atual, rect, onSalvar, onFechar }: {
  titulo: string; atual: string; rect: DOMRect;
  onSalvar: (txt: string) => void; onFechar: () => void;
}) {
  const [txt, setTxt] = useState(atual);
  const [entraH, entraM] = (/^(\d{2}):(\d{2})/.exec(atual)?.slice(1) ?? ['', '']);
  const [saiH, saiM] = (/-\s*(\d{2}):(\d{2})/.exec(atual)?.slice(1) ?? ['', '']);
  const [eh, setEh] = useState(entraH || '17');
  const [em, setEm] = useState(entraM || '00');
  const [sh, setSh] = useState(saiH || '02');
  const [sm, setSm] = useState(saiM || '30');

  const confirmar = (valor: string) => { onSalvar(valor); onFechar(); };

  // 300px de largura; encosta na direita da tela quando a célula é de sábado/domingo
  const largura = 300;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - largura - 8));
  const abaixo = rect.bottom + 4;
  const acima = rect.top - 4;
  const cabeAbaixo = window.innerHeight - rect.bottom > 300;

  return (
    <>
      {/* clique fora fecha sem salvar */}
      <div className="fixed inset-0 z-40" onClick={onFechar} />
      <div
        className="fixed z-50 rounded-lg border border-[hsl(var(--border))] bg-white dark:bg-gray-900 shadow-xl p-2.5 space-y-2"
        style={{ left, width: largura, ...(cabeAbaixo ? { top: abaixo } : { bottom: window.innerHeight - acima }) }}
      >
        <div className="text-[11px] font-medium text-muted-foreground">{titulo}</div>

        <input
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmar(txt);
            if (e.key === 'Escape') onFechar();
          }}
          ref={(el) => el?.focus()}
          placeholder="17:00-02:30 ou FOLGA"
          className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-gray-900"
        />

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">Turnos da casa</div>
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map(p => (
              <button key={p} onClick={() => confirmar(p)}
                className={`px-1.5 py-1 text-[11px] rounded border tabular-nums
                  ${p === atual
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 font-medium'
                    : 'border-[hsl(var(--border))] hover:bg-muted'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground w-9">outro</span>
          <SelectHora h={eh} m={em} onH={setEh} onM={setEm} />
          <span className="text-muted-foreground">–</span>
          <SelectHora h={sh} m={sm} onH={setSh} onM={setSm} />
          <button onClick={() => confirmar(`${eh}:${em}-${sh}:${sm}`)}
            className="ml-auto px-2 py-1 text-[11px] rounded bg-[hsl(var(--primary))] text-white">
            ok
          </button>
        </div>

        <div className="flex flex-wrap gap-1 pt-1 border-t border-[hsl(var(--border))]">
          {MARCADORES_RAPIDOS.map(m => (
            <button key={m} onClick={() => confirmar(m)}
              className={`px-1.5 py-0.5 text-[10px] rounded-full border border-[hsl(var(--border))] hover:bg-muted ${COR_MARCADOR[m] || ''}`}>
              {m}
            </button>
          ))}
          <button onClick={() => confirmar('')}
            className="ml-auto px-1.5 py-0.5 text-[10px] rounded text-muted-foreground hover:text-red-500">
            limpar
          </button>
        </div>
      </div>
    </>
  );
}

function SelectHora({ h, m, onH, onM }: {
  h: string; m: string; onH: (v: string) => void; onM: (v: string) => void;
}) {
  const cls = 'px-1 py-0.5 text-[11px] tabular-nums border border-[hsl(var(--border))] rounded bg-transparent';
  return (
    <span className="inline-flex items-center gap-0.5">
      <select value={h} onChange={(e) => onH(e.target.value)} className={cls} aria-label="hora">
        {HORAS.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="text-muted-foreground text-[11px]">:</span>
      <select value={m} onChange={(e) => onM(e.target.value)} className={cls} aria-label="minuto">
        {MINUTOS.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
    </span>
  );
}

export default function EscalaPage() {
  const { setPageTitle } = usePageTitle();
  const { soLeitura } = useModuloPermissao('/operacao/escala');
  const { showToast } = useToast();
  useEffect(() => { setPageTitle('👥 Escala'); return () => setPageTitle(''); }, [setPageTitle]);

  const [segunda, setSegunda] = useState(() => segundaDa(new Date()));
  const de = iso(segunda);
  const ate = iso(somaDias(segunda, 6));
  const datas = useMemo(() => Array.from({ length: 7 }, (_, i) => iso(somaDias(segunda, i))), [segunda]);

  const { data, isLoading, mutate } = useApiSWR<{ funcoes: Funcao[]; pessoas: Pessoa[] }>(
    `/api/operacao/escala?de=${de}&ate=${ate}`,
  );

  const funcoes = data?.funcoes || [];
  const pessoas = data?.pessoas || [];

  /** Interpreta o texto digitado: horário "15:00-01:00" ou marcador. */
  const salvar = useCallback(async (p: Pessoa, dataISO: string, txt: string) => {
    const limpo = txt.trim();
    try {
      if (!limpo) {
        await api.patch('/api/operacao/escala', { data: dataISO, funcao_id: p.funcao_id, slot: p.slot, apagar: true });
      } else {
        const m = /^(\d{1,2}):?(\d{2})\s*[-–a]\s*(\d{1,2}):?(\d{2})$/.exec(limpo);
        if (m) {
          const entra = `${m[1].padStart(2, '0')}:${m[2]}`;
          const sai = `${m[3].padStart(2, '0')}:${m[4]}`;
          // horas líquidas: a operação desconta 1h ou 2h de intervalo conforme o turno, e isso
          // varia caso a caso na planilha — aqui grava a duração bruta e deixa o ajuste manual.
          let dur = (Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]));
          if (dur < 0) dur += 24 * 60; // virou o dia
          await api.patch('/api/operacao/escala', {
            data: dataISO, funcao_id: p.funcao_id, slot: p.slot, pessoa_nome: p.nome,
            entra, sai, horas: Math.round((dur / 60) * 100) / 100,
          });
        } else {
          const up = limpo.toUpperCase();
          const marcador = MARCADORES.find(x => up.startsWith(x.slice(0, 4))) || up;
          await api.patch('/api/operacao/escala', {
            data: dataISO, funcao_id: p.funcao_id, slot: p.slot, pessoa_nome: p.nome,
            entra: null, sai: null, horas: null, marcador,
          });
        }
      }
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    }
  }, [mutate, showToast]);

  /** Célula com o painel aberto — um por vez na página inteira. */
  const [editando, setEditando] = useState<{ pessoa: Pessoa; data: string; rect: DOMRect } | null>(null);

  // contagem de escalados por dia — é exatamente o FIXOS que o Plano Operacional consome
  const escaladosNoDia = (dataISO: string, funcaoId?: string) =>
    pessoas.filter(p => (!funcaoId || p.funcao_id === funcaoId) && p.dias[dataISO]?.entra).length;

  /**
   * Adiciona pessoa. Sem isto não dava pra contratar ninguém: a grade só mostra quem já tem
   * linha no período, então semana ainda não escalada não tinha onde colocar gente.
   */
  const [addFuncao, setAddFuncao] = useState<string | null>(null);
  const [addNome, setAddNome] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const adicionar = useCallback(async (funcaoId: string) => {
    const nome = addNome.trim();
    if (!nome) return;
    setOcupado(true);
    try {
      await api.post('/api/operacao/escala/pessoa', { funcao_id: funcaoId, pessoa_nome: nome, de, ate });
      setAddNome(''); setAddFuncao(null);
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não adicionou', message: e?.message });
    } finally { setOcupado(false); }
  }, [addNome, de, ate, mutate, showToast]);

  /** Remove só do PERÍODO — apagar o histórico destruiria o planejado × realizado passado. */
  const remover = useCallback(async (p: Pessoa) => {
    if (!window.confirm(`Tirar ${p.nome} da escala desta semana (${de.slice(8)}/${de.slice(5, 7)} a ${ate.slice(8)}/${ate.slice(5, 7)})?\n\nO histórico das semanas anteriores não é afetado.`)) return;
    setOcupado(true);
    try {
      await api.delete(`/api/operacao/escala/pessoa?funcao_id=${p.funcao_id}&slot=${p.slot}&de=${de}&ate=${ate}`);
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não removeu', message: e?.message });
    } finally { setOcupado(false); }
  }, [de, ate, mutate, showToast]);

  return (
    <PageShell width="wide">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSegunda(s => somaDias(s, -7))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium inline-flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            {de.slice(8)}/{de.slice(5, 7)} — {ate.slice(8)}/{ate.slice(5, 7)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSegunda(s => somaDias(s, 7))}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setSegunda(segundaDa(new Date()))}>hoje</Button>
        </div>
        {soLeitura && <BadgeSomenteLeitura />}
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…
        </CardContent></Card>
      ) : funcoes.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma função cadastrada para este bar.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-[hsl(var(--card))] z-10 min-w-[160px]">Pessoa</th>
                {datas.map(d => {
                  const [a, m, dd] = d.split('-').map(Number);
                  const dow = new Date(Date.UTC(a, m - 1, dd)).getUTCDay();
                  return (
                    <th key={d} className="px-2 py-2 font-medium text-center min-w-[92px]">
                      {DIA_CURTO[dow]} {String(dd).padStart(2, '0')}/{String(m).padStart(2, '0')}
                      <div className="text-[10px] font-normal text-muted-foreground">{escaladosNoDia(d)} escalados</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {funcoes.map(f => {
                const doGrupo = pessoas.filter(p => p.funcao_id === f.id);
                // Grupo vazio continua aparecendo (só com a linha "adicionar"): é o que
                // permite escalar uma semana ainda em branco e contratar gente numa função.
                if (!doGrupo.length && soLeitura) return null;
                return (
                  <Fragment key={f.id}>
                    <tr className="bg-muted/50 border-y border-[hsl(var(--border))]">
                      <td className="px-3 py-1 font-semibold sticky left-0 bg-muted/50">
                        {f.nome}
                        {!f.entra_no_custo && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(fora do custo)</span>}
                      </td>
                      {datas.map(d => (
                        <td key={d} className="px-2 py-1 text-center text-[10px] text-muted-foreground tabular-nums">
                          {escaladosNoDia(d, f.id) || ''}
                        </td>
                      ))}
                    </tr>
                    {doGrupo.map(p => (
                      <tr key={p.chave} className="border-b border-[hsl(var(--border))] hover:bg-muted/30 group">
                        <td className="px-3 py-1 sticky left-0 bg-[hsl(var(--card))] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {p.nome}
                            {!soLeitura && (
                              <button onClick={() => remover(p)} disabled={ocupado}
                                title="Tirar da escala desta semana"
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        </td>
                        {datas.map(d => (
                          <td key={d} className="px-0.5 py-0.5">
                            <CelulaEscala cel={p.dias[d]} disabled={soLeitura}
                              onAbrir={(rect) => setEditando({ pessoa: p, data: d, rect })} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!soLeitura && (
                      <tr key={'add' + f.id}>
                        <td className="px-3 py-1 sticky left-0 bg-[hsl(var(--card))]">
                          {addFuncao === f.id ? (
                            <input
                              value={addNome}
                              onChange={(e) => setAddNome(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') adicionar(f.id);
                                if (e.key === 'Escape') { setAddNome(''); setAddFuncao(null); }
                              }}
                              onBlur={() => { if (!addNome.trim()) setAddFuncao(null); }}
                              ref={(el) => el?.focus()}
                              placeholder="nome e Enter"
                              className="w-full px-1.5 py-0.5 text-[11px] border border-blue-400 rounded bg-white dark:bg-gray-900"
                            />
                          ) : (
                            <button onClick={() => { setAddFuncao(f.id); setAddNome(''); }}
                              className="text-[11px] text-muted-foreground hover:text-blue-500 inline-flex items-center gap-1">
                              <Plus className="w-3 h-3" />adicionar
                            </button>
                          )}
                        </td>
                        <td colSpan={7} />
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      {editando && (
        <PainelHorario
          titulo={`${editando.pessoa.nome} · ${rotuloCurto(editando.data)}`}
          atual={textoDaCelula(editando.pessoa.dias[editando.data])}
          rect={editando.rect}
          onFechar={() => setEditando(null)}
          onSalvar={(txt) => salvar(editando.pessoa, editando.data, txt)}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Clique na célula para escolher o turno, ou digite direto (<b>17-2:30</b>, <b>FOLGA</b>) e Enter.
        <b> Limpar</b> remove o dia da pessoa. A contagem de escalados por dia é exatamente o{' '}
        <b>FIXOS</b> que o Plano Operacional consome — mexeu aqui, o custo projetado de lá se
        ajusta sozinho.
      </p>
    </PageShell>
  );
}
