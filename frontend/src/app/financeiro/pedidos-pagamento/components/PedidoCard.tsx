'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Check, X, Loader2, Sparkles, Paperclip, CalendarClock } from 'lucide-react';
import {
  TIPO_LABEL, STATUS_LABEL, STATUS_COLOR, formatBRL, type Pedido,
} from '../types';

export interface Opcao { value: string; label: string; searchHint?: string }

// Fluxo em 2 etapas: APROVAR (decisão) → AGENDAR (dispara CA + Inter).
const APROVAVEL = ['aguardando_aprovacao'];
const AGENDAVEL = ['aprovado', 'erro_ca', 'erro_inter'];

/**
 * Card da lista de pedidos. Para quem aprova (financeiro), traz os controles inline
 * — categoria (com sugestão do Zykor), conta pagadora, fornecedor CA e Aprovar/Reprovar —
 * pra despachar o "de sempre" sem abrir o pedido. Clicar no corpo abre o detalhe.
 */
export function PedidoCard({
  pedido, podeAprovar, categorias, contas, contaPadrao, fornecedores, onOpen, onChange, onSelecao,
}: {
  pedido: Pedido;
  podeAprovar: boolean;
  categorias: Opcao[];
  contas: Opcao[];
  contaPadrao?: string; // conta pagadora padrão do bar (pré-seleção quando o pedido não tem conta)
  fornecedores: Opcao[];
  onOpen: (id: string) => void;
  onChange: () => void;
  // Reporta as seleções pro pai (usado pelo "Aprovar todos" em lote).
  onSelecao?: (id: string, sel: { catId: string; contaId: string; fornId: string }) => void;
}) {
  const { showToast } = useToast();
  const mostrarInline = podeAprovar && APROVAVEL.includes(pedido.status);
  // Esconde "Agendar" de copia-e-cola já lançado no CA (status fica 'aprovado' pós-lançamento).
  const podeAgendar = podeAprovar && AGENDAVEL.includes(pedido.status)
    && !(pedido.status === 'aprovado' && !!pedido.contaazul_lancamento_id);

  // Sugestão do Zykor entra como default quando o pedido ainda não tem categoria.
  const catSugerida = !pedido.categoria_id && pedido.categoria_sugerida_id;
  const [catId, setCatId] = useState(pedido.categoria_id || pedido.categoria_sugerida_id || '');
  const [contaId, setContaId] = useState(pedido.conta_financeira_id || '');
  const [fornId, setFornId] = useState(pedido.contaazul_pessoa_id || '');
  const [acao, setAcao] = useState<null | 'aprovar' | 'rejeitar' | 'agendar'>(null);

  // Conta efetiva = a escolhida OU a padrão do bar. Assim o select já exibe a conta padrão
  // selecionada (ex.: "Ordinário Inter (INTER)") em vez de só o placeholder "Padrão do bar".
  const contaEfetiva = contaId || contaPadrao || '';

  const usouSugestao = useMemo(
    () => !!catSugerida && catId === pedido.categoria_sugerida_id,
    [catSugerida, catId, pedido.categoria_sugerida_id]
  );

  // Reporta as seleções atuais pro pai (o "Aprovar todos" precisa saber o que já está pronto).
  useEffect(() => {
    onSelecao?.(pedido.id, { catId, contaId: contaEfetiva, fornId });
  }, [catId, contaEfetiva, fornId, pedido.id, onSelecao]);

  const aprovar = async () => {
    if (!catId) return showToast({ type: 'error', title: 'Escolha a categoria' });
    if (!fornId) return showToast({ type: 'error', title: 'Escolha o fornecedor no Conta Azul' });
    setAcao('aprovar');
    try {
      await api.post(`/api/financeiro/pedidos-pagamento/${pedido.id}/aprovar`, {
        categoria_id: catId,
        categoria_nome: categorias.find(c => c.value === catId)?.label,
        conta_financeira_id: contaEfetiva || undefined,
        contaazul_pessoa_id: fornId,
      });
      showToast({ type: 'success', title: 'Aprovado!', message: 'Foi pra aba Aprovado. Clique em "Agendar" pra disparar CA + Inter.' });
      onChange();
    } catch (e: any) {
      const msg = e?.message || '';
      // Conta/Inter/fornecedor faltando = precisa abrir o pedido pra completar
      showToast({
        type: 'error', title: 'Não deu pra aprovar por aqui',
        message: /credencial Inter|conta financeira/.test(msg) ? `${msg} Abra o pedido pra completar.` : msg,
      });
      onChange();
    } finally {
      setAcao(null);
    }
  };

  // AGENDAR (etapa 2): dispara a criação no CA + PIX no Inter de um pedido já aprovado.
  const agendar = async () => {
    setAcao('agendar');
    try {
      await api.post(`/api/financeiro/pedidos-pagamento/${pedido.id}/agendar`, {});
      showToast({ type: 'success', title: 'Agendado!', message: 'Conta criada no CA e PIX agendado no Inter.' });
      onChange();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao agendar', message: e?.message });
      onChange();
    } finally {
      setAcao(null);
    }
  };

  const rejeitar = async () => {
    const motivo = window.prompt('Motivo da recusa:')?.trim();
    if (!motivo) return;
    setAcao('rejeitar');
    try {
      await api.post(`/api/financeiro/pedidos-pagamento/${pedido.id}/rejeitar`, { motivo });
      showToast({ type: 'success', title: 'Pedido recusado' });
      onChange();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao recusar', message: e?.message });
    } finally {
      setAcao(null);
    }
  };

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-card transition hover:bg-muted/20">
      <div className="flex items-center gap-3 p-3">
        <button onClick={() => onOpen(pedido.id)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{pedido.descricao}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">{TIPO_LABEL[pedido.tipo]}</Badge>
            {pedido.precisa_comprovante && (
              <Badge className="bg-amber-500/15 text-amber-600 text-[10px] shrink-0 gap-0.5">
                <Paperclip className="w-2.5 h-2.5" />Comprovante
              </Badge>
            )}
            {pedido.pix_copia_cola && (
              <Badge className="bg-purple-500/15 text-purple-600 text-[10px] shrink-0">Copia e cola</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
            <div className="truncate">
              Solicitante: <span className="text-foreground/80">{pedido.solicitante_nome || '—'}</span>
              {pedido.beneficiario_nome ? ` · recebe: ${pedido.beneficiario_nome}` : ''}
            </div>
            <div className="truncate">
              Criado por: <span className="text-foreground/80">{pedido.solicitante_nome || '—'}</span> · vence {pedido.data_vencimento}
              {pedido.data_competencia ? ` · comp. ${pedido.data_competencia}` : ''}
            </div>
          </div>
        </button>
        <div className="text-right shrink-0">
          <div className="font-semibold">{formatBRL(pedido.valor)}</div>
          <Badge className={`${STATUS_COLOR[pedido.status]} text-[10px] mt-0.5`}>{STATUS_LABEL[pedido.status]}</Badge>
        </div>
        {mostrarInline && (
          <div className="flex flex-col gap-1 shrink-0">
            <Button size="sm" className="h-7 px-2" onClick={aprovar} disabled={!!acao}>
              {acao === 'aprovar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" />Aprovar</>}
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 hover:text-red-700" onClick={rejeitar} disabled={!!acao}>
              {acao === 'rejeitar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><X className="w-3.5 h-3.5 mr-1" />Recusar</>}
            </Button>
          </div>
        )}
        {podeAgendar && (
          <Button size="sm" className="h-7 px-2 shrink-0" onClick={agendar} disabled={!!acao}
            title={pedido.status === 'erro_ca' || pedido.status === 'erro_inter' ? 'Tentar agendar de novo' : 'Criar no CA e agendar o PIX no Inter'}>
            {acao === 'agendar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CalendarClock className="w-3.5 h-3.5 mr-1" />{pedido.status === 'aprovado' ? 'Agendar' : 'Reagendar'}</>}
          </Button>
        )}
      </div>

      {mostrarInline && (
        <div className="border-t border-[hsl(var(--border))] px-3 py-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <div className="flex items-center gap-1 mb-1 text-[11px] text-muted-foreground">
              Categoria
              {usouSugestao && (
                <span className="inline-flex items-center gap-0.5 text-blue-600"><Sparkles className="w-3 h-3" /> sugerida</span>
              )}
            </div>
            <SearchableSelect value={catId} onValueChange={(v) => setCatId(v || '')}
              placeholder="Categoria" searchPlaceholder="Filtrar..." emptyMessage="Nenhuma" options={categorias} />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">Conta pagadora (CA/Inter)</div>
            <SearchableSelect value={contaEfetiva} onValueChange={(v) => setContaId(v || '')}
              placeholder="Padrão do bar" searchPlaceholder="Filtrar..." emptyMessage="Nenhuma" options={contas} />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">Fornecedor CA</div>
            <SearchableSelect value={fornId} onValueChange={(v) => setFornId(v || '')}
              placeholder="Selecione" searchPlaceholder="Buscar..." emptyMessage="Abra o pedido p/ cadastrar" options={fornecedores} />
          </div>
        </div>
      )}
    </div>
  );
}
