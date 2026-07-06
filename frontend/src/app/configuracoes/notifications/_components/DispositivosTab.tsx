'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { PushToggle } from '@/components/PushToggle';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { Smartphone, Bell, MessageCircle, Loader2, Check } from 'lucide-react';

function soDigitos(s: string): string {
  return (s || '').replace(/\D/g, '');
}

/** Card self-service: o usuário cadastra o próprio WhatsApp p/ receber alertas. */
function MeuWhatsAppCard() {
  const [telefone, setTelefone] = useState('');
  const [inicial, setInicial] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/usuarios/perfil');
        const tel = soDigitos(res?.perfil?.telefone || '');
        setTelefone(tel);
        setInicial(tel);
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const valido = telefone.length === 10 || telefone.length === 11;
  const mudou = telefone !== inicial;

  const salvar = async () => {
    if (!valido) {
      toast.error('Informe o número com DDD (10 ou 11 dígitos).');
      return;
    }
    setSalvando(true);
    try {
      const res = await api.put('/api/usuarios/perfil', { celular: telefone });
      if (res?.success) {
        toast.success('WhatsApp salvo! Você já pode receber alertas por lá.');
        setInicial(telefone);
      } else {
        toast.error(res?.error || 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-5 space-y-3">
        <div className="flex items-center gap-2 font-medium">
          <MessageCircle className="w-4 h-4 text-green-500" /> Meu WhatsApp para alertas
        </div>
        <p className="text-sm text-muted-foreground">
          Cadastre seu WhatsApp para receber os alertas do Zykor por lá (canal oficial). Você só
          recebe os alertas em que é destinatário e que tenham o canal WhatsApp ligado nas Regras.
        </p>
        <div className="flex items-center gap-2 max-w-sm">
          <Input
            type="text"
            inputMode="numeric"
            placeholder="61999998888 (com DDD)"
            value={telefone}
            onChange={(e) => setTelefone(soDigitos(e.target.value).slice(0, 11))}
            disabled={loading || salvando}
          />
          <Button onClick={salvar} disabled={loading || salvando || !mudou || !valido} size="sm">
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span className="ml-1">Salvar</span>
          </Button>
        </div>
        {telefone.length > 0 && !valido && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Digite DDD + número (10 ou 11 dígitos).
          </p>
        )}
        <p className="text-xs text-muted-foreground border-t pt-3">
          💬 O número passa a receber mensagens do WhatsApp oficial do Zykor. Não precisa fazer mais
          nada — os alertas chegam automaticamente, a qualquer hora.
        </p>
      </CardContent>
    </Card>
  );
}

export default function DispositivosTab() {
  const { selectedBar } = useBar();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center gap-2 font-medium">
            <Smartphone className="w-4 h-4 text-blue-500" /> Notificações push neste aparelho
          </div>
          <p className="text-sm text-muted-foreground">
            Ative para receber os avisos do Zykor (financeiro, operacional, pendências) mesmo com o
            app fechado. É preciso ativar em <b>cada aparelho</b>.
          </p>
          <PushToggle barId={selectedBar?.id} />
          <p className="text-xs text-muted-foreground border-t pt-3">
            📱 <b>iPhone:</b> abra o Zykor no Safari → Compartilhar → <b>Adicionar à Tela de
            Início</b>, abra pelo ícone instalado e então ative aqui (o iOS só permite push pelo app
            instalado).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5 space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <Bell className="w-4 h-4 text-blue-500" /> No Zykor (tempo real)
          </div>
          <p className="text-sm text-muted-foreground">
            As notificações aparecem instantaneamente no sino do topo e na Caixa de entrada — sem
            precisar atualizar a página. Este canal está sempre ligado.
          </p>
        </CardContent>
      </Card>

      <MeuWhatsAppCard />
    </div>
  );
}
