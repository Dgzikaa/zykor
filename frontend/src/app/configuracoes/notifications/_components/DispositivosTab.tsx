'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { PushToggle } from '@/components/PushToggle';
import { Smartphone, Bell, MessageCircle } from 'lucide-react';

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

      <Card>
        <CardContent className="py-5 space-y-2">
          <div className="flex items-center gap-2 font-medium text-muted-foreground">
            <MessageCircle className="w-4 h-4" /> WhatsApp
            <span className="text-[10px] uppercase tracking-wide bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
              em breve
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Em breve será possível receber avisos no WhatsApp pelo canal oficial (Umbler Talk).
            Assim que estiver configurado, o WhatsApp aparece como opção nas Regras e no Enviar
            aviso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
