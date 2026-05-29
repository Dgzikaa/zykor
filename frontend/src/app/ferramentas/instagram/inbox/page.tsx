'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Inbox, Send, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Conversa = {
  id: number;
  participante_id: string;
  participante_username: string | null;
  ultima_mensagem_em: string | null;
  ultima_mensagem_texto: string | null;
  ultima_mensagem_autor: string | null;
  nao_lidas_count: number;
};

type Mensagem = {
  id: number;
  ig_message_id: string;
  autor: 'bar' | 'cliente';
  texto: string | null;
  enviada_em: string;
  sentimento?: string | null;
  categoria?: string | null;
};

const fmtData = (s: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export default function InboxPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionada, setSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const carregarConversas = useCallback(async () => {
    if (!selectedBar?.id) return;
    const r = await fetch(`/api/instagram/inbox?bar_id=${selectedBar.id}`);
    const j = await r.json();
    setConversas(j.conversas || []);
  }, [selectedBar?.id]);

  useEffect(() => {
    setLoading(true);
    carregarConversas().finally(() => setLoading(false));
    // Refresh a cada 30s
    const i = setInterval(carregarConversas, 30000);
    return () => clearInterval(i);
  }, [carregarConversas]);

  const abrirConversa = async (c: Conversa) => {
    setSelecionada(c);
    if (!selectedBar?.id) return;
    const r = await fetch(`/api/instagram/inbox?bar_id=${selectedBar.id}&conversa_id=${c.id}`);
    const j = await r.json();
    setMensagens(j.mensagens || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  const enviar = async () => {
    if (!selectedBar?.id || !selecionada || !texto.trim()) return;
    setEnviando(true);
    try {
      const r = await fetch('/api/instagram/inbox/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id, conversa_id: selecionada.id, texto: texto.trim() }),
      });
      const j = await r.json();
      if (!j.success) {
        toast({ title: 'Erro', description: j?.error || 'Falha ao enviar', variant: 'destructive' });
        return;
      }
      setTexto('');
      // Recarrega mensagens da conversa
      await abrirConversa(selecionada);
      await carregarConversas();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Skeleton className="h-[600px]" />
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Inbox className="w-6 h-6 text-pink-600" /> Inbox de DMs
        </h1>
        <p className="text-xs text-gray-500">Mensagens chegam via webhook em tempo real.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 h-[700px]">
          {/* Lista de conversas */}
          <aside className="col-span-4 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
            {conversas.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                <MessageSquare className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                Nenhuma DM ainda.
                <p className="text-xs mt-1">
                  Quando alguém mandar mensagem no @, vai aparecer aqui (via webhook).
                </p>
              </div>
            ) : (
              conversas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => abrirConversa(c)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors ${
                    selecionada?.id === c.id ? 'bg-pink-50 dark:bg-pink-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm truncate">
                      @{c.participante_username ?? c.participante_id.slice(0, 12)}
                    </span>
                    <span className="text-[10px] text-gray-400">{fmtData(c.ultima_mensagem_em)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {c.ultima_mensagem_autor === 'bar' && <span className="text-pink-600">Você: </span>}
                    {c.ultima_mensagem_texto ?? '...'}
                  </p>
                  {c.nao_lidas_count > 0 && (
                    <span className="inline-block mt-1 text-[10px] bg-pink-600 text-white px-1.5 py-0.5 rounded-full">
                      {c.nao_lidas_count} nova{c.nao_lidas_count > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              ))
            )}
          </aside>

          {/* Thread */}
          <section className="col-span-8 flex flex-col">
            {!selecionada ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                Selecione uma conversa pra ler.
              </div>
            ) : (
              <>
                <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">@{selecionada.participante_username ?? selecionada.participante_id.slice(0, 12)}</h2>
                    <p className="text-xs text-gray-500">{mensagens.length} mensagem{mensagens.length === 1 ? '' : 's'}</p>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-gray-50 dark:bg-gray-900/40">
                  {mensagens.map((m) => (
                    <div key={m.id} className={`flex ${m.autor === 'bar' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md rounded-2xl px-4 py-2 ${
                        m.autor === 'bar'
                          ? 'bg-pink-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-gray-800 rounded-bl-sm shadow-sm'
                      }`}>
                        <p className="text-sm whitespace-pre-line break-words">{m.texto ?? '[anexo]'}</p>
                        <p className={`text-[10px] mt-1 ${m.autor === 'bar' ? 'text-pink-100' : 'text-gray-400'}`}>
                          {fmtData(m.enviada_em)}
                          {m.categoria && (
                            <span className={`ml-2 px-1.5 rounded ${m.autor === 'bar' ? 'bg-pink-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                              {m.categoria}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); enviar(); }}
                  className="border-t border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center gap-2"
                >
                  <Input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Resposta..."
                    disabled={enviando}
                  />
                  <Button type="submit" disabled={enviando || !texto.trim()}>
                    <Send className="w-4 h-4 mr-2" /> Enviar
                  </Button>
                </form>
              </>
            )}
          </section>
        </div>
      </Card>
    </main>
  );
}
