'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { CANAIS } from '@/lib/notifications/catalog';

type Canal = 'in_app' | 'push' | 'whatsapp';
type Role = 'admin' | 'financeiro' | 'funcionario';

interface EventoCat {
  key: string;
  label: string;
  descricao: string;
  categoria: string;
  severidadePadrao: string;
  canaisSuportados: Canal[];
}
interface Grupo {
  categoria: string;
  label: string;
  emoji: string;
  eventos: EventoCat[];
}
interface Regra {
  event_key: string;
  ativo: boolean;
  target_roles: Role[];
  target_user_ids: string[];
  canais: Canal[];
}
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
const CANAL_LABEL: Record<Canal, string> = {
  in_app: '🔔 No Zykor',
  push: '📱 Push',
  whatsapp: '💬 WhatsApp',
};

export default function RegrasTab() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [regras, setRegras] = useState<Record<string, Regra>>({});
  const [usuarios, setUsuarios] = useState<UsuarioBar[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [r, u] = await Promise.all([
        api.get('/api/configuracoes/notifications/rules'),
        api.get('/api/configuracoes/notifications/usuarios'),
      ]);
      if (r?.success) {
        setGrupos(r.data.grupos ?? []);
        setRegras((r.data.regras ?? {}) as Record<string, Regra>);
      }
      if (u?.success) setUsuarios(u.data.usuarios ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando regras...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Escolha, para cada evento do sistema, <b>quem recebe</b> (por cargo e/ou pessoas específicas)
        e <b>por onde</b>. Eventos desligados não notificam ninguém.
      </p>
      {grupos.map((g) => (
        <div key={g.categoria} className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {g.emoji} {g.label}
          </h3>
          <div className="space-y-2">
            {g.eventos.map((ev) => (
              <EventoRegra
                key={ev.key}
                evento={ev}
                regra={regras[ev.key]}
                usuarios={usuarios}
                onSaved={(nova) => setRegras((prev) => ({ ...prev, [ev.key]: nova }))}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventoRegra({
  evento,
  regra,
  usuarios,
  onSaved,
}: {
  evento: EventoCat;
  regra?: Regra;
  usuarios: UsuarioBar[];
  onSaved: (r: Regra) => void;
}) {
  const [ativo, setAtivo] = useState(regra?.ativo ?? false);
  const [roles, setRoles] = useState<Set<Role>>(new Set(regra?.target_roles ?? []));
  const [userIds, setUserIds] = useState<Set<string>>(new Set(regra?.target_user_ids ?? []));
  const [canais, setCanais] = useState<Set<Canal>>(
    new Set(regra?.canais ?? (['in_app'] as Canal[]))
  );
  const [showUsers, setShowUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);

  const toggle = <T,>(set: Set<T>, val: T): Set<T> => {
    const n = new Set(set);
    if (n.has(val)) n.delete(val);
    else n.add(val);
    return n;
  };

  const salvar = async () => {
    setSaving(true);
    setSavedAt(false);
    try {
      const res = await api.put('/api/configuracoes/notifications/rules', {
        event_key: evento.key,
        ativo,
        target_roles: [...roles],
        target_user_ids: [...userIds],
        canais: [...canais].filter((c) => evento.canaisSuportados.includes(c)),
      });
      if (res?.success) {
        onSaved(res.data as Regra);
        setSavedAt(true);
        setTimeout(() => setSavedAt(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const semDestino = ativo && roles.size === 0 && userIds.size === 0;

  return (
    <Card>
      <CardContent className="py-3 px-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{evento.label}</span>
              {!ativo && (
                <Badge variant="outline" className="text-[10px] py-0">
                  desligado
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{evento.descricao}</p>
          </div>
          <Switch checked={ativo} onCheckedChange={setAtivo} />
        </div>

        {ativo && (
          <div className="space-y-3 pt-1 border-t border-gray-100 dark:border-gray-700/50">
            {/* Cargos */}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Cargos
              </div>
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

            {/* Usuários específicos */}
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground mb-1"
                onClick={() => setShowUsers((v) => !v)}
              >
                {showUsers ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <Users className="w-3 h-3" /> Pessoas específicas
                {userIds.size > 0 && (
                  <Badge variant="secondary" className="text-[10px] py-0 ml-1">
                    {userIds.size}
                  </Badge>
                )}
              </button>
              {showUsers && (
                <div className="max-h-40 overflow-y-auto rounded border border-gray-100 dark:border-gray-700/50 p-2 space-y-1">
                  {usuarios.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum usuário no bar.</p>
                  )}
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

            {/* Canais */}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Canais
              </div>
              <div className="flex flex-wrap gap-1.5">
                {evento.canaisSuportados.map((c) => {
                  const indisponivel = CANAIS[c]?.disponivel === false;
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={indisponivel}
                      onClick={() => !indisponivel && setCanais((s) => toggle(s, c))}
                      className={`${pill(canais.has(c))} ${
                        indisponivel ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                      title={indisponivel ? 'Em breve' : undefined}
                    >
                      {CANAL_LABEL[c]}
                      {indisponivel && ' (em breve)'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              {semDestino ? (
                <span className="text-[11px] text-amber-600 dark:text-amber-400">
                  Selecione um cargo ou pessoa.
                </span>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                {savedAt && (
                  <span className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Salvo
                  </span>
                )}
                <Button size="sm" onClick={salvar} disabled={saving || canais.size === 0}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {!ativo && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        )}
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
