'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';

/**
 * Escala PADRÃO de uma pessoa — o molde de uma semana normal dela.
 *
 * Pedido do Gonza (19/08/2026): "pode ter uma canetinha pra editar escala padrão, ao lado do
 * nome". Fica aqui, e não numa tela de cadastro à parte, porque é onde a operação já está
 * olhando a escala.
 *
 * Serve de base pro botão "Puxar do organograma": ao montar uma semana nova, quem tem padrão
 * nasce com o horário dela em vez de FOLGA.
 *
 * Fala a MESMA gramática da célula da grade — "17:00-02:30" ou um marcador (FOLGA, FÉRIAS…) —
 * usando o mesmo parser (`parseTextoEscala`). Se as duas divergissem, o mesmo texto passaria a
 * significar coisas diferentes em dois cantos da mesma tela.
 */

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

type Dia = { dia_semana: number; entra: string | null; sai: string | null; marcador: string | null };

const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : '');
const textoDe = (d: Dia | undefined) => {
  if (!d) return '';
  if (d.marcador) return d.marcador;
  if (d.entra) return `${hhmm(d.entra)}${d.sai ? '-' + hhmm(d.sai) : ''}`;
  return '';
};

export function PadraoPessoaDialog({
  pessoa, onFechar, onSalvo, parse,
}: {
  pessoa: { funcionario_id: number; nome: string } | null;
  onFechar: () => void;
  onSalvo: () => Promise<void>;
  /** o parser da grade, injetado pra não existirem duas gramáticas */
  parse: (txt: string) => { entra: string | null; sai: string | null; marcador: string | null };
}) {
  const { showToast } = useToast();
  const [textos, setTextos] = useState<string[]>(Array(7).fill(''));
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!pessoa) return;
    let vivo = true;
    setCarregando(true);
    api.get(`/api/operacao/escala/padrao?funcionario_id=${pessoa.funcionario_id}`)
      .then((r) => {
        if (!vivo) return;
        const porDia = new Map<number, Dia>((r.dias || []).map((d: Dia) => [d.dia_semana, d]));
        setTextos(Array.from({ length: 7 }, (_, i) => textoDe(porDia.get(i))));
      })
      .catch((e) => showToast({ type: 'error', title: 'Não carregou', message: e?.message }))
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [pessoa, showToast]);

  const salvar = async () => {
    if (!pessoa) return;
    setSalvando(true);
    try {
      const dias = textos.map((t, i) => {
        const v = parse(t);
        return { dia_semana: i, entra: v.entra, sai: v.sai, marcador: v.marcador };
      });
      const r = await api.post('/api/operacao/escala/padrao', {
        acao: 'salvar_pessoa', funcionario_id: pessoa.funcionario_id, dias,
      });
      showToast({
        type: 'success', title: 'Escala padrão salva',
        message: `${r.gravados} dia(s) no molde de ${pessoa.nome}`,
      });
      await onSalvo();
      onFechar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open={!!pessoa} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Escala padrão · {pessoa?.nome}</DialogTitle>
          <DialogDescription className="text-xs">
            A semana normal dela. Ao montar uma semana nova com &ldquo;Puxar do organograma&rdquo;,
            é isto que entra — em vez de tudo FOLGA. Escreva o horário (<b>17:00-02:30</b>) ou um
            marcador (<b>FOLGA</b>, <b>FÉRIAS</b>…). Vazio = sem padrão nesse dia.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="space-y-1.5">
            {DIAS.map((d, i) => (
              <div key={d} className="flex items-center gap-2">
                <span className="w-20 text-xs text-muted-foreground">{d}</span>
                <input
                  value={textos[i]}
                  onChange={(e) => setTextos(x => x.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder="17:00-02:30 ou FOLGA"
                  className="flex-1 h-9 px-2 text-sm rounded border border-[hsl(var(--border))] bg-transparent"
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || carregando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar padrão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
