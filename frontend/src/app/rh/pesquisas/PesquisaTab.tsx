'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import { Loader2, Link2, Copy, MessageCircle, Lock, LockOpen, Plus, Users, ListChecks } from 'lucide-react';
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
      ) : rodadas.map((r) => (
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
                {r.resultado.comentarios.map((c: string, i: number) => (
                  <li key={i} className="rounded-lg bg-muted/40 px-2.5 py-1.5">{c}</li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      ))}
    </div>
  );
}
