'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Bell, BellOff, Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ativarPush, desativarPush, pushSuportado, pushJaInscrito } from '@/lib/push-subscribe';

/** Liga/desliga notificações push neste dispositivo + envia um teste. */
export function PushToggle({ barId }: { barId?: number }) {
  const { showToast } = useToast();
  const [suportado, setSuportado] = useState(true);
  const [inscrito, setInscrito] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testando, setTestando] = useState(false);

  useEffect(() => {
    setSuportado(pushSuportado());
    pushJaInscrito().then(setInscrito).catch(() => {});
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      const r = inscrito ? await desativarPush() : await ativarPush(barId);
      if (r.ok) {
        setInscrito(!inscrito);
        showToast({ type: 'success', title: inscrito ? 'Notificações desativadas' : 'Notificações ativadas neste aparelho' });
      } else {
        showToast({ type: 'error', title: 'Não foi possível', message: r.error });
      }
    } finally { setLoading(false); }
  };

  const testar = async () => {
    setTestando(true);
    try {
      const r = await api.post('/api/push/send', { title: 'Zykor 🔔', body: 'Notificação de teste — funcionou!', url: '/' });
      showToast({ type: r?.enviados ? 'success' : 'info', title: r?.enviados ? 'Teste enviado!' : 'Nenhum aparelho inscrito', message: r?.enviados ? 'Deve chegar em instantes.' : 'Ative as notificações primeiro.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro no teste', message: e?.message });
    } finally { setTestando(false); }
  };

  if (!suportado) {
    return <p className="text-xs text-muted-foreground">Notificações push não são suportadas neste navegador. No iPhone, instale o app na Tela de Início primeiro.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={inscrito ? 'outline' : 'default'} size="sm" onClick={toggle} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : inscrito ? <BellOff className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
        {inscrito ? 'Desativar notificações' : 'Ativar notificações'}
      </Button>
      {inscrito && (
        <Button variant="ghost" size="sm" onClick={testar} disabled={testando}>
          {testando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Enviar teste
        </Button>
      )}
    </div>
  );
}
