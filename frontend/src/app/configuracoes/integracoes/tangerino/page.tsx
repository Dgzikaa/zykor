'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/lib/api-client';
import { Loader2, KeyRound, CheckCircle2, XCircle, Save, Plug } from 'lucide-react';

export default function TangerinoCadastroPage() {
  const [carregando, setCarregando] = useState(true);
  const [cadastrado, setCadastrado] = useState(false);
  const [credencial, setCredencial] = useState<any>(null);
  const [token, setToken] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; msg: string } | null>(null);
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('🕐 Tangerino (Sólides DP)');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const carregar = async () => {
    setCarregando(true);
    try { const r = await api.get('/api/rh/tangerino/cadastrar'); setCadastrado(r.cadastrado); setCredencial(r.credencial); }
    catch { /* sem credencial */ }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!token.trim()) return;
    setSalvando(true); setTeste(null);
    try { await api.post('/api/rh/tangerino/cadastrar', { token: token.trim(), empresa_nome: empresa.trim() || undefined }); setToken(''); await carregar(); }
    catch (e: any) { setTeste({ ok: false, msg: e?.message || 'Falha ao salvar' }); }
    finally { setSalvando(false); }
  };

  const testar = async () => {
    setTestando(true); setTeste(null);
    try { const r = await api.get('/api/rh/tangerino/test'); setTeste({ ok: !!r.ok, msg: r.ok ? `Conectado! (${r.resposta || 'ok'})` : (r.erro || `HTTP ${r.http_status}`) }); }
    catch (e: any) { setTeste({ ok: false, msg: e?.message || 'Falha no teste' }); }
    finally { setTestando(false); }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white" style={{ background: '#F59E0B' }}>TG</div>
          <div>
            <p className="text-sm text-muted-foreground">Folha de ponto, jornada e férias — alimenta o ponto da Central do Funcionário.</p>
          </div>
        </div>

        {carregando ? <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
        : (
          <div className="mt-5 space-y-4">
            <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${cadastrado ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/40' : 'bg-muted/40'}`}>
              {cadastrado ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <KeyRound className="w-4 h-4 text-muted-foreground" />}
              {cadastrado ? <span>Token cadastrado para este bar{credencial?.empresa_nome ? ` (${credencial.empresa_nome})` : ''}.</span> : <span>Nenhum token cadastrado para este bar ainda.</span>}
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Token da API (vem do suporte da Sólides)</label>
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cadastrado ? '•••••• (cole pra substituir)' : 'cole o token aqui'}
                  className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background font-mono" autoComplete="off" />
                <p className="text-[11px] text-muted-foreground mt-1">É enviado como <code>Authorization: Basic &lt;token&gt;</code>. Guardado cifrado, nunca exibido de volta.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome da empresa (opcional)</label>
                <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="ex.: Ordinário Bar"
                  className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={salvar} disabled={salvando || !token.trim()}
                  className="inline-flex items-center gap-1.5 text-sm rounded-md px-3 py-2 bg-primary text-primary-foreground disabled:opacity-40">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar token
                </button>
                <button onClick={testar} disabled={testando || !cadastrado} title={!cadastrado ? 'Salve o token primeiro' : ''}
                  className="inline-flex items-center gap-1.5 text-sm rounded-md px-3 py-2 border disabled:opacity-40 hover:bg-muted/50">
                  {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}Testar conexão
                </button>
              </div>
              {teste && (
                <div className={`text-sm flex items-center gap-2 ${teste.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {teste.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{teste.msg}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Depois de validar, o sync de marcações (cron diário) começa a preencher o ponto na Central do Funcionário.
              A migração do histórico é avaliada na hora (limite da API + export manual quando preciso).
            </p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
