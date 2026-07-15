'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Loader2, Check, X, CalendarClock, Trash2, Sparkles } from 'lucide-react';
import { STATUS_COLOR, statusLabel, formatBRL, type PedidoStatus } from '../types';
import type { Opcao } from './PedidoCard';

// Item de freela na visão do FINANCEIRO — carrega o vínculo CA (categoria/fornecedor) pra
// o financeiro completar quando o cadastro do freela não trouxe (aprovar exige os dois).
export type FreelaFinItem = {
  id: string;
  beneficiario_nome?: string | null;
  funcao?: string | null;
  valor: number;
  status: PedidoStatus;
  data_competencia?: string | null;
  data_vencimento: string;
  categoria_id?: string | null;
  categoria_sugerida_id?: string | null;
  contaazul_pessoa_id?: string | null;
};

const DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function rotuloDia(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIA_SEMANA[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

const APROVAVEL: PedidoStatus[] = ['aguardando_aprovacao'];
const AGENDAVEL: PedidoStatus[] = ['aprovado', 'erro_ca', 'erro_inter'];
// Excluível pelo financeiro (cancela; se já subiu ao Inter, o back desfaz o agendamento). Pago/já
// finalizado por recusa não entram.
const EXCLUIVEL: PedidoStatus[] = ['aguardando_aprovacao', 'aprovado', 'aguardando_socio', 'agendado', 'erro_ca', 'erro_inter'];

export type FreelaVinculo = { categoria_id: string; contaazul_pessoa_id: string };

/**
 * Freela no FINANCEIRO — agrupado por PESSOA. Cada pessoa tem UM vínculo CA (categoria +
 * fornecedor), que o financeiro escolhe uma vez e vale pras diárias dela. "Aprovar" despacha
 * todas as diárias `aguardando_aprovacao` da pessoa com esse vínculo; "Recusar" idem. Agendar
 * e Excluir são por diária (status pode diferir entre dias).
 */
export function FreelaFinanceiro({
  itens, podeAprovar, categorias, fornecedores, busyId, onAprovar, onReprovar, onAgendar, onExcluir,
}: {
  itens: FreelaFinItem[];
  podeAprovar: boolean;
  categorias: Opcao[];
  fornecedores: Opcao[];
  busyId: string | null;
  onAprovar: (ids: string[], v: FreelaVinculo) => void;
  onReprovar: (ids: string[]) => void;
  onAgendar: (id: string) => void;
  onExcluir: (id: string) => void;
}) {
  const grupos = useMemo(() => {
    const m = new Map<string, FreelaFinItem[]>();
    for (const it of itens) {
      const k = it.beneficiario_nome || '—';
      (m.get(k) || m.set(k, []).get(k)!).push(it);
    }
    return Array.from(m.entries())
      .map(([k, lista]) => [k, lista.slice().sort((a, b) =>
        (a.data_competencia || a.data_vencimento).localeCompare(b.data_competencia || b.data_vencimento))] as const)
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [itens]);

  return (
    <div className="space-y-2">
      {grupos.map(([nome, lista]) => (
        <GrupoPessoa
          key={nome}
          nome={nome}
          lista={lista}
          podeAprovar={podeAprovar}
          categorias={categorias}
          fornecedores={fornecedores}
          busyId={busyId}
          onAprovar={onAprovar}
          onReprovar={onReprovar}
          onAgendar={onAgendar}
          onExcluir={onExcluir}
        />
      ))}
    </div>
  );
}

function GrupoPessoa({
  nome, lista, podeAprovar, categorias, fornecedores, busyId, onAprovar, onReprovar, onAgendar, onExcluir,
}: {
  nome: string;
  lista: readonly FreelaFinItem[];
  podeAprovar: boolean;
  categorias: Opcao[];
  fornecedores: Opcao[];
  busyId: string | null;
  onAprovar: (ids: string[], v: FreelaVinculo) => void;
  onReprovar: (ids: string[]) => void;
  onAgendar: (id: string) => void;
  onExcluir: (id: string) => void;
}) {
  const pendentes = lista.filter((it) => APROVAVEL.includes(it.status));
  const base = pendentes[0] || lista[0];
  const [catId, setCatId] = useState(base?.categoria_id || base?.categoria_sugerida_id || '');
  const [fornId, setFornId] = useState(base?.contaazul_pessoa_id || '');
  const funcao = lista.find((it) => it.funcao)?.funcao || null;
  const total = lista.reduce((s, i) => s + Number(i.valor || 0), 0);
  const idsPendentes = pendentes.map((it) => it.id);
  const grupoBusy = lista.some((it) => it.id === busyId);
  const usouSugestao = !!base?.categoria_sugerida_id && catId === base.categoria_sugerida_id && !base.categoria_id;

  const aprovar = () => {
    if (!catId || !fornId) return;
    onAprovar(idsPendentes, { categoria_id: catId, contaazul_pessoa_id: fornId });
  };

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/50">
        <span className="text-sm font-semibold truncate">
          {nome}
          {funcao && <span className="text-muted-foreground font-normal"> · {funcao}</span>}
          <span className="text-muted-foreground font-normal"> · {lista.length} diária(s)</span>
        </span>
        <span className="text-sm font-semibold shrink-0">{formatBRL(total)}</span>
      </div>

      <div className="divide-y divide-[hsl(var(--border))]/50">
        {lista.map((it) => (
          <div key={it.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
            <span className="flex-1 truncate">{rotuloDia(it.data_competencia || it.data_vencimento)}</span>
            <Badge className={`${STATUS_COLOR[it.status]} text-[10px] shrink-0`}>{statusLabel(it)}</Badge>
            <span className="tabular-nums font-medium w-24 text-right shrink-0">{formatBRL(it.valor)}</span>
            {podeAprovar && (
              <div className="shrink-0 flex items-center gap-1">
                {AGENDAVEL.includes(it.status) && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={grupoBusy} onClick={() => onAgendar(it.id)} title="Criar no CA e enviar ao Inter">
                    {busyId === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CalendarClock className="w-3 h-3 mr-1" />Subir</>}
                  </Button>
                )}
                {EXCLUIVEL.includes(it.status) && (
                  <button onClick={() => onExcluir(it.id)} disabled={grupoBusy} title="Excluir/cancelar esta diária" className="text-muted-foreground hover:text-red-600 disabled:opacity-40">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Vínculo CA + Aprovar/Recusar da pessoa — só quando há diárias esperando aprovação. */}
      {podeAprovar && pendentes.length > 0 && (
        <div className="border-t border-[hsl(var(--border))] px-3 py-2 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <div className="flex items-center gap-1 mb-1 text-[11px] text-muted-foreground">
              Categoria
              {usouSugestao && <span className="inline-flex items-center gap-0.5 text-blue-600"><Sparkles className="w-3 h-3" /> sugerida</span>}
            </div>
            <SearchableSelect value={catId} onValueChange={(v) => setCatId(v || '')}
              placeholder="Categoria" searchPlaceholder="Filtrar..." emptyMessage="Nenhuma" options={categorias} />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">Fornecedor CA</div>
            <SearchableSelect value={fornId} onValueChange={(v) => setFornId(v || '')}
              placeholder="Selecione" searchPlaceholder="Buscar..." emptyMessage="Nenhum" options={fornecedores} />
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" className="h-8 px-2.5" disabled={grupoBusy || !catId || !fornId} onClick={aprovar}
              title={!catId || !fornId ? 'Escolha categoria e fornecedor' : 'Aprovar as diárias pendentes desta pessoa'}>
              {grupoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" />Aprovar ({pendentes.length})</>}
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-2 text-red-600 hover:text-red-700" disabled={grupoBusy} onClick={() => onReprovar(idsPendentes)} title="Recusar as diárias pendentes desta pessoa">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
