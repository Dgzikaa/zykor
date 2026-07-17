'use client';

/**
 * Gestão de perfis de acesso (RBAC — Fase 2).
 *
 * Lista perfis + dialog de edição com matriz de módulos (mesmos módulos derivados
 * do MENU_TREE). Perfil `sistema=true` (Admin) só leitura.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageShell } from '@/components/layout/PageShell';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api-client';
import { Shield, Plus, Pencil, Trash2, Users, Lock, Loader2, Check } from 'lucide-react';
import { getModulosPorCategoria } from '@/lib/permissions/modules';

type Perfil = {
  id: string;
  nome: string;
  descricao: string | null;
  modulos: string[];
  sistema: boolean;
  users_count: number;
  criado_em?: string;
  atualizado_em?: string;
};

export default function PerfisPage() {
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  useEffect(() => { setPageTitle('🛡️ Perfis de Acesso'); return () => setPageTitle(''); }, [setPageTitle]);

  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogAberto, setDialogAberto] = useState<false | { modo: 'novo' | 'editar'; perfil?: Perfil }>(false);
  const [confirmandoDel, setConfirmandoDel] = useState<Perfil | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/configuracoes/perfis');
      setPerfis(r.perfis || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar perfis', description: e?.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { carregar(); }, [carregar]);

  const excluir = async (p: Perfil) => {
    try {
      await api.delete(`/api/configuracoes/perfis?id=${encodeURIComponent(p.id)}`);
      toast({ title: 'Perfil removido' });
      setConfirmandoDel(null);
      await carregar();
    } catch (e: any) {
      toast({ title: 'Não foi possível remover', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <PageShell width="wide">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl"><Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Perfis de Acesso</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Perfis reutilizáveis — mudanças aqui refletem em todos os usuários vinculados.
          </p>
        </div>
        <Button onClick={() => setDialogAberto({ modo: 'novo' })}>
          <Plus className="w-4 h-4 mr-1.5" />Novo perfil
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : perfis.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Nenhum perfil cadastrado.</CardContent></Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {perfis.map(p => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold truncate">{p.nome}</h3>
                      {p.sistema && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300">
                          <Lock className="w-2.5 h-2.5" />Sistema
                        </span>
                      )}
                    </div>
                    {p.descricao && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button size="sm" variant="ghost" onClick={() => setDialogAberto({ modo: 'editar', perfil: p })} title={p.sistema ? 'Só leitura' : 'Editar'}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {!p.sistema && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmandoDel(p)} title="Remover">
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t">
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{p.users_count} usuário{p.users_count === 1 ? '' : 's'}</span>
                  <span>·</span>
                  <span>{p.modulos.includes('todos') ? 'todos os módulos' : `${p.modulos.length} módulo${p.modulos.length === 1 ? '' : 's'}`}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialogAberto && (
        <EditarPerfilDialog
          modo={dialogAberto.modo}
          perfilExistente={dialogAberto.perfil}
          onFechar={() => setDialogAberto(false)}
          onSalvo={async () => { setDialogAberto(false); await carregar(); }}
        />
      )}

      {confirmandoDel && (
        <Dialog open onOpenChange={(v) => { if (!v) setConfirmandoDel(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Remover perfil?</DialogTitle>
              <DialogDescription>
                Você vai remover o perfil <b>{confirmandoDel.nome}</b>. Só é possível remover perfis sem usuários vinculados.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmandoDel(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => excluir(confirmandoDel)}>Remover</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog de edição — matriz de módulos agrupada por categoria
// ─────────────────────────────────────────────────────────────────────────────

function EditarPerfilDialog({
  modo, perfilExistente, onFechar, onSalvo,
}: {
  modo: 'novo' | 'editar';
  perfilExistente?: Perfil;
  onFechar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const { toast } = useToast();
  const soLeitura = !!perfilExistente?.sistema;

  const [nome, setNome] = useState(perfilExistente?.nome || '');
  const [descricao, setDescricao] = useState(perfilExistente?.descricao || '');
  const [modulos, setModulos] = useState<Set<string>>(new Set(perfilExistente?.modulos || []));
  const [salvando, setSalvando] = useState(false);

  const modulosPorCategoria = useMemo(() => getModulosPorCategoria(), []);
  const temTodos = modulos.has('todos');

  const toggleModulo = (id: string) => {
    if (soLeitura) return;
    setModulos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCategoria = (ids: string[], marcar: boolean) => {
    if (soLeitura) return;
    setModulos(prev => {
      const next = new Set(prev);
      if (marcar) ids.forEach(id => next.add(id));
      else ids.forEach(id => next.delete(id));
      return next;
    });
  };

  const podeSalvar = !soLeitura && nome.trim().length > 0;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const payload = { nome: nome.trim(), descricao: descricao.trim() || null, modulos: Array.from(modulos) };
      if (modo === 'editar' && perfilExistente) {
        await api.put('/api/configuracoes/perfis', { id: perfilExistente.id, ...payload });
        toast({ title: 'Perfil atualizado' });
      } else {
        await api.post('/api/configuracoes/perfis', payload);
        toast({ title: 'Perfil criado' });
      }
      await onSalvo();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !salvando) onFechar(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {soLeitura ? `${perfilExistente!.nome} (sistema — só leitura)` : (modo === 'editar' ? 'Editar perfil' : 'Novo perfil')}
          </DialogTitle>
          <DialogDescription>
            {soLeitura
              ? 'Perfil de sistema não pode ser editado. Ele concede acesso a todos os módulos automaticamente.'
              : 'Selecione os módulos que os usuários deste perfil terão acesso.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input value={nome} onChange={e => setNome(e.target.value)} disabled={soLeitura} placeholder="Ex.: Operação" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} disabled={soLeitura} placeholder="Ex.: Time operacional do bar" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Acesso por módulo</span>
              <span className="text-[11px] text-muted-foreground">
                {temTodos ? 'Todos os módulos (bypass)' : `${modulos.size} módulo(s) selecionado(s)`}
              </span>
            </div>
            <div className={`rounded-lg p-3 border max-h-[400px] overflow-y-auto ${soLeitura || temTodos ? 'opacity-60 pointer-events-none' : ''}`}>
              {temTodos && (
                <div className="mb-3 p-2 rounded-md bg-purple-100 dark:bg-purple-900/25 text-xs text-purple-800 dark:text-purple-200">
                  Este perfil tem o marcador <b>todos</b> — concede acesso a qualquer módulo automaticamente.
                </div>
              )}
              {Object.entries(modulosPorCategoria).map(([categoria, mods]) => {
                const ids = mods.map(m => m.id);
                const marcados = ids.filter(id => modulos.has(id)).length;
                const todosMarcados = marcados === ids.length;
                return (
                  <div key={categoria} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1.5 border-b pb-1">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{categoria}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{marcados}/{ids.length}</span>
                        <Checkbox
                          checked={todosMarcados}
                          onCheckedChange={(c) => toggleCategoria(ids, c as boolean)}
                          disabled={soLeitura || temTodos}
                        />
                        <span className="text-[11px] text-muted-foreground">Todos</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {mods.map(m => (
                        <label key={m.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-xs">
                          <Checkbox
                            checked={modulos.has(m.id)}
                            onCheckedChange={() => toggleModulo(m.id)}
                            disabled={soLeitura || temTodos}
                          />
                          <span className="truncate">{m.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>{soLeitura ? 'Fechar' : 'Cancelar'}</Button>
          {!soLeitura && (
            <Button onClick={salvar} disabled={!podeSalvar || salvando}>
              {salvando ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Salvando...</> : <><Check className="w-4 h-4 mr-1.5" />Salvar</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
