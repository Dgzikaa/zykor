'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/lib/api-client';
import { Loader2, KeyRound, CheckCircle2, XCircle, Save, Plug, Phone, Plus } from 'lucide-react';

export default function UmblerConfigPage() {
  const { setPageTitle } = usePageTitle();
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState<any>(null);

  // token da conta
  const [org, setOrg] = useState('');
  const [token, setToken] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; msg: string } | null>(null);

  // canal por bar
  const [chBar, setChBar] = useState<number | ''>('');
  const [chChannelId, setChChannelId] = useState('');
  const [chChannelName, setChChannelName] = useState('');
  const [chPhone, setChPhone] = useState('');
  const [salvandoCanal, setSalvandoCanal] = useState(false);
  const [canalMsg, setCanalMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setPageTitle('🟢 Umbler Talk');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/api/umbler/account');
      setDados(r);
      setOrg(r?.account?.organization_id || '');
    } catch { /* sem config */ }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);

  const salvarToken = async () => {
    setSalvando(true); setTeste(null);
    try {
      await api.post('/api/umbler/account', { organization_id: org.trim() || undefined, api_token: token.trim() || undefined });
      setToken('');
      await carregar();
    } catch (e: any) { setTeste({ ok: false, msg: e?.message || 'Falha ao salvar' }); }
    finally { setSalvando(false); }
  };

  const testar = async () => {
    setTestando(true); setTeste(null);
    try {
      const r = await api.get('/api/umbler/account?action=test');
      setTeste({ ok: !!r.ok, msg: r.ok ? `Conectado! ${r.aprovados} templates aprovados (${r.total} no total).` : (r.erro || `HTTP ${r.http_status}`) });
    } catch (e: any) { setTeste({ ok: false, msg: e?.message || 'Falha no teste' }); }
    finally { setTestando(false); }
  };

  const editarCanal = (c: any) => {
    setChBar(c.bar_id);
    setChChannelId(c.channel_id || '');
    setChChannelName(c.channel_name || '');
    setChPhone(c.phone_number || '');
    setCanalMsg(null);
  };

  const salvarCanal = async () => {
    if (!chBar || !chChannelId.trim() || !chPhone.trim()) {
      setCanalMsg({ ok: false, msg: 'Preencha bar, channel_id e número.' });
      return;
    }
    setSalvandoCanal(true); setCanalMsg(null);
    try {
      await api.post('/api/umbler/config', {
        bar_id: chBar,
        organization_id: org.trim() || dados?.account?.organization_id,
        channel_id: chChannelId.trim(),
        channel_name: chChannelName.trim() || undefined,
        phone_number: chPhone.trim(),
      });
      setChBar(''); setChChannelId(''); setChChannelName(''); setChPhone('');
      setCanalMsg({ ok: true, msg: 'Canal salvo.' });
      await carregar();
    } catch (e: any) { setCanalMsg({ ok: false, msg: e?.message || 'Falha ao salvar canal' }); }
    finally { setSalvandoCanal(false); }
  };

  const acc = dados?.account;
  const canais: any[] = dados?.bares_config || [];
  const bares: any[] = dados?.bares || [];

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white" style={{ background: '#16A34A' }}>UM</div>
          <p className="text-sm text-muted-foreground">Conta única da Umbler serve os dois bares — o token é da conta; cada bar tem seu canal/número.</p>
        </div>

        {carregando ? <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
        : (
          <div className="mt-5 space-y-6">
            {/* ── Token da conta ── */}
            <section className="rounded-lg border p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> Token da conta</h2>
              <div className={`rounded-md border px-3 py-2 text-sm flex items-center gap-2 ${acc?.tem_token ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/40' : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200'}`}>
                {acc?.tem_token
                  ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> <span>Token no banco: <code>{acc.token_preview}</code>{acc.updated_at ? ` · atualizado ${new Date(acc.updated_at).toLocaleDateString('pt-BR')}` : ''}</span></>
                  : <><KeyRound className="w-4 h-4 text-amber-600" /> <span>Sem token no banco — usando o do ambiente (env) como fallback.</span></>}
              </div>
              <div>
                <label htmlFor="org" className="text-xs font-medium text-muted-foreground">Organization ID</label>
                <input id="org" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="ex.: aDjKophL8jEd_D8m"
                  className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background font-mono" />
              </div>
              <div>
                <label htmlFor="tok" className="text-xs font-medium text-muted-foreground">Token da API (Umbler → Conta → Token de API)</label>
                <input id="tok" type="password" value={token} onChange={(e) => setToken(e.target.value)}
                  placeholder={acc?.tem_token ? '•••••• (cole pra substituir)' : 'cole o token aqui'}
                  className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background font-mono" autoComplete="off" />
                <p className="text-[11px] text-muted-foreground mt-1">Enviado como <code>Authorization: Bearer &lt;token&gt;</code>. Nunca é exibido de volta.</p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={salvarToken} disabled={salvando}
                  className="inline-flex items-center gap-1.5 text-sm rounded-md px-3 py-2 bg-primary text-primary-foreground disabled:opacity-40">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </button>
                <button type="button" onClick={testar} disabled={testando}
                  className="inline-flex items-center gap-1.5 text-sm rounded-md px-3 py-2 border disabled:opacity-40 hover:bg-muted/50">
                  {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Testar conexão
                </button>
              </div>
              {teste && (
                <div className={`text-sm flex items-center gap-2 ${teste.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {teste.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{teste.msg}
                </div>
              )}
            </section>

            {/* ── Canais por bar ── */}
            <section className="rounded-lg border p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><Phone className="w-4 h-4" /> Canais por bar</h2>

              {canais.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2">Bar</th>
                        <th className="text-left py-2">Canal</th>
                        <th className="text-left py-2">Número</th>
                        <th className="text-left py-2">channel_id</th>
                        <th className="text-right py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {canais.map((c) => (
                        <tr key={`${c.bar_id}-${c.channel_id}`} className="border-b last:border-0">
                          <td className="py-2">{c.bar_nome}</td>
                          <td className="py-2">{c.channel_name || <span className="text-muted-foreground">—</span>}</td>
                          <td className="py-2 font-mono text-xs">{c.phone_number}</td>
                          <td className="py-2 font-mono text-xs text-muted-foreground">{c.channel_id}</td>
                          <td className="py-2 text-right">
                            <button type="button" onClick={() => editarCanal(c)} className="text-xs text-primary hover:underline">editar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-muted-foreground">Nenhum canal cadastrado ainda.</p>}

              {/* form add/editar */}
              <div className="rounded-md border border-dashed p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar / editar canal</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select value={chBar} onChange={(e) => setChBar(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="text-sm border rounded-md px-3 py-2 bg-background">
                    <option value="">Selecione o bar…</option>
                    {bares.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                  </select>
                  <input value={chChannelName} onChange={(e) => setChChannelName(e.target.value)} placeholder="Nome do canal (ex.: Ordinário Oficial)"
                    className="text-sm border rounded-md px-3 py-2 bg-background" />
                  <input value={chPhone} onChange={(e) => setChPhone(e.target.value)} placeholder="Número (ex.: +5561991029786)"
                    className="text-sm border rounded-md px-3 py-2 bg-background font-mono" />
                  <input value={chChannelId} onChange={(e) => setChChannelId(e.target.value)} placeholder="channel_id da Umbler"
                    className="text-sm border rounded-md px-3 py-2 bg-background font-mono" />
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={salvarCanal} disabled={salvandoCanal}
                    className="inline-flex items-center gap-1.5 text-sm rounded-md px-3 py-2 bg-primary text-primary-foreground disabled:opacity-40">
                    {salvandoCanal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar canal
                  </button>
                  {canalMsg && (
                    <span className={`text-sm flex items-center gap-1 ${canalMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {canalMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{canalMsg.msg}
                    </span>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
