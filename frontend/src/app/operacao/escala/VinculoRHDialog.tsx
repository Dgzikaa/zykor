'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Wand2 } from 'lucide-react';

/**
 * De-para pessoa da escala ↔ funcionário do RH.
 *
 * Não virou tela própria de propósito: é uma tarefa de manutenção que se faz olhando a
 * escala, e uma rota nova exigiria menu, permissão e um lugar pra pendurar no sistema —
 * peso demais pra uma lista que se resolve uma vez.
 *
 * Por que existe: a escala veio da planilha com só o primeiro nome, e a automação de escala
 * precisa de `genero` e `dias_trabalho_semana`, que só moram em `hr.funcionarios`. Casar por
 * nome resolve menos da metade (21 de 45 no bar 3), então aqui é sugestão + confirmação.
 */

type Pessoa = {
  chave: string; funcao_id: string; slot: number; nome: string; funcao_nome: string;
  funcionario_id: number | null; funcionario_nome: string | null;
  sugestao_id: number | null; sugestao_nome: string | null; candidatos: number; dias: number;
};
type Funcionario = { id: number; nome: string; genero: string | null; dias_trabalho_semana: number | null };
type Resposta = {
  pessoas: Pessoa[]; funcionarios: Funcionario[];
  resumo: { total: number; vinculados: number; com_sugestao: number };
};

export function VinculoRHDialog({ open, onOpenChange, soLeitura, onSalvo }: {
  open: boolean; onOpenChange: (v: boolean) => void; soLeitura: boolean; onSalvo: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const { data, mutate } = useApiSWR<Resposta>(open ? '/api/operacao/escala/vinculo' : null);
  /** escolha em edição por pessoa — só o que mudou é enviado */
  const [escolha, setEscolha] = useState<Record<string, number | null>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (!open) setEscolha({}); }, [open]);

  const pessoas = useMemo(() => data?.pessoas || [], [data]);
  const valorDe = (p: Pessoa) => (p.chave in escolha ? escolha[p.chave] : p.funcionario_id);
  const mudou = (p: Pessoa) => p.chave in escolha && escolha[p.chave] !== p.funcionario_id;
  const alteradas = pessoas.filter(mudou);

  const aceitarSugestoes = () => {
    const novas: Record<string, number | null> = { ...escolha };
    pessoas.forEach(p => { if (!p.funcionario_id && p.sugestao_id) novas[p.chave] = p.sugestao_id; });
    setEscolha(novas);
  };

  const salvar = async () => {
    if (!alteradas.length) return;
    setSalvando(true);
    try {
      const r = await api.post('/api/operacao/escala/vinculo', {
        vinculos: alteradas.map(p => ({
          funcao_id: p.funcao_id, slot: p.slot, funcionario_id: escolha[p.chave] ?? null,
        })),
      });
      showToast({
        type: 'success',
        title: `${r.pessoas} pessoa(s) vinculada(s)`,
        message: `${r.linhas} linhas da escala passaram a apontar pro RH, inclusive as passadas.`,
      });
      setEscolha({});
      await mutate();
      await onSalvo();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não vinculou', message: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  const resumo = data?.resumo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular a escala ao RH</DialogTitle>
          <DialogDescription>
            A escala tem só o primeiro nome. Ligar cada pessoa ao cadastro do RH é o que traz
            gênero, dias de trabalho por semana e ponto — o que a automação de escala vai usar.
            O vínculo vale para o histórico inteiro daquela pessoa, não só para a semana aberta.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                <b>{resumo?.vinculados}</b> de <b>{resumo?.total}</b> pessoas vinculadas
                {!!resumo?.com_sugestao && ` · ${resumo.com_sugestao} com sugestão automática`}
              </span>
              {!soLeitura && !!resumo?.com_sugestao && (
                <Button size="sm" variant="outline" onClick={aceitarSugestoes}>
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                  Aceitar as {resumo.com_sugestao} sugestões
                </Button>
              )}
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-[hsl(var(--border))]">
                  <th className="text-left font-normal py-1">Função</th>
                  <th className="text-left font-normal py-1">Na escala</th>
                  <th className="text-left font-normal py-1">Funcionário do RH</th>
                </tr>
              </thead>
              <tbody>
                {pessoas.map(p => (
                  <tr key={p.chave}
                    className={`border-b border-[hsl(var(--border))] ${mudou(p) ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                    <td className="py-1 text-muted-foreground whitespace-nowrap">{p.funcao_nome}</td>
                    <td className="py-1 whitespace-nowrap">
                      {p.nome}
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{p.dias}d</span>
                      {/* o nome que casa com mais de um é justamente o caso dos dois ALEXANDRE */}
                      {p.candidatos > 1 && !p.funcionario_id && (
                        <span className="ml-1.5 text-[10px] text-amber-600"
                          title={`${p.candidatos} funcionários com esse primeiro nome — escolha na mão`}>
                          {p.candidatos} homônimos
                        </span>
                      )}
                    </td>
                    <td className="py-1">
                      <select
                        value={valorDe(p) ?? ''}
                        disabled={soLeitura}
                        onChange={(e) => setEscolha(x => ({
                          ...x, [p.chave]: e.target.value === '' ? null : Number(e.target.value),
                        }))}
                        className="w-full h-7 px-1 text-xs border border-[hsl(var(--border))] rounded bg-transparent"
                      >
                        <option value="">
                          {p.sugestao_nome ? `— (sugestão: ${p.sugestao_nome})` : '—'}
                        </option>
                        {(data.funcionarios || []).map(f => (
                          <option key={f.id} value={f.id}>
                            {f.nome}{f.genero ? '' : ' (sem gênero)'}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!soLeitura && (
            <Button onClick={salvar} disabled={salvando || !alteradas.length}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {alteradas.length ? `Salvar ${alteradas.length} vínculo(s)` : 'Salvar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
