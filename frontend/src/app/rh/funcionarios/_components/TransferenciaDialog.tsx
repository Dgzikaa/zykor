'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, ArrowRightLeft } from 'lucide-react';

/**
 * Transferir alguém de empresa do grupo (Ordinário ↔ Deboche ↔ Escritório Central).
 *
 * Substitui o "mover para o organograma administrativo" que existia dentro da cadeira: aquele
 * mudava a pessoa de lugar sem registrar nada. Aqui fica data, destino e motivo, e o histórico
 * aparece no próprio diálogo — daqui a um ano dá pra saber que houve transferência, e quando.
 */
const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

type Transf = {
  id: string; data: string; motivo: string | null;
  bar_origem_nome: string; bar_destino_nome: string;
};

export function TransferenciaDialog({ funcionario, open, onClose, onTransferido }: {
  funcionario: { id: number; nome: string; bar_id: number } | null;
  open: boolean; onClose: () => void; onTransferido: () => void;
}) {
  const { showToast } = useToast();
  const [bares, setBares] = useState<{ id: number; nome: string }[]>([]);
  const [historico, setHistorico] = useState<Transf[]>([]);
  const [destino, setDestino] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open || !funcionario) return;
    setDestino(''); setMotivo(''); setData(new Date().toISOString().slice(0, 10));
    api.get(`/api/rh/funcionarios/${funcionario.id}/transferir`)
      .then((r: any) => { setBares(r.bares || []); setHistorico(r.transferencias || []); })
      .catch(() => { setBares([]); setHistorico([]); });
  }, [open, funcionario]);

  const transferir = async () => {
    if (!funcionario || !destino) return;
    setSalvando(true);
    try {
      const r = await api.post(`/api/rh/funcionarios/${funcionario.id}/transferir`, {
        bar_destino: Number(destino), data, motivo: motivo.trim() || undefined,
      });
      showToast({ type: 'success', title: `${r.nome} foi para ${r.destino}`, message: r.aviso });
      onTransferido();
      onClose();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não transferiu', message: e?.message });
    } finally { setSalvando(false); }
  };

  const outras = bares.filter(b => b.id !== funcionario?.bar_id);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            Transferir de empresa
          </DialogTitle>
          <DialogDescription>
            {funcionario?.nome} sai da empresa atual e passa a contar no quadro da empresa de
            destino. A cadeira que ocupa aqui é liberada na data da transferência — alocar na nova
            é feito pelo Organograma de lá.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Empresa de destino</Label>
            <select className={sel} value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Selecione…</option>
              {outras.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data da transferência</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: passou a atender toda a rede pelo Escritório Central" />
          </div>

          {historico.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Transferências anteriores
              </div>
              <ul className="space-y-1 text-xs">
                {historico.map(t => (
                  <li key={t.id} className="flex items-start gap-1.5">
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {String(t.data).split('-').reverse().join('/')}
                    </span>
                    <span>{t.bar_origem_nome} → <b>{t.bar_destino_nome}</b>{t.motivo ? ` · ${t.motivo}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={transferir} disabled={salvando || !destino}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
