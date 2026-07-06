'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Play, Power } from 'lucide-react';
import { ALERT_SIGNALS, OPERADORES, getSignal, type Operador } from '@/lib/notifications/signals';
import { CANAIS, type Canal } from '@/lib/notifications/catalog';

type Sev = 'info' | 'sucesso' | 'alerta' | 'critico';
interface Condicao {
  id: string;
  signal_key: string;
  operador: Operador;
  limite: number | null;
  titulo: string | null;
  severidade: Sev;
  canais: Canal[];
  target_roles: string[];
  target_user_ids: string[];
  cooldown_horas: number;
  ativo: boolean;
}
interface UsuarioBar { auth_id: string; nome: string | null; email: string; role: string }

const ROLES = ['admin', 'financeiro', 'funcionario'];
const CANAIS_DISP = (Object.keys(CANAIS) as Canal[]).filter((c) => CANAIS[c].disponivel);
const SINAIS_OK = ALERT_SIGNALS.filter((s) => s.implementado);

export default function CondicoesTab() {
  const [condicoes, setCondicoes] = useState<Condicao[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);

  // form
  const [signalKey, setSignalKey] = useState(SINAIS_OK[0]?.key ?? '');
  const [operador, setOperador] = useState<Operador>('lt');
  const [limite, setLimite] = useState('');
  const [titulo, setTitulo] = useState('');
  const [severidade, setSeveridade] = useState<Sev>('alerta');
  const [canais, setCanais] = useState<Set<Canal>>(new Set(['in_app']));
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [userIds, setUserIds] = useState<Set<string>>(new Set());
  const [cooldown, setCooldown] = useState('12');

  const sig = getSignal(signalKey);

  const carregar = async () => {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([
        api.get('/api/configuracoes/notifications/condicoes'),
        api.get('/api/configuracoes/notifications/usuarios'),
      ]);
      if (c?.success) setCondicoes(c.data.condicoes ?? []);
      if (u?.success) setUsuarios(u.data.usuarios ?? []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    carregar();
  }, []);

  // ao trocar de sinal, ajusta operador padrão
  useEffect(() => {
    if (sig && !sig.operadores.includes(operador)) setOperador(sig.operadores[0]);
    if (sig) setSeveridade(sig.severidadeSugerida);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalKey]);

  const toggle = <T,>(s: Set<T>, v: T) => {
    const n = new Set(s);
    n.has(v) ? n.delete(v) : n.add(v);
    return n;
  };

  const semDestino = roles.size === 0 && userIds.size === 0;
  const limiteValido = !sig?.usaLimite || (limite !== '' && !isNaN(Number(limite)));

  const salvar = async () => {
    if (!sig) return;
    if (canais.size === 0) return toast.error('Escolha ao menos um canal.');
    if (semDestino) return toast.error('Escolha quem recebe (cargo ou pessoa).');
    if (!limiteValido) return toast.error('Informe o limite (número).');
    setSalvando(true);
    try {
      const res = await api.post('/api/configuracoes/notifications/condicoes', {
        signal_key: signalKey,
        operador,
        limite: sig.usaLimite ? Number(limite) : null,
        titulo: titulo.trim() || null,
        severidade,
        canais: [...canais],
        target_roles: [...roles],
        target_user_ids: [...userIds],
        cooldown_horas: Number(cooldown) || 12,
        ativo: true,
      });
      if (res?.success) {
        toast.success('Alerta criado!');
        setTitulo('');
        setLimite('');
        setRoles(new Set());
        setUserIds(new Set());
        setCanais(new Set(['in_app']));
        carregar();
      } else {
        toast.error(res?.error || 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const testar = async (id: string) => {
    setTestando(id);
    try {
      const res = await api.post(`/api/configuracoes/notifications/condicoes?action=testar&id=${id}`);
      const t = res?.data?.teste;
      if (res?.success) {
        toast.success(
          t?.disparadas > 0
            ? `Disparou! (${t.disparadas} alerta). Confira o sino/WhatsApp.`
            : 'Avaliado — a condição não bateu agora (nada disparado).'
        );
      } else toast.error(res?.error || 'Erro no teste');
    } catch {
      toast.error('Erro no teste');
    } finally {
      setTestando(null);
    }
  };

  const toggleAtivo = async (c: Condicao) => {
    await api.put(`/api/configuracoes/notifications/condicoes?id=${c.id}`, { ativo: !c.ativo });
    carregar();
  };
  const excluir = async (id: string) => {
    await api.delete(`/api/configuracoes/notifications/condicoes?id=${id}`);
    carregar();
  };

  const resumo = (c: Condicao) => {
    const s = getSignal(c.signal_key);
    const op = OPERADORES[c.operador]?.simbolo ?? c.operador;
    const lim = c.limite != null ? `${op} ${c.limite}${s?.unidade ? ' ' + s.unidade : ''}` : '';
    return `${s?.label ?? c.signal_key} ${lim}`.trim();
  };

  const nomeUser = (id: string) => {
    const u = usuarios.find((x) => x.auth_id === id);
    return u?.nome || u?.email || id.slice(0, 6);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Crie seus próprios alertas: escolha um <b>sinal</b> (o que medir), a <b>condição</b> (ex:
        faturamento &lt; R$ X), <b>quem recebe</b> e por quais <b>canais</b>. O Zykor avalia
        sozinho e dispara — inclusive no WhatsApp.
      </p>

      {/* Form novo alerta */}
      <Card>
        <CardContent className="py-5 space-y-4">
          <div className="font-medium flex items-center gap-2">
            <Plus className="w-4 h-4 text-green-600" /> Novo alerta
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Sinal (o que medir)</span>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={signalKey}
                onChange={(e) => setSignalKey(e.target.value)}
              >
                {SINAIS_OK.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">Condição</span>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={operador}
                  onChange={(e) => setOperador(e.target.value as Operador)}
                >
                  {(sig?.operadores ?? ['lt']).map((o) => (
                    <option key={o} value={o}>
                      {OPERADORES[o].simbolo} {OPERADORES[o].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">
                  Limite {sig?.unidade ? `(${sig.unidade})` : ''}
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={sig?.usaLimite ? 'ex: 5000' : 'automático'}
                  value={limite}
                  disabled={!sig?.usaLimite}
                  onChange={(e) => setLimite(e.target.value.replace(',', '.'))}
                />
              </label>
            </div>
          </div>

          {sig && <p className="text-xs text-muted-foreground">{sig.descricao}</p>}

          <label className="text-sm space-y-1 block">
            <span className="text-muted-foreground">Título (opcional)</span>
            <Input
              placeholder={sig?.label ?? 'Título do alerta'}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </label>

          {/* Canais */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Canais</div>
            <div className="flex flex-wrap gap-1.5">
              {CANAIS_DISP.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCanais((s) => toggle(s, c))}
                  className={`px-2.5 py-1 rounded-full text-xs border ${
                    canais.has(c)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-background text-muted-foreground'
                  }`}
                >
                  {CANAIS[c].emoji} {CANAIS[c].label}
                </button>
              ))}
            </div>
          </div>

          {/* Quem recebe: cargos + pessoas */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Cargos</div>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoles((s) => toggle(s, r))}
                    className={`px-2.5 py-1 rounded-full text-xs border capitalize ${
                      roles.has(r) ? 'bg-purple-600 text-white border-purple-600' : 'bg-background text-muted-foreground'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Pessoas específicas
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-auto">
                {usuarios.map((u) => (
                  <button
                    key={u.auth_id}
                    type="button"
                    onClick={() => setUserIds((s) => toggle(s, u.auth_id))}
                    className={`px-2.5 py-1 rounded-full text-xs border ${
                      userIds.has(u.auth_id) ? 'bg-green-600 text-white border-green-600' : 'bg-background text-muted-foreground'
                    }`}
                  >
                    {u.nome || u.email}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm flex items-center gap-2">
              <span className="text-muted-foreground">Severidade</span>
              <select
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={severidade}
                onChange={(e) => setSeveridade(e.target.value as Sev)}
              >
                <option value="info">Info</option>
                <option value="sucesso">Sucesso</option>
                <option value="alerta">Alerta</option>
                <option value="critico">Crítico</option>
              </select>
            </label>
            <label className="text-sm flex items-center gap-2">
              <span className="text-muted-foreground">Não repetir por (h)</span>
              <Input
                type="text"
                inputMode="numeric"
                className="w-16 h-8"
                value={cooldown}
                onChange={(e) => setCooldown(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <div className="flex-1" />
            <Button onClick={salvar} disabled={salvando} size="sm">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="ml-1">Criar alerta</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de alertas */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Meus alertas ({condicoes.length})</div>
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto animate-spin" />
            </CardContent>
          </Card>
        ) : condicoes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum alerta criado ainda. Monte o primeiro acima.
            </CardContent>
          </Card>
        ) : (
          condicoes.map((c) => (
            <Card key={c.id} className={c.ativo ? '' : 'opacity-60'}>
              <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{c.titulo || resumo(c)}</div>
                  <div className="text-xs text-muted-foreground">
                    {resumo(c)} · {c.canais.join(', ')} ·{' '}
                    {[...c.target_roles, ...c.target_user_ids.map(nomeUser)].join(', ') || 'sem destino'}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => testar(c.id)} disabled={testando === c.id} title="Testar agora">
                  {testando === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleAtivo(c)} title={c.ativo ? 'Desativar' : 'Ativar'}>
                  <Power className={`w-4 h-4 ${c.ativo ? 'text-green-600' : 'text-gray-400'}`} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => excluir(c.id)} title="Excluir">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {SINAIS_OK.length < ALERT_SIGNALS.length && (
        <p className="text-xs text-muted-foreground border-t pt-3">
          🔜 Em breve mais sinais:{' '}
          {ALERT_SIGNALS.filter((s) => !s.implementado).map((s) => s.label).join(', ')}.
        </p>
      )}
    </div>
  );
}
