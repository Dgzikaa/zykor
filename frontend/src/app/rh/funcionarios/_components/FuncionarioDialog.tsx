'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, User, Briefcase, Wallet, FileText } from 'lucide-react';
import type { Funcionario, Opcao } from '../page';

const VAZIO: Record<string, any> = {
  nome: '', cpf: '', telefone: '', email: '', tipo_contratacao: 'CLT', genero: '',
  cargo_id: '', area_id: '', data_admissao: '', data_nascimento: '', data_demissao: '',
  salario_base: '', valor_diaria: '', vale_transporte_diaria: '', dias_trabalho_semana: '',
  chave_pix: '', tipo_chave_pix: '', observacoes: '', ativo: true,
};

const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

const moeda = (v: number | null | undefined) =>
  v == null ? null : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * A cadeira que está sendo preenchida. Quando vem, o formulário deixa de ser "novo funcionário
 * solto" e vira CONTRATAÇÃO: função, área e chefe já estão decididos pela cadeira, então esses
 * campos saem do formulário (mostrar select editável convidaria a divergir do organograma) e o
 * salário chega sugerido.
 */
export type CadeiraAlvo = {
  id: string; codigo: string;
  cargo_nome: string | null; area_nome: string | null;
  /** cadeira.salario_referencia ?? cargo.salario_min — nulo quando ninguém cadastrou nenhum dos dois */
  salario_sugerido: number | null;
  faixa_min: number | null; faixa_max: number | null;
  /** de onde veio a sugestão, para a tela não fingir precisão que não tem */
  origem_salario: 'cadeira' | 'cargo' | null;
};

export function FuncionarioDialog({ open, onClose, onSalvo, cargos, areas, funcionario, cadeira }: {
  open: boolean; onClose: () => void; onSalvo: () => void;
  /** cargo carrega `area_id` para o formulário poder filtrar pela área escolhida */
  cargos: (Opcao & { area_id?: number | null })[]; areas: Opcao[]; funcionario: Funcionario | null;
  /** contratação por cadeira; ausente = edição de quem já existe */
  cadeira?: CadeiraAlvo | null;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState<Record<string, any>>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const editando = !!funcionario;
  const contratando = !editando && !!cadeira;

  useEffect(() => {
    if (!open) return;
    if (funcionario) {
      const f: Record<string, any> = { ...VAZIO };
      for (const k of Object.keys(VAZIO)) f[k] = (funcionario as any)[k] ?? (k === 'ativo' ? true : '');
      setForm(f);
    } else if (cadeira) {
      setForm({
        ...VAZIO,
        // admissão de hoje é o caso comum e o que o cálculo da experiência precisa; dá pra mudar
        data_admissao: new Date().toISOString().slice(0, 10),
        salario_base: cadeira.salario_sugerido != null ? String(cadeira.salario_sugerido) : '',
      });
    } else setForm(VAZIO);
  }, [open, funcionario, cadeira]);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const freela = form.tipo_contratacao === 'Freela';

  const salvar = async () => {
    if (!String(form.nome).trim()) { showToast({ type: 'error', title: 'Nome é obrigatório' }); return; }
    setSalvando(true);
    try {
      const payload = { ...form };
      ['cargo_id', 'area_id'].forEach((k) => { payload[k] = payload[k] ? Number(payload[k]) : null; });
      ['salario_base', 'valor_diaria', 'vale_transporte_diaria', 'dias_trabalho_semana'].forEach((k) => {
        payload[k] = payload[k] === '' || payload[k] == null ? null : Number(payload[k]);
      });
      if (editando) await api.put(`/api/rh/funcionarios/${funcionario!.id}`, payload);
      else if (cadeira) {
        // Cria e senta na cadeira numa chamada só — cadastrar aqui e alocar depois é justamente o
        // caminho que deixava gente fora do quadro.
        await api.post('/api/rh/organograma', { ...payload, acao: 'contratar', cadeira_id: cadeira.id });
      } else await api.post('/api/rh/funcionarios', payload);
      showToast({
        type: 'success',
        title: editando ? 'Funcionário atualizado'
          : cadeira ? `Contratado na cadeira ${cadeira.codigo}` : 'Funcionário cadastrado',
      });
      onSalvo();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); }
    finally { setSalvando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            {editando ? 'Editar funcionário' : contratando ? `Contratar em ${cadeira!.codigo}` : 'Novo funcionário'}
          </DialogTitle>
          <DialogDescription>
            {editando ? 'Atualize os dados do colaborador.'
              : contratando
                ? <>Função, área e chefe já vêm da cadeira <strong>{cadeira!.codigo}</strong>. Ao salvar, a pessoa é cadastrada e já senta nela.</>
                : 'Preencha os dados para cadastrar um novo colaborador.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Dados pessoais */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <User className="w-3.5 h-3.5" /> Dados pessoais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Nome <span className="text-red-500">*</span></Label>
                <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  CPF{contratando && <span className="text-amber-600 dark:text-amber-400"> — importante</span>}
                </Label>
                <Input value={form.cpf} onChange={(e) => set('cpf', e.target.value)} placeholder="000.000.000-00" />
                {/* O CPF é a chave que faz o Tangerino ADOTAR este cadastro em vez de criar outro.
                    Sem ele, quando o DP registrar a mesma pessoa lá, a sync não reconhece ninguém e
                    nasce a duplicata — foi assim que apareceram ~40 na primeira importação.
                    Avisa, mas não trava: nem sempre o CPF está à mão na hora de contratar. */}
                {contratando && !String(form.cpf).trim() && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Sem CPF, quando esta pessoa for cadastrada no Tangerino a sync vai criar um
                    <strong> cadastro duplicado</strong> em vez de atualizar este.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data de nascimento</Label>
                <Input type="date" value={form.data_nascimento || ''} onChange={(e) => set('data_nascimento', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                {/* Só a sync do Tangerino preenchia este campo (payload.gender), então quem é PJ
                    — que não vem do Tangerino — nascia sem gênero e não tinha onde digitar.
                    F/M é a convenção que a própria sync grava; manter igual evita dois padrões. */}
                <Label className="text-xs">Gênero</Label>
                <select className={sel} value={form.genero || ''} onChange={(e) => set('genero', e.target.value)}>
                  <option value="">—</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Contrato */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Briefcase className="w-3.5 h-3.5" /> Contrato
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de contratação</Label>
                <select className={sel} value={form.tipo_contratacao} onChange={(e) => set('tipo_contratacao', e.target.value)}>
                  <option value="CLT">CLT</option><option value="PJ">PJ</option><option value="Freela">Freela</option>
                </select>
              </div>
              {/* Contratando: cargo e área são da CADEIRA e não se escolhem aqui — o servidor grava
                  os da cadeira de qualquer jeito, então um select editável só mentiria. */}
              {contratando ? (
                <div className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-md border bg-muted/40 px-3 py-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Área (da cadeira)</div>
                    <div className="text-sm font-medium">{cadeira!.area_nome || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cargo (da cadeira)</div>
                    <div className="text-sm font-medium">{cadeira!.cargo_nome || '—'}</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Área ANTES do cargo: é ela que filtra a lista. Trocar de área limpa o cargo, senão
                      sobraria um cargo de outra área escolhido antes (marcar Marketing e ficar com Cumin). */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Área</Label>
                    <select className={sel} value={form.area_id} onChange={(e) => { set('area_id', e.target.value); set('cargo_id', ''); }}>
                      <option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cargo</Label>
                    <select className={sel} value={form.cargo_id} onChange={(e) => set('cargo_id', e.target.value)}>
                      <option value="">—</option>
                      {cargos
                        // cargo sem área (sócio, freela, gerência) aparece em qualquer uma
                        .filter((c) => !form.area_id || c.area_id == null || String(c.area_id) === String(form.area_id))
                        .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Data de admissão</Label>
                <Input type="date" value={form.data_admissao || ''} onChange={(e) => set('data_admissao', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{freela ? 'Valor da diária (R$)' : 'Salário base (R$)'}</Label>
                <Input type="number" step="0.01" value={freela ? form.valor_diaria : form.salario_base}
                  onChange={(e) => set(freela ? 'valor_diaria' : 'salario_base', e.target.value)} placeholder="0,00" />
                {/* De onde veio o número sugerido, e o aviso de quem sai da faixa — a faixa orienta,
                    não trava: pagar fora dela é decisão do RH, só não pode ser sem perceber. */}
                {contratando && !freela && (
                  cadeira!.salario_sugerido != null ? (
                    <p className="text-[11px] text-muted-foreground">
                      Sugerido: <strong>{moeda(cadeira!.salario_sugerido)}</strong>
                      {cadeira!.origem_salario === 'cadeira' ? ' (salário desta cadeira)' : ' (piso do cargo)'}
                      {cadeira!.faixa_min != null && cadeira!.faixa_max != null &&
                        ` · faixa ${moeda(cadeira!.faixa_min)}–${moeda(cadeira!.faixa_max)}`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Sem referência: nem a cadeira nem o cargo têm salário cadastrado. Dá para definir
                      no ✎ da cadeira, no organograma.
                    </p>
                  )
                )}
                {contratando && !freela && cadeira!.faixa_max != null && Number(form.salario_base) > cadeira!.faixa_max && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Acima do teto da faixa ({moeda(cadeira!.faixa_max)}).
                  </p>
                )}
                {contratando && !freela && cadeira!.faixa_min != null && Number(form.salario_base) > 0
                  && Number(form.salario_base) < cadeira!.faixa_min && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Abaixo do piso da faixa ({moeda(cadeira!.faixa_min)}).
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dias de trabalho/semana</Label>
                <Input type="number" value={form.dias_trabalho_semana} onChange={(e) => set('dias_trabalho_semana', e.target.value)} placeholder="Ex: 5" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Pagamento */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Wallet className="w-3.5 h-3.5" /> Pagamento (PIX){freela && <span className="normal-case font-normal text-amber-600">· usado p/ pagar o freela</span>}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Chave PIX</Label>
                <Input value={form.chave_pix} onChange={(e) => set('chave_pix', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo da chave</Label>
                <select className={sel} value={form.tipo_chave_pix} onChange={(e) => set('tipo_chave_pix', e.target.value)}>
                  <option value="">—</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option>
                  <option value="email">Email</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option>
                </select>
              </div>
            </div>
          </section>

          <Separator />

          {/* Observações + Status */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="w-3.5 h-3.5" /> Observações
            </h3>
            <Textarea rows={3} value={form.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)} placeholder="Anotações internas (opcional)" />
            {editando && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de demissão</Label>
                  <Input type="date" value={form.data_demissao || ''} onChange={(e) => set('data_demissao', e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch checked={!!form.ativo} onCheckedChange={(v) => set('ativo', v)} />
                  <Label className="text-sm cursor-pointer">Funcionário ativo</Label>
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            {editando ? 'Salvar alterações' : contratando ? 'Contratar e sentar na cadeira' : 'Cadastrar funcionário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
