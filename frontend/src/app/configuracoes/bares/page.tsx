'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/lib/api-client';
import { Store, Plus, Loader2, Save, Trash2, Target, ExternalLink, CheckCircle2, Clock, Instagram, Plug, Upload } from 'lucide-react';

interface Operacao {
  opera_segunda: boolean; opera_terca: boolean; opera_quarta: boolean;
  opera_quinta: boolean; opera_sexta: boolean; opera_sabado: boolean; opera_domingo: boolean;
  horario_abertura?: string; horario_fechamento?: string;
  tem_api_contahub?: boolean; tem_api_yuzer?: boolean; tem_api_sympla?: boolean;
}
interface Bar {
  id: number; nome: string; cnpj: string; endereco: string; ativo: boolean;
  config: Record<string, any>; operacao: Operacao | null;
}
interface UsuarioAcesso { auth_id: string; nome: string; email: string; role: string }

const DIAS: { key: keyof Operacao; label: string }[] = [
  { key: 'opera_segunda', label: 'Seg' }, { key: 'opera_terca', label: 'Ter' },
  { key: 'opera_quarta', label: 'Qua' }, { key: 'opera_quinta', label: 'Qui' },
  { key: 'opera_sexta', label: 'Sex' }, { key: 'opera_sabado', label: 'Sáb' },
  { key: 'opera_domingo', label: 'Dom' },
];

const operacaoVazia = (): Operacao => ({
  opera_segunda: true, opera_terca: true, opera_quarta: true, opera_quinta: true,
  opera_sexta: true, opera_sabado: true, opera_domingo: true,
  horario_abertura: '18:00', horario_fechamento: '02:00',
  tem_api_contahub: false, tem_api_yuzer: false, tem_api_sympla: false,
});

export default function BaresConfigPage() {
  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Bar | null>(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    setPageTitle('🏪 Bares');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/configuracoes/bars');
      setBars(res.bars || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar bares', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const novoBar = (): Bar => ({
    id: 0, nome: '', cnpj: '', endereco: '', ativo: true, config: {}, operacao: operacaoVazia(),
  });

  return (
    <div className="container mx-auto px-3 py-5 max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Store className="w-5 h-5" /></h1>
          <p className="text-sm text-muted-foreground">Cadastre e configure os bares: perfil, dias de operação, metas e acesso.</p>
        </div>
        <Button onClick={() => { setEditando(novoBar()); setCriando(true); }}>
          <Plus className="w-4 h-4 mr-2" />Novo bar
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {bars.map((b) => (
            <button key={b.id} onClick={() => { setEditando(b); setCriando(false); }}
              className="text-left rounded-lg border border-[hsl(var(--border))] bg-card hover:bg-muted/40 transition p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold flex items-center gap-1.5">
                  {b.nome}
                  {b.config?.modo_manual && <Badge variant="outline" className="text-[10px]">Manual</Badge>}
                </span>
                <Badge variant={b.ativo ? 'default' : 'secondary'}>{b.ativo ? 'Ativo' : 'Inativo'}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                #{b.id}{b.cnpj ? ` · ${b.cnpj}` : ''}
                {b.operacao && !b.operacao.tem_api_contahub ? ' · sem ContaHub' : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {editando && (
        <BarEditor
          bar={editando}
          criando={criando}
          bars={bars}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}

function BarEditor({ bar, criando, bars, onClose, onSaved }: {
  bar: Bar; criando: boolean; bars: Bar[]; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<Bar>(() => ({
    ...bar, config: { ...(bar.config || {}) }, operacao: bar.operacao || operacaoVazia(),
  }));
  const [salvando, setSalvando] = useState(false);
  const [copiarDe, setCopiarDe] = useState('');

  const setCfg = (k: string, v: any) => setForm(f => ({ ...f, config: { ...f.config, [k]: v } }));
  const setOp = (k: keyof Operacao, v: any) => setForm(f => ({ ...f, operacao: { ...(f.operacao as Operacao), [k]: v } }));

  const salvar = async () => {
    if (!form.nome.trim()) {
      toast({ title: 'Informe o nome do bar', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        id: criando ? undefined : form.id,
        nome: form.nome.trim(), cnpj: form.cnpj || null, endereco: form.endereco || null,
        ativo: form.ativo, config: form.config, operacao: form.operacao,
        ...(criando && copiarDe ? { copiar_de: Number(copiarDe) } : {}),
      };
      if (criando) await api.post('/api/configuracoes/bars', payload);
      else await api.put('/api/configuracoes/bars', payload);
      toast({ title: criando ? 'Bar criado' : 'Bar atualizado' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" /> {criando ? 'Novo bar' : form.nome}
            {!criando && form.config.modo_manual && <Badge variant="outline" className="text-[10px]">Manual</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="perfil" className="px-6 pb-6">
          <TabsList>
            <TabsTrigger value="prontidao" disabled={criando}>Prontidão</TabsTrigger>
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="operacao">Operação</TabsTrigger>
            <TabsTrigger value="metas">Metas</TabsTrigger>
            <TabsTrigger value="integracoes" disabled={criando}>Integrações</TabsTrigger>
            <TabsTrigger value="acesso" disabled={criando}>Acesso</TabsTrigger>
          </TabsList>

          {/* PRONTIDÃO */}
          <TabsContent value="prontidao" className="pt-3">
            {!criando && <ProntidaoBar barId={form.id} />}
          </TabsContent>

          {/* PERFIL */}
          <TabsContent value="perfil" className="space-y-3 pt-3">
            {criando && (
              <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-2.5">
                <Label className="text-xs">Copiar configuração de (opcional)</Label>
                <select
                  className="mt-1 w-full h-9 rounded-md border border-[hsl(var(--border))] bg-background px-2 text-sm"
                  value={copiarDe}
                  onChange={(e) => setCopiarDe(e.target.value)}
                >
                  <option value="">Começar do zero</option>
                  {bars.filter(b => b.id !== form.id).map(b => (
                    <option key={b.id} value={b.id}>{b.nome}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Clona dias de operação, padrão de metas, acessos e categorias de custo. As integrações começam desligadas (bar manual).
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div><Label className="text-xs">CNPJ</Label>
                <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
              <div><Label className="text-xs">Telefone</Label>
                <Input value={form.config.telefone || ''} onChange={e => setCfg('telefone', e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">Endereço</Label>
                <Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} /></div>
              <div><Label className="text-xs">Email</Label>
                <Input value={form.config.email || ''} onChange={e => setCfg('email', e.target.value)} /></div>
              <div><Label className="text-xs">Instagram</Label>
                <Input placeholder="@bar" value={form.config.instagram || ''} onChange={e => setCfg('instagram', e.target.value)} /></div>
              <div><Label className="text-xs">Site</Label>
                <Input value={form.config.site || ''} onChange={e => setCfg('site', e.target.value)} /></div>
              <div className="col-span-2">
                <LogoUploader value={form.config.logo_url || ''} onChange={(url) => setCfg('logo_url', url)} />
              </div>
              <div className="col-span-2 flex items-center gap-2 pt-1">
                <input id="ativo" type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                <Label htmlFor="ativo" className="text-sm">Bar ativo (aparece no seletor)</Label>
              </div>
            </div>
          </TabsContent>

          {/* OPERAÇÃO */}
          <TabsContent value="operacao" className="space-y-4 pt-3">
            <label className="flex items-start gap-2 rounded-md border border-[hsl(var(--border))] p-2.5 cursor-pointer">
              <input type="checkbox" className="mt-0.5"
                checked={form.config.modo_manual !== false}
                onChange={(e) => setCfg('modo_manual', e.target.checked)} />
              <span>
                <span className="text-sm font-medium">Modo manual (sem ContaHub)</span>
                <span className="block text-[11px] text-muted-foreground">
                  Dados preenchidos à mão. As telas e alertas não cobram integrações ausentes. Desligue quando o bar passar a sincronizar automaticamente.
                </span>
              </span>
            </label>
            <div>
              <Label className="text-xs mb-1.5 block">Dias que o bar abre</Label>
              <div className="flex flex-wrap gap-2">
                {DIAS.map(d => {
                  const on = !!form.operacao?.[d.key];
                  return (
                    <button key={d.key} type="button" onClick={() => setOp(d.key, !on)}
                      className={`px-3 py-1.5 rounded-md text-sm border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-[hsl(var(--border))]'}`}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Dia fechado não conta como falha de pipeline.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Abertura</Label>
                <Input type="time" value={(form.operacao?.horario_abertura || '').slice(0,5)} onChange={e => setOp('horario_abertura', e.target.value)} /></div>
              <div><Label className="text-xs">Fechamento</Label>
                <Input type="time" value={(form.operacao?.horario_fechamento || '').slice(0,5)} onChange={e => setOp('horario_fechamento', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs block">Integrações ativas</Label>
              {([['tem_api_contahub','ContaHub'],['tem_api_yuzer','Yuzer'],['tem_api_sympla','Sympla']] as const).map(([k,lbl]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!form.operacao?.[k]} onChange={e => setOp(k, e.target.checked)} /> {lbl}
                </label>
              ))}
              <p className="text-[11px] text-muted-foreground">Bar novo geralmente começa sem ContaHub — os dados vão sendo preenchidos manualmente.</p>
            </div>
          </TabsContent>

          {/* METAS */}
          <TabsContent value="metas" className="pt-3">
            <div className="rounded-md border border-[hsl(var(--border))] p-4 text-sm space-y-2">
              <p className="flex items-center gap-2 font-medium"><Target className="w-4 h-4" /> Metas do bar</p>
              <p className="text-muted-foreground">
                As metas (cockpits de vendas, marketing, financeiro e indicadores) são editadas na tela dedicada de Metas,
                que opera sobre o bar selecionado no topo. Selecione <strong>{form.nome || 'este bar'}</strong> no seletor e abra:
              </p>
              <Link href="/configuracoes/metas" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                Abrir Metas <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              {criando && <p className="text-[11px] text-muted-foreground">Salve o bar primeiro; a estrutura de metas é criada automaticamente.</p>}
            </div>
          </TabsContent>

          {/* INTEGRAÇÕES */}
          <TabsContent value="integracoes" className="pt-3">
            {!criando && <IntegracoesBar barId={form.id} />}
          </TabsContent>

          {/* ACESSO */}
          <TabsContent value="acesso" className="pt-3">
            {!criando && <AcessoBar barId={form.id} />}
          </TabsContent>
        </Tabs>

        <div className="px-6 pb-5 flex justify-end gap-2 border-t border-[hsl(var(--border))] pt-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {criando ? 'Criar bar' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Upload da logo do bar: anexo (preserva PNG/transparência) + preview ──
// Não redimensiona o arquivo destrutivamente; o header/seletor exibem com object-contain
// num box de altura fixa, então qualquer logo "cabe" sem distorcer.
function LogoUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const { toast } = useToast();
  const { uploadFile } = useFileUpload();
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setEnviando(true);
    try {
      // compress:false → mantém o arquivo original (PNG transparente não vira JPEG).
      const res = await uploadFile(file, { folder: 'bar_logos', compress: false, maxSizeMB: 5 });
      onChange(res.url);
      toast({ title: 'Logo enviada' });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar logo', description: e?.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <Label className="text-xs">Logo do bar</Label>
      <div className="mt-1 flex items-center gap-3">
        <div className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-muted/40">
          {value
            ? <img src={value} alt="logo" className="max-h-full max-w-full object-contain" />
            : <Store className="w-6 h-6 text-muted-foreground" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => onFile(e.target.files?.[0])}
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={enviando}>
              {enviando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
              {value ? 'Trocar logo' : 'Enviar logo'}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onChange('')}>
                Remover
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">PNG com fundo transparente fica melhor. O tamanho ajusta sozinho no header.</p>
        </div>
      </div>
    </div>
  );
}

function AcessoBar({ barId }: { barId: number }) {
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioAcesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [add, setAdd] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/configuracoes/bars/${barId}/acesso`);
      setUsuarios(res.usuarios || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar acessos', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [barId, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const conceder = async () => {
    if (!email.trim()) return;
    setAdd(true);
    try {
      await api.post(`/api/configuracoes/bars/${barId}/acesso`, { email: email.trim() });
      setEmail('');
      await carregar();
      toast({ title: 'Acesso concedido' });
    } catch (e: any) {
      toast({ title: 'Erro ao conceder acesso', description: e?.message, variant: 'destructive' });
    } finally {
      setAdd(false);
    }
  };

  const revogar = async (u: UsuarioAcesso) => {
    try {
      await api.delete(`/api/configuracoes/bars/${barId}/acesso?usuario_id=${u.auth_id}`);
      await carregar();
    } catch (e: any) {
      toast({ title: 'Erro ao revogar', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input className="h-9" placeholder="Email do usuário para dar acesso" value={email}
          onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') conceder(); }} />
        <Button className="h-9 shrink-0" onClick={conceder} disabled={add || !email.trim()}>
          {add ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
      {loading ? (
        <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : usuarios.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Ninguém tem acesso a este bar ainda.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {usuarios.map(u => (
            <div key={u.auth_id} className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{u.nome || u.email}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email} · {u.role}</div>
              </div>
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-500/10 shrink-0"
                onClick={() => revogar(u)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Prontidão: checklist do que está pronto x pendente no bar ──
interface ProntItem { chave: string; label: string; status: 'ok' | 'pendente' | 'opcional'; detalhe: string }

function ProntidaoBar({ barId }: { barId: number }) {
  const { toast } = useToast();
  const [itens, setItens] = useState<ProntItem[]>([]);
  const [resumo, setResumo] = useState<{ total: number; concluidos: number; pendentes: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/configuracoes/bars/${barId}/prontidao`);
      setItens(res.itens || []);
      setResumo(res.resumo || null);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar prontidão', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [barId, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {resumo && (
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{resumo.concluidos}/{resumo.total}</strong> prontos
          {resumo.pendentes > 0 && <> · {resumo.pendentes} pendente(s)</>}
        </p>
      )}
      <div className="space-y-1.5">
        {itens.map(it => {
          const ok = it.status === 'ok';
          const opc = it.status === 'opcional';
          return (
            <div key={it.chave} className="flex items-start gap-2.5 rounded-md border border-[hsl(var(--border))] px-3 py-2">
              {ok
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                : <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${opc ? 'text-muted-foreground' : 'text-amber-500'}`} />}
              <div className="min-w-0">
                <div className="text-sm font-medium">{it.label}{opc && <span className="text-xs text-muted-foreground font-normal"> (opcional)</span>}</div>
                <div className="text-xs text-muted-foreground">{it.detalhe}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Integrações do bar: status + conectar Instagram + atalho ──
interface IntegBar { id: string; nome: string; statusGeral: string; problemas: string[] }

function IntegracoesBar({ barId }: { barId: number }) {
  const { toast } = useToast();
  const [itens, setItens] = useState<IntegBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [conectando, setConectando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/configuracoes/administracao/integracoes?bar_id=${barId}`);
      setItens((res.integracoes || []).filter((i: any) => i.escopo === 'bar'));
    } catch (e: any) {
      toast({ title: 'Erro ao carregar integrações', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [barId, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const conectarInstagram = async () => {
    setConectando(true);
    try {
      const resp = await fetch(`/api/integracoes/instagram/iniciar?bar_id=${barId}`);
      const json = await resp.json();
      if (!resp.ok || !json.url) throw new Error(json?.error || 'Falha');
      window.location.href = json.url;
    } catch (e: any) {
      toast({ title: 'Erro ao conectar Instagram', description: e?.message, variant: 'destructive' });
      setConectando(false);
    }
  };

  const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
    conectada: { txt: 'Conectada', cls: 'bg-emerald-500/15 text-emerald-600' },
    parcial: { txt: 'Atenção', cls: 'bg-amber-500/15 text-amber-600' },
    desconectada: { txt: 'Desconectada', cls: 'bg-red-500/15 text-red-600' },
    nao_configurada: { txt: 'Não configurada', cls: 'bg-muted text-muted-foreground' },
  };

  if (loading) return <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {/* Conta Azul: fluxo de conexão completo (credenciais + OAuth) */}
      <ContaAzulConnect barId={barId} />

      {/* Stone → Conta Azul: antecipação de crédito (setup por bar) */}
      <StoneAntecipacaoConfig barId={barId} />

      <div className="space-y-1.5">
        {itens.filter(i => i.id !== 'contaazul').map(i => {
          const s = STATUS_LABEL[i.statusGeral] || STATUS_LABEL.nao_configurada;
          return (
            <div key={i.id} className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{i.nome}</div>
                {i.id === 'inter' && i.statusGeral !== 'conectada'
                  ? <div className="text-xs text-muted-foreground">Credencial bancária é cadastrada pelo processo seguro (cifrada, fora da web) — fale com o time técnico.</div>
                  : i.problemas?.[0] && <div className="text-xs text-muted-foreground truncate">{i.problemas[0]}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {i.id === 'instagram' && i.statusGeral !== 'conectada' && (
                  <Button size="sm" variant="outline" className="h-7" onClick={conectarInstagram} disabled={conectando}>
                    {conectando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Instagram className="w-3.5 h-3.5 mr-1" />Conectar</>}
                  </Button>
                )}
                <Badge className={`${s.cls} text-[10px]`}>{s.txt}</Badge>
              </div>
            </div>
          );
        })}
      </div>
      <Link href="/configuracoes/administracao/integracoes" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <Plug className="w-3.5 h-3.5" /> Abrir tela completa de integrações <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ── Stone → CA: antecipação de crédito (liga/desliga + dias do mês em chips) ──
function StoneAntecipacaoConfig({ barId }: { barId: number }) {
  const { toast } = useToast();
  const [antecipa, setAntecipa] = useState(false);
  const [dias, setDias] = useState<number[]>([1]);
  const [novoDia, setNovoDia] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/api/financeiro/stone/antecipacao-config?bar_id=${barId}`);
        if (!vivo) return;
        setAntecipa(!!r.config?.antecipa);
        setDias(((r.config?.dias_landing as number[]) || [1]));
      } catch { /* silencioso */ } finally { if (vivo) setLoading(false); }
    })();
    return () => { vivo = false; };
  }, [barId]);

  const addDia = () => {
    const n = parseInt(novoDia.trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > 31) { toast({ title: 'Dia inválido (1 a 31)', variant: 'destructive' }); return; }
    if (dias.includes(n)) { setNovoDia(''); return; }
    setDias(prev => [...prev, n].sort((a, b) => a - b));
    setNovoDia('');
  };
  const removeDia = (n: number) => setDias(prev => prev.filter(d => d !== n));

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await api.put('/api/financeiro/stone/antecipacao-config', { bar_id: barId, antecipa, dias_landing: dias });
      setDias(((r.config?.dias_landing as number[]) || [1]));
      toast({ title: 'Antecipação salva' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally { setSalvando(false); }
  };

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">S</span>
          Stone — antecipação de crédito
        </span>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      {!loading && (
        <>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={antecipa} onChange={e => setAntecipa(e.target.checked)} />
            <span>
              <span className="text-sm font-medium">Antecipa o crédito?</span>
              <span className="block text-[11px] text-muted-foreground">
                Se ligado, o crédito cai nos dias fixos abaixo (em vez do ~D+30 da Stone). Débito e PIX não mudam.
              </span>
            </span>
          </label>
          <div className={antecipa ? '' : 'opacity-50 pointer-events-none'}>
            <Label className="text-xs">Dias do mês em que o crédito cai</Label>
            {/* chips dos dias selecionados */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {dias.length === 0 && <span className="text-[11px] text-muted-foreground">nenhum dia — adicione ao lado</span>}
              {dias.map(d => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 text-xs px-2 py-0.5">
                  dia {d}
                  <button type="button" onClick={() => removeDia(d)} className="hover:text-red-600" title="Remover">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {/* adicionar dia */}
              <span className="inline-flex items-center gap-1">
                <Input type="number" min={1} max={31} className="h-7 w-16 text-sm" placeholder="dia" value={novoDia}
                  onChange={e => setNovoDia(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDia(); } }} />
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={addDia}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Ex.: adicione <b>1</b> e <b>15</b> pra antecipar duas vezes no mês. Vale o próximo dia da lista após a venda;
              se cair em fim de semana/feriado, rola pro próximo dia útil.
            </p>
          </div>
          <Button size="sm" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}Salvar
          </Button>
        </>
      )}
    </div>
  );
}

// ── Conta Azul: salvar client_id/secret -> conectar via OAuth -> status ──
function ContaAzulConnect({ barId }: { barId: number }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/financeiro/contaazul/status?bar_id=${barId}`);
      setStatus(await r.json());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [barId]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvarCredenciais = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({ title: 'Informe client_id e client_secret', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const r = await fetch('/api/financeiro/contaazul/credentials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, client_id: clientId.trim(), client_secret: clientSecret.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Falha ao salvar');
      toast({ title: 'Credenciais salvas', description: 'Agora clique em Conectar.' });
      setClientId(''); setClientSecret(''); setMostrarForm(false);
      await carregar();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const conectar = () => { window.location.href = `/api/financeiro/contaazul/oauth/authorize?bar_id=${barId}`; };

  const conectado = !!status?.connected;
  const temCred = !!status?.has_credentials;

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-[#0066B3] text-white text-[10px] font-bold flex items-center justify-center">CA</span>
          Conta Azul
        </span>
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          : <Badge className={conectado ? 'bg-emerald-500/15 text-emerald-600 text-[10px]' : 'bg-muted text-muted-foreground text-[10px]'}>
              {conectado ? 'Conectada' : temCred ? 'Falta autorizar' : 'Não configurada'}
            </Badge>}
      </div>

      {!loading && conectado && (
        <p className="text-xs text-muted-foreground">
          {status?.stats?.lancamentos ?? 0} lançamentos · {status?.stats?.pessoas ?? 0} fornecedores sincronizados.
        </p>
      )}

      {!loading && !conectado && (
        <div className="space-y-2">
          {temCred ? (
            <Button size="sm" onClick={conectar}>Conectar Conta Azul (autorizar)</Button>
          ) : !mostrarForm ? (
            <Button size="sm" variant="outline" onClick={() => setMostrarForm(true)}>Configurar Conta Azul</Button>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Cole o client_id e client_secret do app Conta Azul deste bar:</p>
              <Input className="h-8 text-xs" placeholder="client_id" value={clientId} onChange={e => setClientId(e.target.value)} />
              <Input className="h-8 text-xs" placeholder="client_secret" type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={salvarCredenciais} disabled={salvando}>
                  {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMostrarForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
