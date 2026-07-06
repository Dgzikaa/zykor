'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Send, Check, Users } from 'lucide-react';

type Canal = 'in_app' | 'push' | 'whatsapp';
type Role = 'admin' | 'financeiro' | 'funcionario';
type Severidade = 'info' | 'sucesso' | 'alerta' | 'critico';

interface UsuarioBar {
  auth_id: string;
  nome: string | null;
  email: string;
  role: string;
}

const ROLES: { key: Role; label: string }[] = [
  { key: 'admin', label: 'Admin' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'funcionario', label: 'Funcionário' },
];
const SEVERIDADES: { key: Severidade; label: string; emoji: string }[] = [
  { key: 'info', label: 'Info', emoji: 'ℹ️' },
  { key: 'sucesso', label: 'Boa notícia', emoji: '✅' },
  { key: 'alerta', label: 'Atenção', emoji: '⚠️' },
  { key: 'critico', label: 'Urgente', emoji: '🚨' },
];

export default function EnviarTab() {
  const [usuarios, setUsuarios] = useState<UsuarioBar[]>([]);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [url, setUrl] = useState('');
  const [severidade, setSeveridade] = useState<Severidade>('info');
  const [roles, setRoles] = useState<Set<Role>>(new Set());
  const [userIds, setUserIds] = useState<Set<string>>(new Set());
  const [canais, setCanais] = useState<Set<Canal>>(new Set(['in_app']));
  const [showUsers, setShowUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/configuracoes/notifications/usuarios').then((u) => {
      if (u?.success) setUsuarios(u.data.usuarios ?? []);
    });
  }, []);

  const toggle = <T,>(set: Set<T>, val: T): Set<T> => {
    const n = new Set(set);
    if (n.has(val)) n.delete(val);
    else n.add(val);
    return n;
  };

  const podeEnviar =
    titulo.trim().length > 0 &&
    mensagem.trim().length > 0 &&
    (roles.size > 0 || userIds.size > 0) &&
    canais.size > 0;

  const enviar = async () => {
    setSending(true);
    setResultado(null);
    try {
      const res = await api.post('/api/configuracoes/notifications/enviar', {
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        url: url.trim() || undefined,
        severidade,
        roles: [...roles],
        user_ids: [...userIds],
        canais: [...canais],
      });
      if (res?.success) {
        const d = res.data;
        setResultado(
          `Enviado para ${d.destinatarios} pessoa(s)` +
            (d.push?.enviados ? ` · ${d.push.enviados} push` : '')
        );
        setTitulo('');
        setMensagem('');
        setUrl('');
        setRoles(new Set());
        setUserIds(new Set());
      } else {
        setResultado(res?.error ?? 'Falha ao enviar');
      }
    } catch (e) {
      setResultado(e instanceof Error ? e.message : 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Mande um recado direto para a equipe (reunião, comunicado, aviso). Aparece na hora na
          Central de quem você escolher.
        </p>

        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Reunião de equipe amanhã"
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Mensagem</Label>
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Escreva o recado..."
            rows={3}
            maxLength={1000}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <div className="flex flex-wrap gap-1.5">
            {SEVERIDADES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSeveridade(s.key)}
                className={pill(severidade === s.key)}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Para quais cargos</Label>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRoles((s) => toggle(s, r.key))}
                className={pill(roles.has(r.key))}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-muted-foreground"
            onClick={() => setShowUsers((v) => !v)}
          >
            <Users className="w-3.5 h-3.5" /> Pessoas específicas
            {userIds.size > 0 && ` (${userIds.size})`}
          </button>
          {showUsers && (
            <div className="max-h-40 overflow-y-auto rounded border border-gray-100 dark:border-gray-700/50 p-2 space-y-1">
              {usuarios.map((u) => (
                <label
                  key={u.auth_id}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={userIds.has(u.auth_id)}
                    onChange={() => setUserIds((s) => toggle(s, u.auth_id))}
                  />
                  <span className="truncate">
                    {u.nome || u.email}
                    <span className="text-muted-foreground"> · {u.role}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Canais</Label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCanais((s) => toggle(s, 'in_app'))}
              className={pill(canais.has('in_app'))}
            >
              🔔 No Zykor
            </button>
            <button
              type="button"
              onClick={() => setCanais((s) => toggle(s, 'push'))}
              className={pill(canais.has('push'))}
            >
              📱 Push
            </button>
            <button
              type="button"
              onClick={() => setCanais((s) => toggle(s, 'whatsapp'))}
              className={pill(canais.has('whatsapp'))}
            >
              💬 WhatsApp
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Link ao clicar (opcional)</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/operacional/checklists"
            maxLength={500}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          {resultado ? (
            <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check className="w-4 h-4" /> {resultado}
            </span>
          ) : (
            <span />
          )}
          <Button onClick={enviar} disabled={!podeEnviar || sending} className="gap-1.5">
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar aviso
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function pill(active: boolean): string {
  return `text-xs px-2.5 py-1 rounded-full border transition-colors ${
    active
      ? 'bg-blue-500 text-white border-blue-500'
      : 'bg-transparent text-muted-foreground border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`;
}
