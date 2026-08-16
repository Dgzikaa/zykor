'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import { useBar } from '@/contexts/BarContext';
import { Loader2, Settings2 } from 'lucide-react';

/**
 * Configuração da CADEIRA: cargo, área e salário.
 *
 * Existe porque a cadeira virou a origem de tudo na contratação (decisão do Gonza, 15/08/2026) e não
 * havia onde editar nada disso — cargo e área só entravam na criação, por prompt, e salário não
 * existia em lugar nenhum.
 *
 * São DOIS níveis de salário, de propósito:
 *  · a FAIXA do CARGO (piso/teto) — cadastrada uma vez, vale para todas as cadeiras daquele cargo;
 *  · o SALÁRIO DESTA CADEIRA — o override, para quando CUMIN 1 não vale o mesmo que CUMIN 7.
 * Mexer na faixa aqui mexe no CARGO INTEIRO, então o aviso está na tela: quem edita precisa saber
 * que está mudando a referência das outras cadeiras junto.
 */

type Cargo = { id: number; nome: string; area_id: number | null; salario_min: number | null; salario_max: number | null };
type Opcao = { id: number; nome: string };
type Cadeira = {
  id: string; codigo: string;
  cargo_id: number | null; area_id: number | null;
  observacao: string | null; salario_referencia: number | null;
};
type Referencia = {
  periodo: { ano: number; mes: number } | null;
  por_cargo: Record<string, { min: number; max: number; n: number }>;
};

const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const texto = (v: number | null | undefined) => (v == null ? '' : String(v));

export function CadeiraDialog({ cadeira, cargos, areas, onClose, onSalvo }: {
  cadeira: Cadeira | null;
  cargos: Cargo[]; areas: Opcao[];
  onClose: () => void; onSalvo: () => void;
}) {
  const { showToast } = useToast();
  const { selectedBar } = useBar();
  const [form, setForm] = useState({ codigo: '', cargo_id: '', area_id: '', salario_referencia: '', observacao: '' });
  const [faixa, setFaixa] = useState({ salario_min: '', salario_max: '' });
  const [salvando, setSalvando] = useState(false);

  // Só busca quando o diálogo abre: é conta sobre a folha e não tem por que pesar no quadro.
  const { data: ref } = useApiSWR<Referencia>(cadeira && selectedBar ? '/api/rh/cargos/referencia-salarial' : null);

  useEffect(() => {
    if (!cadeira) return;
    setForm({
      codigo: cadeira.codigo,
      cargo_id: cadeira.cargo_id ? String(cadeira.cargo_id) : '',
      area_id: cadeira.area_id ? String(cadeira.area_id) : '',
      salario_referencia: texto(cadeira.salario_referencia),
      observacao: cadeira.observacao || '',
    });
  }, [cadeira]);

  const cargo = form.cargo_id ? cargos.find((c) => String(c.id) === form.cargo_id) : null;

  // A faixa segue o cargo escolhido: trocar o cargo no seletor troca a faixa que está sendo editada.
  useEffect(() => {
    setFaixa({ salario_min: texto(cargo?.salario_min), salario_max: texto(cargo?.salario_max) });
  }, [cargo?.id, cargo?.salario_min, cargo?.salario_max]);

  if (!cadeira) return null;

  const folha = cargo && ref?.por_cargo?.[String(cargo.id)];
  const periodo = ref?.periodo ? `${MESES[ref.periodo.mes - 1]}/${ref.periodo.ano}` : null;
  const faixaMudou = cargo
    ? faixa.salario_min !== texto(cargo.salario_min) || faixa.salario_max !== texto(cargo.salario_max)
    : false;

  const salvar = async () => {
    if (!form.codigo.trim()) { showToast({ type: 'error', title: 'A cadeira precisa de um nome' }); return; }
    setSalvando(true);
    try {
      // Faixa primeiro: se ela for recusada (teto abaixo do piso), nada é gravado — salvar a cadeira
      // e falhar na faixa deixaria a tela dizendo "salvo" com metade do trabalho perdido.
      if (cargo && faixaMudou) {
        await api.put('/api/rh/cargos', {
          id: cargo.id,
          salario_min: faixa.salario_min === '' ? null : Number(faixa.salario_min),
          salario_max: faixa.salario_max === '' ? null : Number(faixa.salario_max),
        });
      }
      await api.post('/api/rh/organograma', {
        acao: 'editar',
        cadeira_id: cadeira.id,
        codigo: form.codigo,
        cargo_id: form.cargo_id ? Number(form.cargo_id) : null,
        area_id: form.area_id ? Number(form.area_id) : null,
        salario_referencia: form.salario_referencia === '' ? null : Number(form.salario_referencia),
        observacao: form.observacao,
      });
      showToast({ type: 'success', title: 'Cadeira atualizada' });
      onSalvo();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message });
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />Cadeira {cadeira.codigo}
          </DialogTitle>
          <DialogDescription>
            É a cadeira que define função, área e salário de quem for contratado nela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da cadeira</Label>
            <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="CHEFE DE ATENDIMENTO" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Área antes do cargo: é ela que filtra a lista (mesma regra do cadastro). */}
            <div className="space-y-1.5">
              <Label className="text-xs">Área</Label>
              <select className={sel} value={form.area_id}
                onChange={(e) => setForm({ ...form, area_id: e.target.value, cargo_id: '' })}>
                <option value="">—</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo</Label>
              <select className={sel} value={form.cargo_id} onChange={(e) => setForm({ ...form, cargo_id: e.target.value })}>
                <option value="">—</option>
                {cargos
                  .filter((c) => !form.area_id || c.area_id == null || String(c.area_id) === form.area_id)
                  .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-xs">Salário desta cadeira (R$)</Label>
            <Input type="number" step="0.01" placeholder={cargo?.salario_min != null ? `${cargo.salario_min} (piso do cargo)` : 'em branco = usa a faixa do cargo'}
              value={form.salario_referencia} onChange={(e) => setForm({ ...form, salario_referencia: e.target.value })} />
            <p className="text-[11px] text-muted-foreground">
              Vale só para esta cadeira e sobrepõe a faixa do cargo. Deixe em branco quando ela pagar o
              padrão do cargo.
            </p>
          </div>

          {cargo ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Faixa do cargo · {cargo.nome}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Piso (R$)</Label>
                  <Input className="h-8" type="number" step="0.01" placeholder="—"
                    value={faixa.salario_min} onChange={(e) => setFaixa({ ...faixa, salario_min: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Teto (R$)</Label>
                  <Input className="h-8" type="number" step="0.01" placeholder="—"
                    value={faixa.salario_max} onChange={(e) => setFaixa({ ...faixa, salario_max: e.target.value })} />
                </div>
              </div>
              {/* A folha é a única fonte de valor real que existe hoje; o mês vem junto porque o dado
                  pode estar velho e ninguém deve confundir "o que já se pagou" com "o que vale hoje". */}
              {folha && periodo && (
                <p className="text-[11px] text-muted-foreground">
                  Pela folha de <strong>{periodo}</strong>, este cargo pagou {moeda(folha.min)}
                  {folha.max !== folha.min && ` a ${moeda(folha.max)}`} ({folha.n} pessoa{folha.n > 1 ? 's' : ''}).
                </p>
              )}
              {faixaMudou && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  A faixa é do cargo, não desta cadeira: salvar muda a referência de <strong>todas</strong> as
                  cadeiras de {cargo.nome}.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Sem cargo definido não há faixa salarial nem sugestão na contratação — escolha o cargo acima.
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Observação</Label>
            <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
