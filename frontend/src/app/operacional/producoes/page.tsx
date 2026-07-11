'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api-client';
import { Timer, Play, History, Gauge, Users, UtensilsCrossed } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { usePageTitle } from '@/contexts/PageTitleContext';

import { MOD_CONTROLE_PRODUCAO, MOD_GERIR_EQUIPE, type Secao } from './_shared';
import { AbaExecutar } from './AbaExecutar';
import { AbaHistorico } from './AbaHistorico';
import { AbaAnalise } from './AbaAnalise';
import { AbaAlimentacao } from './AbaAlimentacao';
import { GerirEquipeModal } from './GerirEquipeModal';

// =====================================================================================
// PÁGINA
// =====================================================================================
export default function ProducoesPage() {
  const { selectedBar } = useBar();
  const { hasPermission, can } = useAuth();
  // Editar/excluir execução seguem o MÓDULO (config do usuário), não o role. Admin sempre pode.
  const podeEditarProducao = can(MOD_CONTROLE_PRODUCAO, 'editar');
  const podeExcluirProducao = can(MOD_CONTROLE_PRODUCAO, 'excluir');
  // "Gerir equipe" agora é permissão granular por módulo (não mais admin-only): quem tiver
  // Inserir e/ou Editar no módulo "Gerir Equipe (Responsáveis)" abre o modal. As ações dentro
  // dele (add/editar/remover) são gateadas 1 a 1 — espelhando o guard do backend. Admin sempre pode.
  const podeGerirInserir = can(MOD_GERIR_EQUIPE, 'inserir');
  const podeGerirEditar = can(MOD_GERIR_EQUIPE, 'editar');
  const podeGerirExcluir = can(MOD_GERIR_EQUIPE, 'excluir');
  const podeGerirEquipe = podeGerirInserir || podeGerirEditar || podeGerirExcluir;
  const barId = selectedBar?.id;
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('⏱️ Controle da Produção'); return () => setPageTitle(''); }, [setPageTitle]);
  const [aba, setAba] = useState<'executar' | 'historico' | 'analise' | 'alimentacao'>('executar');
  const [fichas, setFichas] = useState<any[]>([]);
  const [responsaveis, setResponsaveis] = useState<any[]>([]);
  const [gerirEquipe, setGerirEquipe] = useState(false);

  // Trava de seção por acesso (resolver único): quem tem SÓ 'producao_bar' vê só Bar,
  // quem tem SÓ 'producao_cozinha' vê só Cozinha. Admin ('todos') e quem tem ambos/nenhum
  // veem as duas abas. producaobar@ / producaocozinha@ recebem o token no modulos_permitidos.
  const podeBar = hasPermission('producao_bar');
  const podeCozinha = hasPermission('producao_cozinha');
  const secaoTravada: Secao | null = podeBar && !podeCozinha ? 'Bar' : podeCozinha && !podeBar ? 'Cozinha' : null;
  const secoesVisiveis: Secao[] = secaoTravada ? [secaoTravada] : ['Cozinha', 'Bar'];
  const [secaoAtiva, setSecaoAtiva] = useState<Secao>('Cozinha');
  // quando a trava resolve (user carrega assíncrono), força a seção permitida
  useEffect(() => { if (secaoTravada) setSecaoAtiva(secaoTravada); }, [secaoTravada]);

  const loadFichas = useCallback(async () => {
    if (!barId) return;
    const r = await api.get(`/api/operacional/producoes?bar_id=${barId}`);
    if (r.success) setFichas(r.producoes || []);
  }, [barId]);
  const loadResponsaveis = useCallback(async () => {
    if (!barId) return;
    const r = await api.get(`/api/operacional/pessoas-responsaveis?bar_id=${barId}`);
    if (r.success) setResponsaveis(r.data || []);
  }, [barId]);
  useEffect(() => { loadFichas(); loadResponsaveis(); }, [loadFichas, loadResponsaveis]);

  return (
    <PageShell width="wide">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl"><Timer className="w-6 h-6 text-orange-600 dark:text-orange-400" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Execução com cronômetro (várias em paralelo), aderência à ficha e controle de tempo, custo e insumos</p>
            </div>
          </div>
          {podeGerirEquipe && (
            <Button variant="outline" onClick={() => setGerirEquipe(true)} className="gap-1.5 shrink-0">
              <Users className="w-4 h-4" />Gerir equipe
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setAba('executar')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'executar' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><Play className="w-4 h-4" />Executar</button>
            <button onClick={() => setAba('historico')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'historico' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><History className="w-4 h-4" />Histórico</button>
            <button onClick={() => setAba('analise')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'analise' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><Gauge className="w-4 h-4" />Análise</button>
            <button onClick={() => setAba('alimentacao')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'alimentacao' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><UtensilsCrossed className="w-4 h-4" />Alimentação</button>
          </div>
          {/* Seletor de seção: Cozinha / Bar. Travado quando o usuário só tem acesso a uma. Não se aplica à Alimentação (é do bar todo). */}
          <div className={`inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-muted/30 ${aba === 'alimentacao' ? 'invisible' : ''}`}>
            {secoesVisiveis.map(s => (
              <button key={s} onClick={() => setSecaoAtiva(s)}
                className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${secaoAtiva === s ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}>
                {s === 'Cozinha' ? '👨‍🍳' : '🍺'} {s}
              </button>
            ))}
          </div>
        </div>

        {aba === 'executar'
          ? <AbaExecutar fichas={fichas} responsaveis={responsaveis} secaoAtiva={secaoAtiva} />
          : aba === 'historico'
          ? <AbaHistorico fichas={fichas} responsaveis={responsaveis} secaoAtiva={secaoAtiva} podeEditar={podeEditarProducao} podeExcluir={podeExcluirProducao} />
          : aba === 'analise'
          ? <AbaAnalise secaoAtiva={secaoAtiva} />
          : <AbaAlimentacao responsaveis={responsaveis} podeExcluir={podeExcluirProducao} />}

        {gerirEquipe && podeGerirEquipe && barId && (
          <GerirEquipeModal
            barId={barId}
            responsaveis={responsaveis}
            podeInserir={podeGerirInserir}
            podeEditar={podeGerirEditar}
            podeExcluir={podeGerirExcluir}
            onClose={() => setGerirEquipe(false)}
            onChanged={loadResponsaveis}
          />
        )}
    </PageShell>
  );
}
