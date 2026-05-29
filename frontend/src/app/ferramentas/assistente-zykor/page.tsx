'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, User as UserIcon, Send, Sparkles } from 'lucide-react';

type Msg = {
  autor: 'usuario' | 'bot';
  texto: string;
  bar_id?: number | null;
  ts: string;
};

const exemplos = [
  'Como foi sábado no Ordi?',
  'Qual a previsão pra próxima sexta?',
  'Tem cliente ouro dormindo no Deboche?',
  'Como tá o engagement do Instagram?',
  'Qual o quality score da semana?',
];

export default function AssistenteZykorPage() {
  const { user } = useUser();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      autor: 'bot',
      texto: 'Oi! Sou o Zykor Assistant. Pergunta o que você quer saber sobre os bares — vendas, IG, NPS, previsões. Posso falar do Ordi ou Deboche (você diz qual ou eu uso Ord como default).',
      ts: new Date().toISOString(),
    },
  ]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  }, [msgs]);

  const enviar = async (pergunta: string) => {
    const t = pergunta.trim();
    if (!t || enviando) return;
    const telefone = '5561998483434'; // socio whitelistado p/ assistente (Rodrigo)
    setMsgs(m => [...m, { autor: 'usuario', texto: t, ts: new Date().toISOString() }]);
    setTexto('');
    setEnviando(true);

    try {
      const r = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, mensagem: t }),
      });
      const j = await r.json();
      const resposta = j?.resposta || j?.error || 'Sem resposta';
      setMsgs(m => [...m, { autor: 'bot', texto: resposta, bar_id: j?.bar_id, ts: new Date().toISOString() }]);
    } catch (e: any) {
      setMsgs(m => [...m, { autor: 'bot', texto: 'Erro: ' + e?.message, ts: new Date().toISOString() }]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-pink-600" /> Zykor Assistant
        </h1>
        <p className="text-sm text-gray-500">
          IA que consulta dados reais dos bares em tempo real. Pergunta em pt-BR natural.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div ref={scrollRef} className="h-[500px] overflow-y-auto px-6 py-4 space-y-4 bg-gray-50 dark:bg-gray-900/40">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.autor === 'usuario' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                m.autor === 'usuario'
                  ? 'bg-pink-600 text-white'
                  : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
              }`}>
                {m.autor === 'usuario' ? <UserIcon className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`max-w-lg rounded-2xl px-4 py-2 ${
                m.autor === 'usuario'
                  ? 'bg-pink-600 text-white rounded-tr-sm'
                  : 'bg-white dark:bg-gray-800 shadow-sm rounded-tl-sm'
              }`}>
                <p className="text-sm whitespace-pre-line break-words leading-relaxed">{m.texto}</p>
                {m.bar_id && (
                  <p className={`text-[10px] mt-1 ${m.autor === 'usuario' ? 'text-pink-100' : 'text-gray-400'}`}>
                    Bar {m.bar_id === 3 ? 'Ordinário' : m.bar_id === 4 ? 'Deboche' : `id ${m.bar_id}`}
                  </p>
                )}
              </div>
            </div>
          ))}
          {enviando && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {msgs.length <= 1 && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <p className="text-xs text-gray-500 mb-2">Sugestões:</p>
            <div className="flex flex-wrap gap-2">
              {exemplos.map(ex => (
                <button
                  key={ex}
                  onClick={() => enviar(ex)}
                  className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-pink-100 dark:hover:bg-pink-900/30 px-3 py-1.5 rounded-full transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={e => { e.preventDefault(); enviar(texto); }}
          className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2 bg-white dark:bg-gray-900"
        >
          <Input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Pergunta o que quiser..."
            disabled={enviando}
            autoFocus
          />
          <Button type="submit" disabled={enviando || !texto.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        Modelo: Claude Sonnet 4.6 · Snapshot puxado em cada pergunta · Sem WhatsApp por enquanto, só web.
      </p>
    </main>
  );
}
