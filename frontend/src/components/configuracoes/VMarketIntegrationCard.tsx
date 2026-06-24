'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Loader2, CheckCircle, Save, Plug } from 'lucide-react';

type Bar = { id: number; nome?: string } | null;

export default function VMarketIntegrationCard({ selectedBar }: { selectedBar: Bar }) {
  const barId = selectedBar?.id;
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://integracao-compras.vmarketcompras.com.br');
  const [status, setStatus] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  const carregar = useCallback(async () => {
    if (!barId) return;
    try {
      const r = await fetch(`/api/configuracoes/credenciais/vmarket?bar_id=${barId}`, { cache: 'no-store' }).then(x => x.json());
      if (r.success) { setStatus(r); if (r.email) setEmail(r.email); if (r.base_url) setBaseUrl(r.base_url); }
    } catch { /* ignore */ }
  }, [barId]);
  useEffect(() => { setResultado(null); carregar(); }, [carregar]);

  const salvar = async () => {
    if (!barId) return;
    setSalvando(true); setResultado(null);
    try {
      const r = await fetch('/api/configuracoes/credenciais/vmarket', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, email, senha, base_url: baseUrl }),
      }).then(x => x.json());
      if (!r.success) throw new Error(r.error || 'Falha ao salvar');
      setSenha(''); await carregar();
      setResultado({ ok: true, msg: 'Credenciais salvas. Agora clique em Testar conexão.' });
    } catch (e: any) { setResultado({ ok: false, msg: e?.message || 'Erro ao salvar' }); }
    finally { setSalvando(false); }
  };

  const testar = async () => {
    if (!barId) return;
    setTestando(true); setResultado(null);
    try {
      const r = await fetch('/api/configuracoes/credenciais/vmarket', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, action: 'testar' }),
      }).then(x => x.json());
      if (r.success) {
        setResultado({ ok: true, msg: `Conectado! ${r.total != null ? `${r.total} aprovações na conta.` : ''} (login: ${r.login_path})` });
        carregar();
      } else {
        const det = r.etapa === 'login'
          ? `Login falhou. Endpoints testados: ${(r.tentativas || []).map((t: any) => `${t.path}→${t.status}`).join(', ')}`
          : (r.error || 'Falha no teste') + (r.corpo ? ` — ${r.corpo}` : '');
        setResultado({ ok: false, msg: det });
      }
    } catch (e: any) { setResultado({ ok: false, msg: e?.message || 'Erro no teste' }); }
    finally { setTestando(false); }
  };

  return (
    <Card className="card-dark shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl"><ShoppingCart className="w-6 h-6 text-orange-600 dark:text-orange-400" /></div>
            <div>
              <CardTitle className="text-lg font-semibold">VMarket Compras</CardTitle>
              <CardDescription className="text-sm mt-1">Cotações e aprovações de compras · credencial por bar</CardDescription>
            </div>
          </div>
          {status?.configurado && (
            <Badge variant="outline" className="text-xs border bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300">
              <CheckCircle className="w-3.5 h-3.5 mr-1" />Configurado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {!barId ? <p className="text-sm text-muted-foreground">Selecione um bar.</p> : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail (VMarket)</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Senha</Label>
              <Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder={status?.configurado ? '•••••••• (preencha p/ trocar)' : 'senha'} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Base URL</Label>
              <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="text-xs" />
            </div>

            {resultado && (
              <div className={`text-xs rounded-md px-3 py-2 ${resultado.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>{resultado.msg}</div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={salvar} disabled={salvando || !email || !senha} className="flex-1">
                {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={testar} disabled={testando || !status?.configurado} className="flex-1">
                {testando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plug className="w-4 h-4 mr-1.5" />}Testar conexão
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">A senha é gravada no servidor (api_credentials) e nunca volta pra tela. O teste autentica e lista 1 aprovação.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
