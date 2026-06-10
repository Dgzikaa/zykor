'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import {
  Loader2, Send, Check, X, Paperclip, Trash2, FileText, History, Save,
} from 'lucide-react';
import {
  TIPO_LABEL, STATUS_LABEL, STATUS_COLOR, formatBRL,
  type Pedido, type Comentario, type Anexo, type HistoricoItem,
} from '../types';

interface Opcao { value: string; label: string; searchHint?: string }

export function PedidoDetailDialog({
  pedidoId, barId, onClose, onChange,
}: {
  pedidoId: string | null;
  barId: number;
  onClose: () => void;
  onChange: () => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [podeAprovar, setPodeAprovar] = useState(false);
  const [podeExcluir, setPodeExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Edição inline dos campos do pedido
  const [edit, setEdit] = useState<Partial<Pedido>>({});
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  // Opções do painel de aprovação
  const [categorias, setCategorias] = useState<Opcao[]>([]);
  const [centros, setCentros] = useState<Opcao[]>([]);
  const [contas, setContas] = useState<Opcao[]>([]);
  const [fornecedores, setFornecedores] = useState<Opcao[]>([]);
  const [interCreds, setInterCreds] = useState<Opcao[]>([]);
  const [aprov, setAprov] = useState({
    categoria_id: '', centro_custo_id: '', contaazul_pessoa_id: '',
    conta_financeira_id: '', inter_credencial_id: '',
  });
  const [aprovando, setAprovando] = useState(false);

  // Rejeição / comentário / cadastro fornecedor
  const [motivo, setMotivo] = useState('');
  const [rejeitando, setRejeitando] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [novoFornNome, setNovoFornNome] = useState('');
  const [novoFornDoc, setNovoFornDoc] = useState('');
  const [cadastrando, setCadastrando] = useState(false);

  const editavel = pedido && (podeAprovar || ['rascunho', 'aguardando_aprovacao'].includes(pedido.status));
  const aprovavel = pedido && ['aguardando_aprovacao', 'erro_ca', 'erro_inter'].includes(pedido.status);

  const carregar = useCallback(async () => {
    if (!pedidoId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/financeiro/pedidos-pagamento/${pedidoId}`);
      setPedido(res.pedido);
      setComentarios(res.comentarios || []);
      setAnexos(res.anexos || []);
      setHistorico(res.historico || []);
      setPodeAprovar(!!res.pode_aprovar);
      setPodeExcluir(!!res.pode_excluir);
      setEdit({});
      setAprov({
        categoria_id: res.pedido?.categoria_id || '',
        centro_custo_id: res.pedido?.centro_custo_id || '',
        contaazul_pessoa_id: res.pedido?.contaazul_pessoa_id || '',
        conta_financeira_id: res.pedido?.conta_financeira_id || '',
        inter_credencial_id: res.pedido?.inter_credencial_id ? String(res.pedido.inter_credencial_id) : '',
      });
      setNovoFornNome(res.pedido?.beneficiario_nome || '');
      setNovoFornDoc(res.pedido?.cpf_cnpj || '');
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar pedido', message: e?.message });
    } finally {
      setLoading(false);
    }
  }, [pedidoId, showToast]);

  useEffect(() => { if (pedidoId) carregar(); }, [pedidoId, carregar]);

  // Carrega opções do CA/Inter só quando o financeiro vai aprovar
  const carregarOpcoes = useCallback(async () => {
    if (!podeAprovar || !aprovavel) return;
    try {
      const [cat, cc, ct, fo, it] = await Promise.all([
        fetch(`/api/financeiro/contaazul/categorias?bar_id=${barId}`).then(r => r.json()),
        fetch(`/api/financeiro/contaazul/centros-custo?bar_id=${barId}`).then(r => r.json()),
        fetch(`/api/financeiro/contaazul/contas-financeiras?bar_id=${barId}`).then(r => r.json()),
        fetch(`/api/financeiro/contaazul/stakeholders?bar_id=${barId}&perfil=FORNECEDOR`).then(r => r.json()),
        fetch(`/api/financeiro/inter/credenciais?bar_id=${barId}`).then(r => r.json()),
      ]);
      setCategorias((cat.categorias || []).map((c: any) => ({ value: c.contaazul_id, label: c.categoria_nome })));
      setCentros(((cc.centros_custo || cc.centrosCusto) || []).map((c: any) => ({ value: c.contaazul_id, label: c.nome })));
      setContas((ct.contas_financeiras || [])
        .filter((c: any) => c.ativo !== false)
        .map((c: any) => ({ value: String(c.contaazul_id), label: c.banco ? `${c.nome} (${c.banco})` : c.nome })));
      setFornecedores((fo.pessoas || []).map((p: any) => ({
        value: p.contaazul_id, label: p.nome, searchHint: p.documento || '',
      })));
      setInterCreds((it.credenciais || []).map((c: any) => ({
        value: String(c.id), label: c.cnpj ? `${c.nome} (${c.cnpj})` : c.nome,
      })));
    } catch {
      showToast({ type: 'error', title: 'Erro ao carregar opções do Conta Azul/Inter' });
    }
  }, [podeAprovar, aprovavel, barId, showToast]);

  useEffect(() => { carregarOpcoes(); }, [carregarOpcoes]);

  const salvarEdicao = async () => {
    if (!pedido || Object.keys(edit).length === 0) return;
    setSalvandoEdit(true);
    try {
      const payload: any = { ...edit };
      if ('valor' in payload) payload.valor = Number(String(payload.valor).replace(',', '.'));
      await api.put(`/api/financeiro/pedidos-pagamento/${pedido.id}`, payload);
      showToast({ type: 'success', title: 'Alterações salvas' });
      await carregar();
      onChange();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message });
    } finally {
      setSalvandoEdit(false);
    }
  };

  const cadastrarFornecedor = async () => {
    if (!novoFornNome.trim()) return showToast({ type: 'error', title: 'Informe o nome do fornecedor' });
    setCadastrando(true);
    try {
      const res = await api.post('/api/financeiro/contaazul/pessoas/cadastrar', {
        bar_id: barId, nome: novoFornNome.trim(), documento: novoFornDoc.replace(/\D/g, '') || undefined,
      });
      const novo = { value: res.contaazul_id, label: res.nome };
      setFornecedores(prev => [novo, ...prev]);
      setAprov(a => ({ ...a, contaazul_pessoa_id: res.contaazul_id }));
      showToast({ type: 'success', title: 'Fornecedor cadastrado no Conta Azul' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao cadastrar fornecedor', message: e?.message });
    } finally {
      setCadastrando(false);
    }
  };

  const aprovar = async () => {
    if (!pedido) return;
    setAprovando(true);
    try {
      await api.post(`/api/financeiro/pedidos-pagamento/${pedido.id}/aprovar`, {
        categoria_id: aprov.categoria_id || undefined,
        categoria_nome: categorias.find(c => c.value === aprov.categoria_id)?.label,
        centro_custo_id: aprov.centro_custo_id || undefined,
        centro_custo_nome: centros.find(c => c.value === aprov.centro_custo_id)?.label,
        contaazul_pessoa_id: aprov.contaazul_pessoa_id || undefined,
        conta_financeira_id: aprov.conta_financeira_id || undefined,
        inter_credencial_id: aprov.inter_credencial_id ? Number(aprov.inter_credencial_id) : undefined,
      });
      showToast({ type: 'success', title: 'Aprovado!', message: 'Conta a pagar criada e PIX agendado no Inter.' });
      await carregar();
      onChange();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao aprovar', message: e?.message });
      await carregar();
    } finally {
      setAprovando(false);
    }
  };

  const rejeitar = async () => {
    if (!pedido) return;
    if (!motivo.trim()) return showToast({ type: 'error', title: 'Informe o motivo da rejeição' });
    setRejeitando(true);
    try {
      await api.post(`/api/financeiro/pedidos-pagamento/${pedido.id}/rejeitar`, { motivo: motivo.trim() });
      showToast({ type: 'success', title: 'Pedido rejeitado' });
      setMotivo('');
      await carregar();
      onChange();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao rejeitar', message: e?.message });
    } finally {
      setRejeitando(false);
    }
  };

  const excluir = async () => {
    if (!pedido) return;
    if (!window.confirm('Excluir este pedido definitivamente? Esta ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try {
      await api.delete(`/api/financeiro/pedidos-pagamento/${pedido.id}`);
      showToast({ type: 'success', title: 'Pedido excluído' });
      onChange();
      onClose();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message });
    } finally {
      setExcluindo(false);
    }
  };

  const enviarComentario = async () => {
    if (!pedido || !novoComentario.trim()) return;
    setEnviandoComentario(true);
    try {
      await api.post(`/api/financeiro/pedidos-pagamento/${pedido.id}/comentarios`, { mensagem: novoComentario.trim() });
      setNovoComentario('');
      const res = await api.get(`/api/financeiro/pedidos-pagamento/${pedido.id}`);
      setComentarios(res.comentarios || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao comentar', message: e?.message });
    } finally {
      setEnviandoComentario(false);
    }
  };

  const subirAnexo = async (file: File) => {
    if (!pedido) return;
    const fd = new FormData();
    fd.append('file', file);
    const selectedBarId = localStorage.getItem('sgb_selected_bar_id');
    try {
      const r = await fetch(`/api/financeiro/pedidos-pagamento/${pedido.id}/anexos`, {
        method: 'POST',
        headers: selectedBarId ? { 'x-selected-bar-id': selectedBarId } : {},
        body: fd,
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d?.error || 'Falha no upload');
      setAnexos(prev => [...prev, d.anexo]);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro no anexo', message: e?.message });
    }
  };

  const fld = (k: keyof Pedido) => (edit[k] ?? pedido?.[k] ?? '') as string | number;
  const setFld = (k: keyof Pedido, v: any) => setEdit(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={!!pedidoId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            {pedido ? (
              <>
                <span>{TIPO_LABEL[pedido.tipo]}</span>
                <Badge className={STATUS_COLOR[pedido.status]}>{STATUS_LABEL[pedido.status]}</Badge>
                <span className="ml-auto text-base font-bold">{formatBRL(pedido.valor)}</span>
              </>
            ) : 'Carregando...'}
          </DialogTitle>
        </DialogHeader>

        {loading || !pedido ? (
          <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="px-6 pb-6 overflow-y-auto space-y-5 text-sm">
            {/* Solicitante */}
            <p className="text-xs text-muted-foreground">
              Solicitado por <strong>{pedido.solicitante_nome || '—'}</strong> em {new Date(pedido.created_at).toLocaleString('pt-BR')}
            </p>

            {pedido.status === 'rejeitado' && pedido.motivo_rejeicao && (
              <div className="rounded-md bg-red-500/10 text-red-600 p-3">
                <strong>Rejeitado{pedido.rejeitado_por_nome ? ` por ${pedido.rejeitado_por_nome}` : ''}:</strong> {pedido.motivo_rejeicao}
              </div>
            )}
            {pedido.erro_mensagem && (pedido.status === 'erro_ca' || pedido.status === 'erro_inter') && (
              <div className="rounded-md bg-red-500/10 text-red-600 p-3"><strong>Erro:</strong> {pedido.erro_mensagem}</div>
            )}
            {pedido.status === 'agendado' && (
              <div className="rounded-md bg-indigo-500/10 text-indigo-600 p-3 text-xs">
                Conta criada no Conta Azul e PIX agendado no Inter. Falta o OK final do sócio no app do Inter.
              </div>
            )}

            {/* Campos do pedido (editáveis) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="mb-1 block text-xs">Descrição</Label>
                <Input value={fld('descricao')} disabled={!editavel} onChange={(e) => setFld('descricao', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Valor (R$)</Label>
                <Input value={String(fld('valor'))} disabled={!editavel} onChange={(e) => setFld('valor', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Vencimento</Label>
                <Input type="date" value={fld('data_vencimento')} disabled={!editavel} onChange={(e) => setFld('data_vencimento', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Competência</Label>
                <Input type="date" value={fld('data_competencia')} disabled={!editavel} onChange={(e) => setFld('data_competencia', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Chave PIX</Label>
                <Input value={fld('chave_pix')} disabled={!editavel} onChange={(e) => setFld('chave_pix', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Beneficiário</Label>
                <Input value={fld('beneficiario_nome')} disabled={!editavel} onChange={(e) => setFld('beneficiario_nome', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">CPF/CNPJ</Label>
                <Input value={fld('cpf_cnpj')} disabled={!editavel} onChange={(e) => setFld('cpf_cnpj', e.target.value)} />
              </div>
            </div>
            {editavel && Object.keys(edit).length > 0 && (
              <Button size="sm" variant="outline" onClick={salvarEdicao} disabled={salvandoEdit}>
                {salvandoEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar alterações
              </Button>
            )}

            {/* Anexos */}
            <div>
              <Label className="mb-1.5 block text-xs">Anexos ({anexos.length})</Label>
              <div className="space-y-1.5">
                {anexos.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <a href={a.url_publica || '#'} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate flex-1">
                      {a.nome_original || 'arquivo'}
                    </a>
                  </div>
                ))}
                {anexos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo.</p>}
              </div>
              <label className="mt-2 inline-flex items-center gap-1.5 cursor-pointer text-xs text-blue-600 hover:underline">
                <Paperclip className="w-3.5 h-3.5" /> Anexar arquivo
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirAnexo(f); }} />
              </label>
            </div>

            {/* Painel de aprovação (financeiro) */}
            {podeAprovar && aprovavel && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
                <p className="font-medium text-sm">Aprovar — completar dados do Conta Azul / Inter</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1 block text-xs">Categoria *</Label>
                    <SearchableSelect value={aprov.categoria_id} onValueChange={(v) => setAprov(a => ({ ...a, categoria_id: v || '' }))}
                      placeholder="Categoria" searchPlaceholder="Filtrar..." emptyMessage="Nenhuma" options={categorias} />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Centro de custo</Label>
                    <SearchableSelect value={aprov.centro_custo_id} onValueChange={(v) => setAprov(a => ({ ...a, centro_custo_id: v || '' }))}
                      placeholder="Opcional" searchPlaceholder="Filtrar..." emptyMessage="Nenhum" options={centros} />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Conta pagadora *</Label>
                    <SearchableSelect value={aprov.conta_financeira_id} onValueChange={(v) => setAprov(a => ({ ...a, conta_financeira_id: v || '' }))}
                      placeholder="Conta no CA" searchPlaceholder="Filtrar..." emptyMessage="Nenhuma" options={contas} />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Credencial Inter *</Label>
                    <SearchableSelect value={aprov.inter_credencial_id} onValueChange={(v) => setAprov(a => ({ ...a, inter_credencial_id: v || '' }))}
                      placeholder="De onde sai o PIX" searchPlaceholder="Filtrar..." emptyMessage="Nenhuma" options={interCreds} />
                  </div>
                  <div className="col-span-2">
                    <Label className="mb-1 block text-xs">Contato / Fornecedor no CA *</Label>
                    <SearchableSelect value={aprov.contaazul_pessoa_id} onValueChange={(v) => setAprov(a => ({ ...a, contaazul_pessoa_id: v || '' }))}
                      placeholder="Selecione o contato" searchPlaceholder="Buscar fornecedor..." emptyMessage="Não encontrado — cadastre abaixo" options={fornecedores} />
                  </div>
                </div>

                {/* Cadastro rápido de fornecedor/contato */}
                {!aprov.contaazul_pessoa_id && (
                  <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-2.5 space-y-2">
                    <p className="text-xs text-muted-foreground">Não achou o contato? Cadastre no Conta Azul:</p>
                    <div className="flex gap-2">
                      <Input className="h-8 text-xs" placeholder="Nome" value={novoFornNome} onChange={(e) => setNovoFornNome(e.target.value)} />
                      <Input className="h-8 text-xs" placeholder="CPF/CNPJ (opcional)" value={novoFornDoc} onChange={(e) => setNovoFornDoc(e.target.value)} />
                      <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={cadastrarFornecedor} disabled={cadastrando}>
                        {cadastrando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cadastrar'}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button onClick={aprovar} disabled={aprovando} className="flex-1">
                    {aprovando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</> : <><Check className="w-4 h-4 mr-2" />Aprovar e pagar</>}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Cria a conta a pagar no Conta Azul e agenda o PIX no Inter. O sócio dá o OK final no app do Inter.</p>

                {/* Rejeição */}
                <div className="pt-2 border-t border-[hsl(var(--border))]">
                  <Label className="mb-1 block text-xs">Rejeitar (motivo)</Label>
                  <div className="flex gap-2">
                    <Input className="h-8 text-xs" placeholder="Motivo da rejeição" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    <Button size="sm" variant="destructive" className="h-8 shrink-0" onClick={rejeitar} disabled={rejeitando}>
                      {rejeitando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><X className="w-3.5 h-3.5 mr-1" />Rejeitar</>}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Comentários */}
            <div>
              <Label className="mb-1.5 block text-xs">Comentários</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {comentarios.map((c) => (
                  <div key={c.id} className={`rounded-md p-2 text-xs ${c.tipo === 'sistema' ? 'bg-muted/40 text-muted-foreground italic' : 'bg-muted/60'}`}>
                    <div className="flex justify-between gap-2">
                      <strong>{c.autor_nome || 'Sistema'}</strong>
                      <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap">{c.mensagem}</p>
                  </div>
                ))}
                {comentarios.length === 0 && <p className="text-xs text-muted-foreground">Sem comentários.</p>}
              </div>
              <div className="flex gap-2 mt-2">
                <Input className="h-9 text-sm" placeholder="Escrever comentário..." value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') enviarComentario(); }} />
                <Button size="sm" className="h-9 shrink-0" onClick={enviarComentario} disabled={enviandoComentario || !novoComentario.trim()}>
                  {enviandoComentario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Histórico */}
            <div>
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowHist(s => !s)}>
                <History className="w-3.5 h-3.5" /> Histórico de alterações ({historico.length})
              </button>
              {showHist && (
                <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {historico.map((h) => (
                    <div key={h.id}>
                      <span className="text-foreground">{h.autor_nome || 'Sistema'}</span> alterou <strong>{h.campo}</strong>
                      {h.valor_anterior != null && <> de “{h.valor_anterior}”</>} para “{h.valor_novo}”
                      <span className="ml-1">· {new Date(h.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                  {historico.length === 0 && <p>Sem alterações registradas.</p>}
                </div>
              )}
            </div>

            {/* Exclusão definitiva — só admin (ex.: pedido de teste/duplicado) */}
            {podeExcluir && (
              <div className="pt-3 border-t border-[hsl(var(--border))]">
                <Button
                  variant="ghost" size="sm" onClick={excluir} disabled={excluindo}
                  className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                >
                  {excluindo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Excluir pedido
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Remove o pedido e seus anexos definitivamente. Para pedidos de teste ou duplicados —
                  pedidos que já geraram conta no Conta Azul / PIX no Inter não podem ser excluídos (cancele).
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
