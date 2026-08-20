'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import { Loader2, Plus, Check, X, Pencil, Trash2, EyeOff, Eye } from 'lucide-react';
import { DIMENSOES, aplicarNomeDoBar } from '@/lib/rh/pesquisa-felicidade';

/**
 * Banco de perguntas: o RH edita, acrescenta e tira sem pedir deploy (Gonza, 20/08/2026).
 *
 * `{bar}` no texto vira o nome da casa na hora de montar a rodada — é o que faz "orgulho de
 * trabalhar no {bar}" servir pro Ordinário e pro Deboche com o mesmo cadastro. A tela mostra
 * o texto JÁ resolvido, e o marcador só aparece quando se está editando.
 */

const ROTA = '/api/rh/pesquisa-felicidade/perguntas';

export function BancoPerguntas() {
  const { showToast } = useToast();
  const { data, isLoading, mutate } = useApiSWR<any>(ROTA);
  const [editando, setEditando] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [novaEm, setNovaEm] = useState<string | null>(null);
  const [novoTexto, setNovoTexto] = useState('');
  const [verInativas, setVerInativas] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const nomeBar = data?.bar || '';
  const perguntas: any[] = data?.perguntas || [];

  const erro = (e: any) => showToast({ type: 'error', title: 'Não deu', message: e?.message });

  const salvar = async (id: number) => {
    setSalvando(true);
    try { await api.put(ROTA, { id, texto }); setEditando(null); await mutate(); }
    catch (e) { erro(e); } finally { setSalvando(false); }
  };

  const criar = async (dimensao: string) => {
    setSalvando(true);
    try {
      await api.post(ROTA, { dimensao, texto: novoTexto });
      setNovaEm(null); setNovoTexto(''); await mutate();
      showToast({ type: 'success', title: 'Pergunta adicionada' });
    } catch (e) { erro(e); } finally { setSalvando(false); }
  };

  const alternarAtiva = async (p: any) => {
    try { await api.put(ROTA, { id: p.id, ativa: !p.ativa }); await mutate(); } catch (e) { erro(e); }
  };

  const excluir = async (p: any) => {
    try {
      const r = await api.delete(`${ROTA}?id=${p.id}`);
      await mutate();
      showToast({
        type: 'success',
        title: r.apagada ? 'Pergunta excluída' : 'Pergunta desativada',
        message: r.apagada ? undefined : `Já foi usada em ${r.usos} pesquisa(s), então some do sorteio mas fica no histórico.`,
      });
    } catch (e) { erro(e); }
  };

  if (isLoading) {
    return <Card className="rounded-2xl py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></Card>;
  }

  return (
    <Card className="rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">Banco de perguntas</h3>
          <p className="text-[11px] text-muted-foreground">
            O sorteio pega 1 de cada dimensão daqui. Escreva <code>{'{bar}'}</code> no lugar do nome
            da casa — vira <b>{nomeBar}</b> na hora de perguntar.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setVerInativas((v) => !v)}>
          {verInativas ? <Eye className="w-3.5 h-3.5 mr-1.5" /> : <EyeOff className="w-3.5 h-3.5 mr-1.5" />}
          {verInativas ? 'Ocultar inativas' : 'Mostrar inativas'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DIMENSOES.map((d) => {
          const daDim = perguntas.filter((p) => p.dimensao === d.chave && (verInativas || p.ativa));
          const ativas = perguntas.filter((p) => p.dimensao === d.chave && p.ativa).length;
          return (
            <div key={d.chave} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                  {d.descricao} · {d.titulo}
                </div>
                <span className={`text-[10px] ${ativas ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400 font-semibold'}`}>
                  {ativas} ativa{ativas === 1 ? '' : 's'}
                </span>
              </div>

              {daDim.map((p) => (
                <div key={p.id} className={`rounded-lg border px-2.5 py-1.5 text-[12px] ${p.ativa ? '' : 'opacity-50'}`}>
                  {editando === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <Input className="h-8 text-[12px]" value={texto} onChange={(e) => setTexto(e.target.value)} />
                      <Button size="sm" className="h-8 px-2" disabled={salvando} onClick={() => salvar(p.id)}>
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditando(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <span className="leading-snug">
                        {aplicarNomeDoBar(p.texto, nomeBar)}
                        {p.bar_id == null && (
                          <span className="ml-1 text-[9px] uppercase tracking-wide text-muted-foreground" title="Vale para toda a rede — editar muda nos dois bares">
                            · rede
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-0.5 shrink-0">
                        <button title="Editar" onClick={() => { setEditando(p.id); setTexto(p.texto); }}
                          className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                        <button title={p.ativa ? 'Tirar do sorteio' : 'Voltar pro sorteio'} onClick={() => alternarAtiva(p)}
                          className="p-1 text-muted-foreground hover:text-foreground">
                          {p.ativa ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button title="Excluir" onClick={() => excluir(p)}
                          className="p-1 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {novaEm === d.chave ? (
                <div className="flex items-center gap-1.5">
                  <Input autoFocus={false} className="h-8 text-[12px]" placeholder="Nova pergunta desta dimensão"
                    value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} />
                  <Button size="sm" className="h-8 px-2" disabled={salvando} onClick={() => criar(d.chave)}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setNovaEm(null); setNovoTexto(''); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button onClick={() => { setNovaEm(d.chave); setNovoTexto(''); }}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1">
                  <Plus className="w-3.5 h-3.5" />adicionar
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Pergunta marcada como <b>rede</b> veio do catálogo e vale para todos os bares — editar muda
        nos dois. Pergunta nova nasce só desta casa. Excluir uma que já foi usada não apaga: ela
        sai do sorteio e continua no histórico.
      </p>
    </Card>
  );
}
