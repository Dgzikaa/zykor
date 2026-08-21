'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import {
  Loader2, Link2, Copy, MessageCircle, Lock, LockOpen, Plus, Users, ListChecks,
  Lightbulb, ClipboardCheck, History, Pencil,
} from 'lucide-react';
import { DIMENSOES, type TipoPesquisa } from '@/lib/rh/pesquisa-felicidade';
import { BancoPerguntas } from './BancoPerguntas';

/**
 * O lado de quem organiza qualquer uma das três pesquisas: cria a rodada, copia o link, manda
 * no WhatsApp, encerra e lê o resultado.
 *
 * Um componente só com `tipo` porque a mecânica é idêntica — o que muda é a pergunta e a
 * apuração. Três telas iguais seriam três lugares pra corrigir o mesmo botão.
 */

const fmtData = (d: string) => { try { const [a, m, dd] = d.split('-'); return `${dd}/${m}/${a}`; } catch { return d; } };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtMes = (d: string) => { try { const [a, m] = d.split('-'); return `${MESES[Number(m) - 1]}/${a}`; } catch { return d; } };

const cor = (v: number | null) => v == null ? 'text-muted-foreground'
  : v >= 50 ? 'text-emerald-600 dark:text-emerald-400'
  : v >= 0 ? 'text-amber-600 dark:text-amber-400'
  : 'text-red-600 dark:text-red-400';

const TEXTOS: Record<TipoPesquisa, { titulo: string; explica: string; botao: string; periodo: (d: string) => string; convite: string }> = {
  felicidade: {
    titulo: 'Pesquisa da Felicidade',
    explica: 'Cada semana o Zykor monta um formulário com 5 perguntas sorteadas do banco — uma de cada dimensão, em ordem embaralhada. O link é público e a resposta é anônima.',
    botao: 'Criar pesquisa da semana',
    periodo: (d) => `Semana de ${fmtData(d)}`,
    convite: 'Pesquisa da Felicidade desta semana 💜 São 5 perguntas, menos de 1 minuto, e é anônima:',
  },
  marca_empregadora: {
    titulo: 'Marca Empregadora',
    explica: 'Sempre a mesma: o quanto a pessoa recomendaria a casa para um amigo trabalhar (0 a 10) e uma sugestão aberta. 100% anônima — nem a área é perguntada.',
    botao: 'Criar pesquisa do mês',
    periodo: (d) => fmtMes(d),
    convite: 'Pesquisa de Marca Empregadora 💬 Uma pergunta e uma sugestão, 100% anônima:',
  },
  feedback: {
    titulo: 'Pesquisa de Feedback',
    explica: 'Uma pergunta só, perto do dia 15: o líder direto já teve a conversa de feedback este mês? Esta NÃO é anônima — a pessoa escolhe o próprio nome, e o líder sai do organograma.',
    botao: 'Criar pesquisa do mês',
    periodo: (d) => fmtMes(d),
    convite: 'Pesquisa de Feedback 📋 Uma pergunta só, leva 10 segundos:',
  },
};

export function PesquisaTab({ tipo }: { tipo: TipoPesquisa }) {
  const { showToast } = useToast();
  const t = TEXTOS[tipo];
  const { data, isLoading, mutate } = useApiSWR<any>(`/api/rh/pesquisa-felicidade/rodadas?tipo=${tipo}`);
  const [criando, setCriando] = useState(false);
  const [verBanco, setVerBanco] = useState(false);
  const rodadas: any[] = data?.rodadas || [];

  const linkDe = (token: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/pesquisa/${token}`;

  const criar = async () => {
    setCriando(true);
    try {
      await api.post('/api/rh/pesquisa-felicidade/rodadas', { tipo });
      await mutate();
      showToast({ type: 'success', title: 'Pesquisa criada', message: 'Copie o link e mande no grupo.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não criou', message: e?.message });
    } finally { setCriando(false); }
  };

  const trancar = async (rodada_id: string, aberta: boolean) => {
    try {
      await api.post('/api/rh/pesquisa-felicidade/rodadas', { acao: aberta ? 'fechar' : 'reabrir', rodada_id });
      await mutate();
    } catch (e: any) { showToast({ type: 'error', title: 'Não deu', message: e?.message }); }
  };

  const copiar = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkDe(token));
      showToast({ type: 'success', title: 'Link copiado' });
    } catch { showToast({ type: 'error', title: 'Não copiou', message: 'Copie da barra de endereço.' }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[12px] text-muted-foreground max-w-2xl leading-relaxed">{t.explica}</p>
        <div className="flex items-center gap-2">
          {tipo === 'felicidade' && (
            <Button variant="outline" onClick={() => setVerBanco((v) => !v)}>
              <ListChecks className="w-4 h-4 mr-1.5" />{verBanco ? 'Ocultar perguntas' : 'Banco de perguntas'}
            </Button>
          )}
          <Button onClick={criar} disabled={criando}>
            {criando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
            {t.botao}
          </Button>
        </div>
      </div>

      {tipo === 'felicidade' && verBanco && <BancoPerguntas />}

      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
      ) : rodadas.length === 0 ? (
        <Card className="py-14 text-center text-sm text-muted-foreground rounded-2xl">
          Nenhuma pesquisa criada ainda. O botão acima gera a primeira.
        </Card>
      ) : rodadas.map((r, i) => (
        <Card key={r.id} className="rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{t.periodo(r.referencia)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${
                r.aberta ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                         : 'bg-muted text-muted-foreground'}`}>
                {r.aberta ? 'aberta' : 'encerrada'}
              </span>
              <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Users className="w-3.5 h-3.5" />{r.resultado?.n || 0} resposta{(r.resultado?.n || 0) === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {r.aberta && (
                <>
                  <Button variant="outline" size="sm" onClick={() => copiar(r.token)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />Copiar link
                  </Button>
                  {/* Manda pro WhatsApp já com o texto pronto — é como o time recebe. */}
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${t.convite} ${linkDe(r.token)}`)}`}
                    target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" />WhatsApp
                    </Button>
                  </a>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => trancar(r.id, r.aberta)}>
                {r.aberta ? <Lock className="w-3.5 h-3.5 mr-1.5" /> : <LockOpen className="w-3.5 h-3.5 mr-1.5" />}
                {r.aberta ? 'Encerrar' : 'Reabrir'}
              </Button>
            </div>
          </div>

          {r.aberta && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5 overflow-x-auto">
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <code className="whitespace-nowrap">{linkDe(r.token)}</code>
            </div>
          )}

          {/* ---------- resultado: cada pesquisa tem a sua conta ---------- */}
          {tipo === 'felicidade' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {DIMENSOES.map((d) => {
                  const p = (r.perguntas || []).find((x: any) => x.dimensao === d.chave);
                  const score = r.resultado?.scores?.[d.chave];
                  return (
                    <div key={d.chave} className="rounded-xl border px-2.5 py-2">
                      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{d.descricao}</div>
                      <div className={`text-lg font-bold ${cor(score ?? null)}`}>
                        {score == null ? '–' : `${score > 0 ? '+' : ''}${score}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p?.texto || '—'}</div>
                    </div>
                  );
                })}
              </div>
              {r.resultado?.geral != null && (
                <div className="text-[12px]">
                  Índice geral: <b className={cor(r.resultado.geral)}>{r.resultado.geral > 0 ? '+' : ''}{r.resultado.geral}</b>
                  <span className="text-muted-foreground"> · escala −100 a +100 (% que concorda − % que discorda)</span>
                </div>
              )}
            </>
          )}

          {tipo === 'marca_empregadora' && r.resultado?.n > 0 && (
            <div className="flex items-center gap-6 flex-wrap text-[12px]">
              <div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">eNPS</div>
                <div className={`text-2xl font-bold ${cor(r.resultado.geral)}`}>
                  {r.resultado.geral > 0 ? '+' : ''}{r.resultado.geral}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Nota média</div>
                <div className="text-2xl font-bold">{r.resultado.media ?? '–'}</div>
              </div>
              <div className="text-muted-foreground">
                {r.resultado.promotores} promotor(es) · {r.resultado.neutros} neutro(s) · {r.resultado.detratores} detrator(es)
                <span className="block text-[10px]">promotor = 9-10 · detrator = 0-6</span>
              </div>
            </div>
          )}

          {tipo === 'feedback' && r.resultado?.n > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-6 flex-wrap text-[12px]">
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Tiveram a conversa</div>
                  <div className={`text-2xl font-bold ${cor(r.resultado.geral != null ? r.resultado.geral - 50 : null)}`}>
                    {r.resultado.geral ?? '–'}%
                  </div>
                </div>
                <div className="text-muted-foreground">{r.resultado.sim} sim · {r.resultado.nao} ainda não</div>
              </div>
              {(r.resultado.por_lider || []).length > 0 && (
                <div className="rounded-xl border divide-y">
                  {r.resultado.por_lider.map((l: any) => (
                    <div key={l.nome} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                      <span>{l.nome}</span>
                      <span className="tabular-nums">
                        <b className="text-emerald-600 dark:text-emerald-400">{l.sim}</b>
                        <span className="text-muted-foreground"> / {l.sim + l.nao}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {r.resultado?.comentarios?.length > 0 && (
            <details className="text-[12px]">
              <summary className="cursor-pointer text-muted-foreground">
                {r.resultado.comentarios.length} sugestão(ões)
              </summary>
              <ul className="mt-2 space-y-1.5">
                {r.resultado.comentarios.map((c: string, k: number) => (
                  <li key={k} className="rounded-lg bg-muted/40 px-2.5 py-1.5">{c}</li>
                ))}
              </ul>
            </details>
          )}

          {/* A rodada anterior está logo abaixo na lista, mas a lista é ordenada por referência
              desc — passar a vizinha permite mostrar o plano do mês passado JUNTO da pesquisa
              nova, que é o momento em que ele precisa ser revisitado. */}
          {tipo === 'marca_empregadora' && (
            <AnaliseMarca rodada={r} anterior={rodadas[i + 1]} rotulo={t.periodo} onSalvo={mutate} />
          )}
        </Card>
      ))}
    </div>
  );
}

/**
 * A leitura da rodada de Marca Empregadora (21/08/2026, Rodrigo).
 *
 * A pesquisa devolve um monte de resposta aberta ("a janta", "o uniforme", "o intervalo"). O RH
 * compila isso em 3-4 temas e senta com a liderança pra montar o plano de ação. O que faltava era
 * o plano ficar GRAVADO na rodada — porque o valor está em revisitar: quando sai a pesquisa do mês
 * seguinte, dá pra olhar o que foi prometido e ver se o mesmo pedido voltou.
 *
 * Por isso a rodada aberta mostra, no topo, o plano da rodada anterior.
 */
function AnaliseMarca({ rodada, anterior, rotulo, onSalvo }: {
  rodada: any;
  anterior?: any;
  rotulo: (d: string) => string;
  onSalvo: () => void | Promise<any>;
}) {
  const { showToast } = useToast();
  const [editando, setEditando] = useState(false);
  const [sug, setSug] = useState<string>(rodada.sugestoes_equipe || '');
  const [plano, setPlano] = useState<string>(rodada.plano_acao || '');
  const [salvando, setSalvando] = useState(false);

  const temConteudo = Boolean(rodada.sugestoes_equipe || rodada.plano_acao);
  const anteriorTem = Boolean(anterior && (anterior.sugestoes_equipe || anterior.plano_acao));

  const abrirEdicao = () => {
    setSug(rodada.sugestoes_equipe || '');
    setPlano(rodada.plano_acao || '');
    setEditando(true);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post('/api/rh/pesquisa-felicidade/rodadas', {
        acao: 'analise', rodada_id: rodada.id, sugestoes_equipe: sug, plano_acao: plano,
      });
      await onSalvo();
      setEditando(false);
      showToast({ type: 'success', title: 'Registrado', message: 'Vai aparecer na próxima rodada pra revisitar.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    } finally { setSalvando(false); }
  };

  return (
    <div className="space-y-2 pt-1">
      {/* Revisitar o mês passado: só na rodada em aberto, que é quando a conversa acontece. */}
      {rodada.aberta && anteriorTem && (
        <div className="rounded-xl border border-dashed px-3 py-2.5 space-y-1.5 bg-muted/30">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="w-3.5 h-3.5" />Revisitar — {rotulo(anterior.referencia)}
          </div>
          {anterior.sugestoes_equipe && (
            <div className="text-[12px]">
              <span className="text-muted-foreground">Pediram: </span>
              <span className="whitespace-pre-wrap">{anterior.sugestoes_equipe}</span>
            </div>
          )}
          {anterior.plano_acao && (
            <div className="text-[12px]">
              <span className="text-muted-foreground">Combinamos: </span>
              <span className="whitespace-pre-wrap">{anterior.plano_acao}</span>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground/80">
            Rodou? O que voltar a aparecer nesta rodada é o que não foi resolvido.
          </div>
        </div>
      )}

      {editando ? (
        <div className="rounded-xl border px-3 py-3 space-y-2.5">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              <Lightbulb className="w-3.5 h-3.5" />Principais sugestões da equipe
            </label>
            <Textarea rows={4} value={sug} onChange={(e) => setSug(e.target.value)}
              placeholder={'O que mais apareceu nas respostas, compilado. Ex.:\n1. Local e cardápio da janta\n2. Falta de uniforme\n3. Intervalo'} />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              <ClipboardCheck className="w-3.5 h-3.5" />Plano de ação da liderança
            </label>
            <Textarea rows={4} value={plano} onChange={(e) => setPlano(e.target.value)}
              placeholder={'O que ficou combinado com as lideranças. Ex.:\n1. Reformular o local da janta e montar cardápio novo\n2. Mandar fazer uniforme pra quem precisa'} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditando(false)} disabled={salvando}>Cancelar</Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      ) : temConteudo ? (
        <div className="rounded-xl border px-3 py-2.5 space-y-2">
          {rodada.sugestoes_equipe && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Lightbulb className="w-3.5 h-3.5" />Principais sugestões da equipe
              </div>
              <div className="text-[13px] whitespace-pre-wrap mt-0.5">{rodada.sugestoes_equipe}</div>
            </div>
          )}
          {rodada.plano_acao && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ClipboardCheck className="w-3.5 h-3.5" />Plano de ação da liderança
              </div>
              <div className="text-[13px] whitespace-pre-wrap mt-0.5">{rodada.plano_acao}</div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[10px] text-muted-foreground/80">
              {rodada.analise_por ? `Registrado por ${rodada.analise_por}` : ''}
              {rodada.analise_em ? ` · ${new Date(rodada.analise_em).toLocaleDateString('pt-BR')}` : ''}
            </span>
            <Button size="sm" variant="ghost" onClick={abrirEdicao}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar
            </Button>
          </div>
        </div>
      ) : rodada.aberta ? (
        <p className="text-[11px] text-muted-foreground">
          Encerre a pesquisa pra registrar as principais sugestões da equipe e o plano de ação da liderança.
        </p>
      ) : (
        <Button size="sm" variant="outline" onClick={abrirEdicao}>
          <ClipboardCheck className="w-4 h-4 mr-1.5" />Registrar sugestões e plano de ação
        </Button>
      )}
    </div>
  );
}
