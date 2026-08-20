'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import { Loader2, Link2, Copy, MessageCircle, Lock, LockOpen, Plus, Users } from 'lucide-react';
import { DIMENSOES } from '@/lib/rh/pesquisa-felicidade';

/**
 * O lado do RH da Pesquisa da Felicidade: gera a rodada da semana e o link pra mandar no grupo.
 *
 * O Zykor monta o formulário sozinho — sorteia 1 pergunta de cada uma das 5 dimensões do banco
 * (55 perguntas, 11 por dimensão) e troca `{bar}` pelo nome da casa. Ninguém escreve pergunta.
 */

const fmtData = (d: string) => { try { const [a, m, dd] = d.split('-'); return `${dd}/${m}/${a}`; } catch { return d; } };
const cor = (v: number | null) => v == null ? 'text-muted-foreground'
  : v >= 50 ? 'text-emerald-600 dark:text-emerald-400'
  : v >= 0 ? 'text-amber-600 dark:text-amber-400'
  : 'text-red-600 dark:text-red-400';

export function FormularioTab() {
  const { showToast } = useToast();
  const { data, isLoading, mutate } = useApiSWR<any>('/api/rh/pesquisa-felicidade/rodadas');
  const [criando, setCriando] = useState(false);
  const rodadas: any[] = data?.rodadas || [];

  const linkDe = (token: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/pesquisa/${token}`;

  const criar = async () => {
    setCriando(true);
    try {
      await api.post('/api/rh/pesquisa-felicidade/rodadas', {});
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
        <p className="text-[12px] text-muted-foreground max-w-xl leading-relaxed">
          Cada semana o Zykor monta um formulário com <b>5 perguntas — uma de cada dimensão</b>,
          sorteadas de um banco de 55. O link é público e a resposta é <b>anônima</b>: nada liga
          a resposta à pessoa. A área é opcional, só pra somar por setor.
        </p>
        <Button onClick={criar} disabled={criando}>
          {criando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
          Criar pesquisa da semana
        </Button>
      </div>

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
              <span className="font-semibold">Semana de {fmtData(r.referencia)}</span>
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
                  <a href={`https://wa.me/?text=${encodeURIComponent(
                    `Pesquisa da Felicidade desta semana 💜 São 5 perguntas, menos de 1 minuto, e é anônima: ${linkDe(r.token)}`)}`}
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
              Índice geral da semana:{' '}
              <b className={cor(r.resultado.geral)}>
                {r.resultado.geral > 0 ? '+' : ''}{r.resultado.geral}
              </b>
              <span className="text-muted-foreground"> · escala −100 a +100 (% que concorda − % que discorda)</span>
            </div>
          )}

          {r.resultado?.comentarios?.length > 0 && (
            <details className="text-[12px]">
              <summary className="cursor-pointer text-muted-foreground">
                {r.resultado.comentarios.length} comentário(s)
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
