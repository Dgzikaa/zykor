'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { Loader2, KeyRound, CheckCircle2, XCircle, Save, ShieldCheck, FileUp, Plus, Landmark } from 'lucide-react';

type Conta = { id: number; empresa_nome: string; cnpj: string | null; conta_corrente: string | null; formato: string; configurado: boolean };

export default function InterCredenciaisPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;

  const [carregando, setCarregando] = useState(true);
  const [contas, setContas] = useState<Conta[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  // formulário
  const [editId, setEditId] = useState<number | null>(null);
  const [empresa, setEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [contaCorrente, setContaCorrente] = useState('');
  const [cert, setCert] = useState('');
  const [certNome, setCertNome] = useState('');
  const [key, setKey] = useState('');
  const [keyNome, setKeyNome] = useState('');
  const certRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPageTitle('🏦 Credenciais do Banco Inter');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const carregar = useCallback(async () => {
    if (!barId) { setContas([]); setCarregando(false); return; }
    setCarregando(true);
    try {
      const r = await api.get(`/api/configuracoes/credenciais/inter?bar_id=${barId}`);
      setContas(r.success ? (r.data || []) : []);
    } catch { setContas([]); }
    finally { setCarregando(false); }
  }, [barId]);
  useEffect(() => { carregar(); }, [carregar]);

  const limpar = () => {
    setEditId(null); setEmpresa(''); setCnpj(''); setClientId(''); setClientSecret('');
    setContaCorrente(''); setCert(''); setCertNome(''); setKey(''); setKeyNome('');
    if (certRef.current) certRef.current.value = '';
    if (keyRef.current) keyRef.current.value = '';
  };

  const lerArquivo = (file: File | undefined, setValor: (v: string) => void, setNome: (v: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setValor(String(reader.result || '').trim()); setNome(file.name); };
    reader.readAsText(file);
  };

  const salvar = async () => {
    if (!barId) { setMsg({ ok: false, texto: 'Selecione um bar no seletor do topo.' }); return; }
    if (!clientId.trim() || !clientSecret || !contaCorrente.trim() || !cert || !key) {
      setMsg({ ok: false, texto: 'Preencha client_id, client_secret, conta corrente e suba o certificado e a chave.' });
      return;
    }
    setSalvando(true); setMsg(null);
    try {
      const r = await api.post('/api/configuracoes/credenciais/inter', {
        bar_id: barId, id: editId || undefined,
        empresa_nome: empresa.trim() || undefined, cnpj: cnpj.trim() || undefined,
        client_id: clientId.trim(), client_secret: clientSecret,
        conta_corrente: contaCorrente.trim(), cert, key,
      });
      if (!r.success) throw new Error(r.error || 'Falha ao salvar');
      setMsg({ ok: true, texto: editId ? 'Credencial atualizada e cifrada.' : 'Credencial cadastrada e cifrada com segurança.' });
      limpar();
      await carregar();
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.message || 'Falha ao salvar' });
    } finally { setSalvando(false); }
  };

  const editar = (c: Conta) => {
    setEditId(c.id); setEmpresa(c.empresa_nome || ''); setCnpj(c.cnpj || '');
    setContaCorrente(c.conta_corrente || ''); setClientId(''); setClientSecret('');
    setCert(''); setCertNome(''); setKey(''); setKeyNome('');
    setMsg({ ok: true, texto: `Substituindo a credencial #${c.id} — reenvie client_id/secret, certificado e chave.` });
    if (certRef.current) certRef.current.value = '';
    if (keyRef.current) keyRef.current.value = '';
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: '#FF7A00' }}><Landmark className="w-5 h-5" /></div>
          <div>
            <h1 className="text-lg font-semibold">Credenciais do Banco Inter</h1>
            <p className="text-sm text-muted-foreground">Cada bar tem sua própria conta Inter (PIX/pagamentos). Configurando o bar: <b>{selectedBar?.nome || '—'}</b>.</p>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 px-3 py-2 text-xs flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>O client_secret, o certificado e a chave são <b>cifrados no servidor</b> (envelope encryption) — o banco nunca guarda nada em texto. Os segredos <b>não</b> são exibidos de volta.</span>
        </div>

        {carregando ? <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
        : (
          <div className="mt-5 space-y-6">
            {/* Contas já cadastradas */}
            <section className="rounded-lg border p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> Contas cadastradas neste bar</h2>
              {contas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conta Inter cadastrada ainda para <b>{selectedBar?.nome || 'este bar'}</b>.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr><th className="text-left py-2">Empresa</th><th className="text-left py-2">CNPJ</th><th className="text-left py-2">Conta</th><th className="text-left py-2">Formato</th><th className="text-right py-2"></th></tr>
                    </thead>
                    <tbody>
                      {contas.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2">{c.empresa_nome}</td>
                          <td className="py-2 font-mono text-xs">{c.cnpj || '—'}</td>
                          <td className="py-2 font-mono text-xs">{c.conta_corrente || '—'}</td>
                          <td className="py-2">{c.formato === 'envelope'
                            ? <span className="inline-flex items-center gap-1 text-emerald-600"><ShieldCheck className="w-3.5 h-3.5" />cifrado</span>
                            : <span className="text-amber-600">{c.formato}</span>}</td>
                          <td className="py-2 text-right"><button type="button" onClick={() => editar(c)} className="text-xs text-primary hover:underline">substituir</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Formulário */}
            <section className="rounded-lg border p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2">
                {editId ? <>Substituir credencial <span className="text-xs font-mono text-muted-foreground">#{editId}</span></> : <><Plus className="w-4 h-4" /> Nova credencial Inter</>}
              </h2>
              <p className="text-[11px] text-muted-foreground">No Internet Banking PJ do bar → <b>Inter API / Integrações</b>, crie a aplicação com escopo de Pagamento/PIX e pegue: client_id, client_secret, conta corrente e baixe o <b>certificado (.crt)</b> + a <b>chave (.key)</b>.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Empresa (opcional)</label>
                  <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ex.: Ordinário Bar LTDA" className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">CNPJ (opcional)</label>
                  <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">client_id</label>
                  <input value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background font-mono" autoComplete="off" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">client_secret</label>
                  <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="cole o secret" className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background font-mono" autoComplete="off" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Conta corrente (com dígito)</label>
                  <input value={contaCorrente} onChange={(e) => setContaCorrente(e.target.value)} placeholder="Ex.: 123456789-0" className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Certificado (.crt / .pem)</label>
                  <input ref={certRef} type="file" accept=".crt,.pem,.cer,.txt" onChange={(e) => lerArquivo(e.target.files?.[0], setCert, setCertNome)} className="mt-1 w-full text-xs" />
                  {cert && <span className="text-[11px] text-emerald-600 inline-flex items-center gap-1 mt-0.5"><FileUp className="w-3 h-3" />{certNome} carregado</span>}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Chave privada (.key)</label>
                  <input ref={keyRef} type="file" accept=".key,.pem,.txt" onChange={(e) => lerArquivo(e.target.files?.[0], setKey, setKeyNome)} className="mt-1 w-full text-xs" />
                  {key && <span className="text-[11px] text-emerald-600 inline-flex items-center gap-1 mt-0.5"><FileUp className="w-3 h-3" />{keyNome} carregado</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={salvar} disabled={salvando}
                  className="inline-flex items-center gap-1.5 text-sm rounded-md px-3 py-2 bg-primary text-primary-foreground disabled:opacity-40">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editId ? 'Salvar substituição' : 'Cadastrar credencial'}
                </button>
                {editId && <button type="button" onClick={limpar} className="text-sm rounded-md px-3 py-2 border hover:bg-muted/50">Cancelar</button>}
                {msg && (
                  <span className={`text-sm flex items-center gap-1 ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{msg.texto}
                  </span>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
