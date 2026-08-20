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
import { VinculoRHDialog } from './VinculoRHDialog';
import { DiaCheckin } from './DiaCheckin';
import { PadraoPessoaDialog } from './PadraoPessoaDialog';
import { MARCADORES, MARCADORES_RAPIDOS, MARCADORES_LIDERANCA, COD_LIDERANCA, PRESETS, parseTextoEscala } from './turnos';
import { ChevronLeft, ChevronRight, Loader2, CalendarRange, X, Link2, Link2Off, Users, Bookmark, Pencil } from 'lucide-react';

type Funcao = { id: string; codigo: string; nome: string; entra_no_custo: boolean; ordem: number };
type Celula = { id: string; entra: string | null; sai: string | null; horas: number | null; marcador: string | null; turno: string };
type Pessoa = {
  chave: string; funcao_id: string; slot: number; nome: string;
  /** vínculo com hr.funcionarios — nulo enquanto o de-para não for feito */
  funcionario_id: number | null;
  dias: Record<string, Celula>;
};

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
function PainelHorario({ titulo, atual, rect, marcadores, onSalvar, onFechar }: {
  titulo: string; atual: string; rect: DOMRect; marcadores: string[];
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
          {marcadores.map(m => (
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

  const { data, isLoading, mutate } = useApiSWR<{
    funcoes: Funcao[]; pessoas: Pessoa[];
    equipe_de?: string | null; sem_vinculo_ocultas?: number;
  }>(
    `/api/operacao/escala?de=${de}&ate=${ate}`,
  );

  const funcoes = data?.funcoes || [];
  const pessoas = data?.pessoas || [];
  /** preenchido = o servidor restringiu a visão à árvore desta pessoa no organograma */
  const equipeDe = data?.equipe_de || null;
  const ocultasSemVinculo = data?.sem_vinculo_ocultas || 0;

  /** Interpreta o texto digitado: horário "15:00-01:00" ou marcador. */
  const salvar = useCallback(async (p: Pessoa, dataISO: string, txt: string) => {
    const limpo = txt.trim();
    try {
      if (!limpo) {
        await api.patch('/api/operacao/escala', { data: dataISO, funcao_id: p.funcao_id, slot: p.slot, apagar: true });
      } else {
        // horas: grava a duração BRUTA e deixa o desconto de intervalo (1h ou 2h, varia por
        // turno) pro ajuste manual, como a planilha sempre fez.
        const v = parseTextoEscala(limpo);
        await api.patch('/api/operacao/escala', {
          data: dataISO, funcao_id: p.funcao_id, slot: p.slot, pessoa_nome: p.nome,
          entra: v.entra, sai: v.sai, horas: v.horas, marcador: v.marcador,
        });
      }
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    }
  }, [mutate, showToast]);

  /** Célula com o painel aberto — um por vez na página inteira. */
  const [editando, setEditando] = useState<{ pessoa: Pessoa; data: string; rect: DOMRect } | null>(null);

  /** Semana = a grade de planejamento. Dia = quem está escalado hoje + o check do líder
      (era a aba Check-ins do RH; veio pra cá porque a operação já vive nesta tela). */
  const [aba, setAba] = useState<'semana' | 'dia'>('semana');

  /** pessoa com o editor de escala padrão aberto (a canetinha ao lado do nome) */
  const [padraoDe, setPadraoDe] = useState<{ funcionario_id: number; nome: string } | null>(null);

  const [vinculoAberto, setVinculoAberto] = useState(false);
  /** pessoa que o dialog de vinculo deve destacar quando abre pelo aviso da linha */
  const [vinculoFoco, setVinculoFoco] = useState<string | null>(null);
  const abrirVinculo = (chave?: string) => { setVinculoFoco(chave ?? null); setVinculoAberto(true); };
  // quantas pessoas DESTA semana ainda não apontam pro RH — o número que o botão mostra
  const semVinculo = pessoas.filter(p => !p.funcionario_id).length;

  // contagem de escalados por dia — é exatamente o FIXOS que o Plano Operacional consome
  const escaladosNoDia = (dataISO: string, funcaoId?: string) =>
    pessoas.filter(p => (!funcaoId || p.funcao_id === funcaoId) && p.dias[dataISO]?.entra).length;

  /**
   * Adiciona pessoa. Sem isto não dava pra contratar ninguém: a grade só mostra quem já tem
   * linha no período, então semana ainda não escalada não tinha onde colocar gente.
   */
  const [ocupado, setOcupado] = useState(false);

  /**
   * Ações de bar inteiro. Só quem enxerga a casa toda (gerência/RH/admin) — o servidor barra
   * líder de área com 403, então o botão escondido aqui é conveniência, não a trava.
   */
  const acaoDeBar = useCallback(async (acao: 'puxar' | 'salvar_padrao') => {
    setOcupado(true);
    try {
      const r = await api.post('/api/operacao/escala/padrao', { acao, de, ate });
      showToast({
        type: 'success',
        title: acao === 'puxar' ? 'Escala puxada do organograma' : 'Semana salva como padrão',
        message: acao === 'puxar'
          ? `${r.pessoas_do_organograma ?? 0} pessoas · ${r.linhas_criadas ?? 0} dias criados${r.funcoes_criadas ? ` · ${r.funcoes_criadas} funções novas` : ''}`
          : `${r.linhas_gravadas ?? 0} dias viraram molde`,
      });
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não deu', message: e?.message });
    } finally { setOcupado(false); }
  }, [de, ate, mutate, showToast]);

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
      <div className="flex gap-1 rounded-lg border border-[hsl(var(--border))] p-1 w-fit">
        {(['semana', 'dia'] as const).map(t => (
          <button key={t} onClick={() => setAba(t)}
            className={`px-3 h-8 rounded-md text-sm font-medium ${aba === t ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>
            {t === 'semana' ? 'Semana' : 'Dia · check-in'}
          </button>
        ))}
      </div>

      {aba === 'dia' ? <DiaCheckin soLeitura={soLeitura} /> : (<>
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
        <div className="flex items-center gap-2 flex-wrap">
          {soLeitura && <BadgeSomenteLeitura />}
          {/* A visão restrita precisa se anunciar: sem isto o líder ve 6 pessoas onde a casa
              tem 30 e nao sabe se e a escala que esta furada ou a tela. */}
          {equipeDe && (
            <span className="text-[11px] rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              equipe de {equipeDe}
            </span>
          )}
          {ocultasSemVinculo > 0 && (
            <span className="text-[11px] rounded-full px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              title="Essas pessoas não estão ligadas ao cadastro do RH, então não dá pra saber de quem elas são. Peça o vínculo pro RH.">
              {ocultasSemVinculo} fora da sua visão (sem vínculo com o RH)
            </span>
          )}
          {/* De-para com o RH: não virou tela própria porque é manutenção que se faz olhando
              a escala. O contador mostra o que falta sem precisar abrir. */}
          {/* Só aparece pra quem vê a casa toda: as duas ações montam a escala do bar inteiro. */}
          {!soLeitura && !equipeDe && (<>
            <Button variant="outline" size="sm" onClick={() => acaoDeBar('puxar')} disabled={ocupado}
              title="Traz as pessoas do organograma pra esta semana, usando a escala padrão de cada uma. Não mexe em quem já está na escala.">
              <Users className="w-4 h-4 mr-1.5" />Puxar do organograma
            </Button>
            <Button variant="outline" size="sm" onClick={() => acaoDeBar('salvar_padrao')} disabled={ocupado}
              title="Guarda esta semana como a escala padrão de cada pessoa — é o molde das próximas.">
              <Bookmark className="w-4 h-4 mr-1.5" />Salvar como padrão
            </Button>
          </>)}
          <Button variant="outline" size="sm" onClick={() => abrirVinculo()}
            title="Ligar cada pessoa da escala ao cadastro do RH — traz gênero, dias por semana e ponto">
            <Link2 className="w-4 h-4 mr-1.5" />
            Vincular ao RH
            {semVinculo > 0 && (
              <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {semVinculo}
              </span>
            )}
          </Button>
        </div>
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
                            {/* Sem vinculo com o RH essa pessoa nao tem ponto, nao entra no
                                check-in do lider e nao vira ocorrencia. Antes isso so aparecia
                                como um numero no botao do topo -- dava pra saber QUANTAS
                                faltavam, nao QUEM. Agora o aviso fica na linha e abre o de-para
                                ja destacando ela. */}
                            {!p.funcionario_id && (
                              <button onClick={() => abrirVinculo(p.chave)}
                                title="Não está ligada ao cadastro do RH — clique para escolher a pessoa"
                                className="text-amber-600 dark:text-amber-400 hover:text-amber-700">
                                <Link2Off className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* Canetinha: molde da semana normal DESTA pessoa. Só faz sentido
                                pra quem tem vínculo — o padrão é por funcionário, não por linha. */}
                            {!soLeitura && p.funcionario_id && (
                              <button onClick={() => setPadraoDe({ funcionario_id: p.funcionario_id!, nome: p.nome })}
                                title="Editar a escala padrão desta pessoa"
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-600 transition-opacity">
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
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
                    {/* O "+ adicionar" saiu em 19/08/2026 (Gonza: "nem e pra poder, pq ja vai
                        buscar do organograma"). Quem trabalha tem cadeira; a escala espelha o
                        cadastro em vez de aceitar nome digitado, que era a origem do de-para
                        manual. Pra incluir alguem: cria a cadeira no Organograma e usa
                        "Puxar do organograma". */}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </CardContent></Card>
      )}
      </>)}

      <PadraoPessoaDialog
        pessoa={padraoDe}
        parse={parseTextoEscala}
        onFechar={() => setPadraoDe(null)}
        onSalvo={async () => { await mutate(); }}
      />

      <VinculoRHDialog open={vinculoAberto} onOpenChange={setVinculoAberto} focarChave={vinculoFoco}
        soLeitura={soLeitura} onSalvo={async () => { await mutate(); }} />

      {editando && (
        <PainelHorario
          titulo={`${editando.pessoa.nome} · ${rotuloCurto(editando.data)}`}
          atual={textoDaCelula(editando.pessoa.dias[editando.data])}
          rect={editando.rect}
          marcadores={
            funcoes.find(f => f.id === editando.pessoa.funcao_id)?.codigo === COD_LIDERANCA
              ? [...MARCADORES_RAPIDOS, ...MARCADORES_LIDERANCA]
              : MARCADORES_RAPIDOS
          }
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
