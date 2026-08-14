'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { getSelectedBarId } from '@/lib/selected-bar';
import { Loader2, UserMinus } from 'lucide-react';
import {
  fimDoAviso, validaDesligamento, resumoDesligamento,
  type Iniciativa, type AvisoPrevio, type Modalidade, type FormDesligamento,
} from '@/lib/rh/desligamento';

/**
 * Registro do desligamento, com a cascata que a ata de 13/08/2026 descreve.
 *
 * Não é só preencher a data de demissão: sem saber de quem partiu e que tipo de aviso prévio houve,
 * não dá para montar o bloco "Avisos Prévio Trabalhado" da mensagem de segunda — que é o motivo de
 * a ata pedir isso.
 */

type Doc = { id: string; tipo: string; nome_arquivo: string | null };

const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtBR = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—');

export function DemissaoDialog({ funcionarioId, nome, docs, aberto, onFechar, onPronto }: {
  funcionarioId: number;
  nome: string;
  docs: Doc[];
  aberto: boolean;
  onFechar: () => void;
  onPronto: () => void;
}) {
  const { showToast } = useToast();
  const [iniciativa, setIniciativa] = useState<Iniciativa>('funcionario');
  const [justaCausa, setJustaCausa] = useState(false);
  const [aviso, setAviso] = useState<AvisoPrevio>('sem');
  const [modalidade, setModalidade] = useState<Modalidade | null>(null);
  const [dataComunicacao, setDataComunicacao] = useState(hojeISO());
  const [dataDesligamento, setDataDesligamento] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cartaId, setCartaId] = useState('');
  const [salvando, setSalvando] = useState(false);

  // reabre sempre limpo — herdar a escolha da pessoa anterior seria um jeito fácil de errar
  useEffect(() => {
    if (!aberto) return;
    setIniciativa('funcionario'); setJustaCausa(false); setAviso('sem'); setModalidade(null);
    setDataComunicacao(hojeISO()); setDataDesligamento(''); setMotivo(''); setCartaId('');
  }, [aberto]);

  // justa causa não convive com aviso prévio; e não existe quando o pedido é do funcionário
  useEffect(() => {
    if (iniciativa === 'funcionario' && justaCausa) setJustaCausa(false);
  }, [iniciativa, justaCausa]);
  useEffect(() => {
    if (justaCausa) { setAviso('sem'); setModalidade(null); }
  }, [justaCausa]);
  useEffect(() => {
    if (aviso === 'sem') setModalidade(null);
    else if (!modalidade) setModalidade('2h_dia');
  }, [aviso, modalidade]);

  const form: FormDesligamento = {
    iniciativa, justa_causa: justaCausa, aviso_previo: aviso, modalidade,
    data_comunicacao: dataComunicacao,
    data_desligamento: dataDesligamento || null,
  };
  const sugerido = useMemo(
    () => (dataComunicacao ? fimDoAviso(dataComunicacao, aviso, modalidade) : ''),
    [dataComunicacao, aviso, modalidade],
  );
  const ultimoDia = dataDesligamento || sugerido;
  const erro = validaDesligamento(form);

  const cartas = docs.filter((d) => d.tipo === 'carta_demissao' || d.tipo === 'outro');

  const salvar = async () => {
    if (erro) return showToast({ type: 'error', title: 'Confira o preenchimento', message: erro });
    if (!window.confirm(
      `Registrar o desligamento de ${nome}?\n\n${resumoDesligamento(form)}\n` +
      `Último dia: ${fmtBR(ultimoDia)}.\n\n` +
      (ultimoDia > hojeISO()
        ? 'A pessoa continua ativa até essa data (aviso prévio em curso).'
        : 'O cadastro será desativado e a cadeira ficará vaga.'),
    )) return;

    setSalvando(true);
    try {
      const barId = getSelectedBarId();
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/desligamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(barId ? { 'x-selected-bar-id': barId } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          data_desligamento: ultimoDia,
          motivo: motivo || null,
          documento_id: iniciativa === 'funcionario' && cartaId ? cartaId : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Não foi possível registrar o desligamento');
      showToast({ type: 'success', title: 'Desligamento registrado', message: j.mensagem });
      onPronto();
      onFechar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao registrar', message: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserMinus className="w-4 h-4" />Registrar desligamento</DialogTitle>
          <DialogDescription>{nome}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Como é a demissão</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={iniciativa === 'funcionario'} onChange={() => setIniciativa('funcionario')} />
              Pelo funcionário
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={iniciativa === 'empresa'} onChange={() => setIniciativa('empresa')} />
              Pela empresa
            </label>
          </div>

          {iniciativa === 'empresa' && (
            <div className="ml-5 space-y-1.5 border-l pl-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={justaCausa} onChange={() => setJustaCausa(true)} />
                Com justa causa <span className="text-xs text-muted-foreground">(não tem aviso prévio)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!justaCausa} onChange={() => setJustaCausa(false)} />
                Sem justa causa
              </label>
            </div>
          )}

          {!justaCausa && (
            <div className="ml-5 space-y-1.5 border-l pl-3">
              <Label className="text-xs text-muted-foreground">Aviso prévio</Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={aviso === 'sem'} onChange={() => setAviso('sem')} />
                Sem aviso prévio
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={aviso === 'trabalhado'} onChange={() => setAviso('trabalhado')} />
                Com aviso prévio (trabalhado)
              </label>
              {aviso === 'trabalhado' && (
                <div className="ml-5 space-y-1.5 border-l pl-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={modalidade === '2h_dia'} onChange={() => setModalidade('2h_dia')} />
                    2h a menos por dia
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={modalidade === '7_dias'} onChange={() => setModalidade('7_dias')} />
                    7 dias a menos
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <div>
              <Label className="text-xs text-muted-foreground block">Comunicação</Label>
              <Input type="date" value={dataComunicacao} onChange={(e) => setDataComunicacao(e.target.value)} className="h-9 w-[150px]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground block">Último dia</Label>
              <Input type="date" value={ultimoDia} onChange={(e) => setDataDesligamento(e.target.value)} className="h-9 w-[150px]" />
              <span className="text-[10px] text-muted-foreground">sugerido: {fmtBR(sugerido)}</span>
            </div>
          </div>

          {iniciativa === 'funcionario' && (
            <div>
              <Label className="text-xs text-muted-foreground block">Carta de demissão</Label>
              <select value={cartaId} onChange={(e) => setCartaId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— sem carta anexada —</option>
                {cartas.map((d) => <option key={d.id} value={d.id}>{d.nome_arquivo || d.tipo}</option>)}
              </select>
              <span className="text-[10px] text-muted-foreground">
                Anexe na aba Documentos (tipo &ldquo;Carta de Demissão&rdquo;) e selecione aqui.
              </span>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground block">Motivo (opcional)</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: proposta em outra empresa" className="h-9" />
          </div>

          <div className="rounded-md bg-muted/50 p-2 text-xs">
            <div>{resumoDesligamento(form)}</div>
            <div className="text-muted-foreground">
              Último dia <strong>{fmtBR(ultimoDia)}</strong>
              {ultimoDia > hojeISO()
                ? ' — continua ativo até lá, aparecendo em "Avisos Prévio Trabalhado".'
                : ' — o cadastro é desativado e a cadeira fica vaga.'}
            </div>
            {erro && <div className="text-red-500 mt-1">{erro}</div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !!erro}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
