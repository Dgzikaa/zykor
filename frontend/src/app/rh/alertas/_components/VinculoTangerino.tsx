'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Link2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Pontas soltas entre o Zykor e o Tangerino, resolvidas AQUI.
 *
 * A sync do Tangerino descobre o bar da pessoa pelo nome do local de trabalho dela lá. Quem está
 * sem local atribuído não cai em bar nenhum e é ignorado sem erro: nunca vira ficha, nunca recebe
 * ponto. Antes, o conserto era entrar no Tangerino e arrumar o cadastro de lá.
 *
 * Esta seção mostra os dois lados soltos e deixa amarrar por aqui. Depois de amarrado, o local de
 * trabalho do Tangerino deixa de importar — só a criação de ficha nova depende dele.
 */

type Emp = {
  tangerino_employee_id: number; nome: string; cpf: string | null; sem_local: boolean;
};
type Sugestao = Emp & { confianca: 'cpf' | 'nome' };
type Ficha = { funcionario_id: number; nome: string; cpf: string | null; sugestao: Sugestao | null };
type Resposta = { sem_ficha: Emp[]; sem_vinculo: Ficha[] };

export function VinculoTangerino() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const { data, isLoading, mutate } = useApiSWR<Resposta>(selectedBar ? '/api/rh/tangerino/vinculo' : null);
  const [salvando, setSalvando] = useState<number | null>(null);

  const vincular = async (f: Ficha, emp: Emp) => {
    setSalvando(f.funcionario_id);
    try {
      const r: any = await api.post('/api/rh/tangerino/vinculo', {
        funcionario_id: f.funcionario_id, tangerino_employee_id: emp.tangerino_employee_id,
      });
      showToast({ type: 'success', title: 'Vinculado', message: r?.mensagem });
      mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não foi possível vincular', message: e?.message });
    } finally { setSalvando(null); }
  };

  if (isLoading || !data) return null;

  const semFicha = data.sem_ficha || [];
  const semVinculo = data.sem_vinculo || [];
  const comSugestao = semVinculo.filter((f) => f.sugestao);
  if (semFicha.length === 0 && semVinculo.length === 0) return null;

  return (
    <Card className="mb-4 border-amber-300 dark:border-amber-800">
      <CardContent className="py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold">Ligação com o Tangerino</h2>
        </div>

        {comSugestao.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Estas pessoas têm ficha aqui e existem no Tangerino, mas as duas não estão ligadas —
              por isso o ponto delas não entra. Ligar resolve sem precisar mexer no Tangerino.
            </p>
            {comSugestao.map((f) => (
              <div key={f.funcionario_id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{f.nome}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    no Tangerino: <strong>{f.sugestao!.nome}</strong>
                    {f.sugestao!.confianca === 'cpf'
                      ? <span className="text-emerald-600 dark:text-emerald-400"> · CPF confere</span>
                      : <span className="text-amber-600 dark:text-amber-400"> · só o nome bate, confira antes</span>}
                    {f.sugestao!.sem_local && ' · sem local de trabalho lá'}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={salvando === f.funcionario_id}
                  onClick={() => vincular(f, f.sugestao!)}>
                  {salvando === f.funcionario_id
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : <Link2 className="w-3.5 h-3.5 mr-1" />}
                  Vincular
                </Button>
              </div>
            ))}
          </div>
        )}

        {semFicha.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Estão ativos no Tangerino e não têm ficha em nenhum bar. Se for gente da casa,
              contrate na cadeira dela pelo organograma — o CPF faz a ligação sozinha depois.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {semFicha.map((e) => (
                <span key={e.tangerino_employee_id}
                  className="text-[11px] rounded-full border bg-background px-2 py-1">
                  {e.nome}{e.sem_local && <span className="text-muted-foreground"> · sem local lá</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {semVinculo.length > comSugestao.length && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {semVinculo.length - comSugestao.length} ficha(s) ativa(s) sem ligação e sem
            correspondente no Tangerino — é o esperado para PJ, que não bate ponto.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
