'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';

/**
 * Parâmetros do plano operacional (o bloco "Parâmetros - não mexer" da planilha).
 *
 * Salvar NÃO edita a vigência atual: fecha ela e abre uma nova a partir de hoje. Sem isso,
 * mudar a diária hoje reescreveria o custo projetado de junho e um mês já fechado mudaria
 * de valor sozinho — a mesma armadilha que já custou uma investigação no CMV teórico.
 */

const NOME_DOW = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
// segunda→domingo, a ordem que a operação pensa a semana
const ORDEM_DOW = [1, 2, 3, 4, 5, 6, 0];

export function ParametrosDialog({ open, onOpenChange, soLeitura, onSalvo }: {
  open: boolean; onOpenChange: (v: boolean) => void; soLeitura: boolean; onSalvo: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const { data, mutate } = useApiSWR<any>(open ? '/api/operacao/parametros' : null);
  const [giro, setGiro] = useState('');
  const [tickets, setTickets] = useState<Record<number, string>>({});
  const [porFuncao, setPorFuncao] = useState<Record<string, { nivel: string; diaria: string }>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!data?.parametro) return;
    setGiro(String(data.parametro.giro ?? ''));
    setTickets(Object.fromEntries((data.tickets || []).map((t: any) => [Number(t.dia_semana), String(t.ticket_medio)])));
    setPorFuncao(Object.fromEntries((data.por_funcao || []).map((f: any) => [f.funcao_id, {
      nivel: f.nivel_servico == null ? '' : String(f.nivel_servico),
      diaria: f.diaria == null ? '' : String(f.diaria),
    }])));
  }, [data]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const n = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
      const r = await api.put('/api/operacao/parametros', {
        giro: Number(giro.replace(',', '.')),
        tickets: Object.entries(tickets)
          .map(([dow, v]) => ({ dia_semana: Number(dow), ticket_medio: n(v) }))
          .filter(t => t.ticket_medio != null),
        por_funcao: Object.entries(porFuncao)
          .map(([funcao_id, v]) => ({ funcao_id, nivel_servico: n(v.nivel), diaria: n(v.diaria) })),
      });
      showToast({
        type: 'success',
        title: 'Parâmetros salvos',
        message: r.fechou_anterior
          ? `Nova vigência a partir de ${String(r.vigencia_inicio).split('-').reverse().join('/')} — o passado fica com os números antigos.`
          : undefined,
      });
      await mutate();
      await onSalvo();
      onOpenChange(false);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parâmetros do plano operacional</DialogTitle>
          <DialogDescription>
            Salvar não altera o passado: fecha a vigência atual e abre uma nova a partir de hoje.
            Os meses já planejados continuam com os números com que foram calculados.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Giro de lotação</Label>
              <Input value={giro} disabled={soLeitura} inputMode="decimal"
                onChange={(e) => setGiro(e.target.value)} className="h-8 text-sm w-32" />
              <p className="text-[11px] text-muted-foreground mt-1">Pico de lugares = público ÷ giro.</p>
            </div>

            <div>
              <Label className="text-xs">Ticket médio por dia da semana</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                {ORDEM_DOW.map(dow => (
                  <div key={dow}>
                    <div className="text-[11px] text-muted-foreground">{NOME_DOW[dow]}</div>
                    <Input value={tickets[dow] ?? ''} disabled={soLeitura} inputMode="decimal"
                      onChange={(e) => setTickets(t => ({ ...t, [dow]: e.target.value }))}
                      className="h-8 text-sm" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Nível de serviço e diária por função</Label>
              <p className="text-[11px] text-muted-foreground mb-1">
                Nível de serviço = quantas pessoas 1 funcionário atende. Função sem nível não calcula
                total automático; função sem diária não entra no custo projetado.
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left font-normal py-1">Função</th>
                    <th className="text-right font-normal py-1 w-28">Pessoas por 1</th>
                    <th className="text-right font-normal py-1 w-28">Diária</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.funcoes || []).map((f: any) => (
                    <tr key={f.id} className="border-t border-[hsl(var(--border))]">
                      <td className="py-1">
                        {f.nome}
                        {!f.entra_no_custo && (
                          <span className="ml-1 text-[10px] text-muted-foreground">(fora do custo)</span>
                        )}
                      </td>
                      <td className="py-1">
                        <Input value={porFuncao[f.id]?.nivel ?? ''} disabled={soLeitura} inputMode="decimal"
                          onChange={(e) => setPorFuncao(p => ({
                            ...p, [f.id]: { ...(p[f.id] || { nivel: '', diaria: '' }), nivel: e.target.value },
                          }))}
                          className="h-7 text-xs text-right" />
                      </td>
                      <td className="py-1">
                        <Input value={porFuncao[f.id]?.diaria ?? ''} disabled={soLeitura} inputMode="decimal"
                          onChange={(e) => setPorFuncao(p => ({
                            ...p, [f.id]: { ...(p[f.id] || { nivel: '', diaria: '' }), diaria: e.target.value },
                          }))}
                          className="h-7 text-xs text-right" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.historico?.length > 1 && (
              <p className="text-[11px] text-muted-foreground">
                {data.historico.length} vigências registradas — a mais antiga começa em{' '}
                {String(data.historico[data.historico.length - 1].vigencia_inicio).split('-').reverse().join('/')}.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!soLeitura && (
            <Button onClick={salvar} disabled={salvando || !data?.parametro}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar nova vigência
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
