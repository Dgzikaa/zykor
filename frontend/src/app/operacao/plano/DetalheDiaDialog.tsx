'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Sparkles } from 'lucide-react';

/**
 * Painel do dia — o briefing que veio da planilha e não tinha onde aparecer.
 *
 * São 248 dias de conteúdo importado (programação musical e esportiva, plano de chão,
 * promoção, couvert/entrada, pílula de treinamento, observações) que ficavam invisíveis
 * porque a grade só mostra números. Sem isto o time abriria a tela sentindo que perdeu
 * informação que tinha no Excel.
 *
 * Aqui também mora o "esse dia é diferente": data especial + ticket e giro próprios,
 * que era o pedido de poder mudar o parâmetro num dia de festival.
 */

export type DiaDetalhe = {
  data: string;
  turno: 'unico' | 'dia' | 'noite';
  programacao_musical: string | null;
  programacao_esportiva: string | null;
  entrada: string | null;
  promocao: string | null;
  plano_chao: string | null;
  pilula_treinamento: string | null;
  observacoes: string | null;
  data_especial: string | null;
};

const CAMPOS: Array<{ campo: keyof DiaDetalhe; label: string; linhas?: number }> = [
  { campo: 'programacao_musical', label: 'Programação musical', linhas: 2 },
  { campo: 'programacao_esportiva', label: 'Programação esportiva', linhas: 2 },
  { campo: 'entrada', label: 'Entrada / couvert' },
  { campo: 'promocao', label: 'Promoção do dia' },
  { campo: 'plano_chao', label: 'Plano de chão', linhas: 4 },
  { campo: 'pilula_treinamento', label: 'Pílula de treinamento', linhas: 3 },
  { campo: 'observacoes', label: 'Observações', linhas: 2 },
];

export function DetalheDiaDialog({ dia, titulo, soLeitura, onFechar, onSalvo }: {
  dia: DiaDetalhe;
  titulo: string;
  soLeitura: boolean;
  onFechar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS.map(c => [String(c.campo), (dia[c.campo] as string) || ''])));
  const [especial, setEspecial] = useState(dia.data_especial || '');
  const [ticket, setTicket] = useState('');
  const [giro, setGiro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.patch('/api/operacao/plano/dia', {
        data: dia.data,
        turno: dia.turno,
        ...form,
        data_especial: especial || null,
        ...(ticket !== '' ? { ticket_medio_manual: Number(ticket.replace(',', '.')) } : {}),
        ...(giro !== '' ? { giro_manual: Number(giro.replace(',', '.')) } : {}),
      });
      showToast({ type: 'success', title: 'Dia salvo' });
      await onSalvo();
      onFechar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não salvou', message: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Programação, plano de chão e briefing do dia — o conteúdo que ficava nas linhas de
            texto da planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {CAMPOS.map(c => (
            <div key={String(c.campo)}>
              <Label className="text-xs">{c.label}</Label>
              <Textarea
                rows={c.linhas || 1}
                value={form[String(c.campo)] || ''}
                disabled={soLeitura}
                onChange={(e) => setForm(f => ({ ...f, [String(c.campo)]: e.target.value }))}
                className="text-sm"
              />
            </div>
          ))}

          <div className="rounded-lg border border-[hsl(var(--border))] p-3 space-y-2">
            <div className="text-xs font-medium inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />Dia atípico
            </div>
            <p className="text-[11px] text-muted-foreground">
              Marque quando o dia foge do padrão (festival, feriado, jogo grande). O ticket e o giro
              abaixo valem só para este dia — em branco, usa o parâmetro do dia da semana.
            </p>
            <Input value={especial} disabled={soLeitura} placeholder="ex.: Festival de inverno"
              onChange={(e) => setEspecial(e.target.value)} className="h-8 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Ticket médio deste dia</Label>
                <Input value={ticket} disabled={soLeitura} placeholder="usar o padrão" inputMode="decimal"
                  onChange={(e) => setTicket(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[11px]">Giro deste dia</Label>
                <Input value={giro} disabled={soLeitura} placeholder="usar o padrão" inputMode="decimal"
                  onChange={(e) => setGiro(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Fechar</Button>
          {!soLeitura && (
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
