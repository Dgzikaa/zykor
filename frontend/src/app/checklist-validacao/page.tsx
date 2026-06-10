'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Save, AlertCircle, ExternalLink } from 'lucide-react';

interface Teste {
  id: string;
  titulo: string;
  o_que_fazer: string;
  o_que_esperar: string;
  link?: string;
  pergunta_assistente?: string;
}

interface Area {
  area: string;
  emoji: string;
  testes: Teste[];
}

const CHECKLIST: Area[] = [
  {
    area: 'Vendas e Operação',
    emoji: '💰',
    testes: [
      {
        id: 'v1', titulo: 'Faturamento da semana bate?',
        o_que_fazer: 'Abre Desempenho, vê faturamento da semana atual no Ordi.',
        o_que_esperar: 'Número parece com o que você sabe da semana. Variação vs anterior faz sentido.',
        link: '/estrategico/desempenho',
      },
      {
        id: 'v2', titulo: 'Mapa de calor faz sentido?',
        o_que_fazer: 'Abre Mapa de Calor Vendas (Estratégico).',
        o_que_esperar: 'Sexta+Sábado entre 20h-23h são as células mais escuras. Madrugada (24-26h) bem mais clara.',
        link: '/estrategico/heatmap-vendas',
      },
      {
        id: 'v3', titulo: 'Performance garçom: você conhece quem aparece?',
        o_que_fazer: 'Abre Performance Garçom, olha o ranking.',
        o_que_esperar: 'Top 5 deve ser conhecido seu. Quem aparece com 0% upsell ou 95% deve te chamar atenção.',
        link: '/estrategico/garcons',
      },
      {
        id: 'v4', titulo: 'Combos surpreendem ou confirmam?',
        o_que_fazer: 'Abre Combos que Convertem. Filtra um produto popular tipo "Chopp" ou "Feijoada Sábado".',
        o_que_esperar: 'Top 3 sugeridos faz sentido pra você. Algum surpreende?',
        link: '/estrategico/combos',
      },
    ],
  },
  {
    area: 'Clube Ordi',
    emoji: '👑',
    testes: [
      {
        id: 'c1', titulo: 'Distribuição de níveis parece certa?',
        o_que_fazer: 'Abre Clube Ordi. Vê total Diamante/Ouro/Prata/Bronze.',
        o_que_esperar: 'Ord ~25 diamante / ~327 ouro. Deb ~4 dia / ~15 ouro. Algum exagerado?',
        link: '/analitico/clientes/clube',
      },
      {
        id: 'c2', titulo: 'Top diamantes são clientes que você reconhece?',
        o_que_fazer: 'Filtra diamante. Olha top 10 por gasto.',
        o_que_esperar: 'Você sabe quem são. Se aparece um nome estranho, anota.',
        link: '/analitico/clientes/clube',
      },
      {
        id: 'c3', titulo: 'Clientes em queda — você confirma que tão sumindo?',
        o_que_fazer: 'Abre Em queda. Vê top 5 com maior score de risco.',
        o_que_esperar: 'Pelo menos 2-3 desses você sabe que sumiu mesmo. Os que não estão em risco real são falsos positivos.',
        link: '/analitico/clientes/em-queda',
      },
      {
        id: 'c4', titulo: 'No-show reincidentes: blacklist?',
        o_que_fazer: 'Abre No-Show. Olha quem tem >5 faltas.',
        o_que_esperar: 'Decidir: a recepção bloqueia esses ou cobra antecipado.',
        link: '/analitico/clientes/no-show',
      },
    ],
  },
  {
    area: 'Instagram',
    emoji: '📱',
    testes: [
      {
        id: 'ig1', titulo: 'Reels mostra os últimos 365d?',
        o_que_fazer: 'Abre Reels, seletor em 365d.',
        o_que_esperar: 'Vê ~85 reels Ord. Top por views faz sentido.',
        link: '/marketing/instagram/reels',
      },
      {
        id: 'ig2', titulo: 'IG ROI por post — algum post movimentou caixa?',
        o_que_fazer: 'Abre IG ROI. Ordena por maior impacto.',
        o_que_esperar: 'Top 3 posts mexeram +100% vs baseline. Você confirma que aquele evento bombou mesmo?',
        link: '/marketing/instagram/ig-roi',
      },
      {
        id: 'ig3', titulo: 'Demografia bate com o público real?',
        o_que_fazer: 'Abre Demografia. Vê pie de gênero e top cidades.',
        o_que_esperar: 'Ord 60%+ feminino, Brasília no topo. Bate com sua percepção?',
        link: '/marketing/instagram/demografia',
      },
    ],
  },
  {
    area: 'Auditoria/Integridade',
    emoji: '🛡️',
    testes: [
      {
        id: 'a1', titulo: 'Alertas de fraude — você conhece esses funcionários?',
        o_que_fazer: 'Abre Integridade. Filtra alertas críticos.',
        o_que_esperar: 'Erika NÃO deve aparecer (whitelist). Garçons com taxa real anormal devem.',
        link: '/estrategico/integridade',
      },
      {
        id: 'a2', titulo: 'Quality Scorecard mudou com NPS real?',
        o_que_fazer: 'Abre Quality. Vê semana 21-22.',
        o_que_esperar: 'NPS Digital agora aparece (não mais NPS Geral). Deb caiu pra 76-78 em S20-21.',
        link: '/estrategico/qualidade',
      },
      {
        id: 'a3', titulo: 'Previsão demanda — Corpus Christi tá rebaixada?',
        o_que_fazer: 'Abre Previsão Demanda.',
        o_que_esperar: 'Qui 04/06 (Corpus) com ajuste 0.55x. Sexta 05/06 (emenda) ajuste 0.50x.',
        link: '/estrategico/previsao',
      },
      {
        id: 'a4', titulo: 'Fluxo de Caixa 90d — cenário base faz sentido?',
        o_que_fazer: 'Abre Fluxo Caixa 90d. Vê saldo acumulado.',
        o_que_esperar: 'Saldo base cresce mês a mês. Pessimista pode ficar negativo.',
        link: '/financeiro/fluxo-caixa-90d',
      },
    ],
  },
  {
    area: 'Assistente IA — perguntas reais',
    emoji: '🤖',
    testes: [
      {
        id: 'ia1', titulo: 'Pergunta simples de venda',
        o_que_fazer: 'Pergunta ao assistente: "Quanto faturamos no Ordi semana passada?"',
        o_que_esperar: 'Resposta com número, breakdown por dia, talvez insight sobre sexta/sábado.',
        link: '/assistente-zykor',
        pergunta_assistente: 'Quanto faturamos no Ordi semana passada?',
      },
      {
        id: 'ia2', titulo: 'Pergunta cruzada',
        o_que_fazer: 'Pergunta: "Quais clientes diamante tô prestes a perder?"',
        o_que_esperar: 'IA chama clientes_em_queda e te dá top 3 com nome + dias inativo + valor anual em risco.',
        link: '/assistente-zykor',
        pergunta_assistente: 'Quais clientes diamante tô prestes a perder no Ordi?',
      },
      {
        id: 'ia3', titulo: 'Pergunta sobre operação',
        o_que_fazer: 'Pergunta: "Qual garçom do Ordi vende mais e qual dá mais desconto?"',
        o_que_esperar: 'IA chama garcom_performance e cita 2-3 nomes com números reais.',
        link: '/assistente-zykor',
        pergunta_assistente: 'Qual garçom do Ordi vende mais e qual da mais desconto?',
      },
      {
        id: 'ia4', titulo: 'Pergunta de futuro',
        o_que_fazer: 'Pergunta: "Vai bombar essa sexta?"',
        o_que_esperar: 'IA chama previsao_demanda e responde com número previsto.',
        link: '/assistente-zykor',
        pergunta_assistente: 'Vai bombar essa sexta no Ordi?',
      },
    ],
  },
  {
    area: 'Quick wins novos',
    emoji: '⚡',
    testes: [
      {
        id: 'q1', titulo: 'Aniversariantes da semana — equipe acionou?',
        o_que_fazer: 'Abre Aniversariantes. Vê quem faz aniver em 7d.',
        o_que_esperar: 'Você decide: passa lista pra recepção mandar mensagem? Ou ignora?',
        link: '/analitico/clientes/aniversariantes',
      },
      {
        id: 'q2', titulo: 'Conciliação pagamentos — alguma quebra real?',
        o_que_fazer: 'Abre Conciliação. Olha quedas críticas e picos.',
        o_que_esperar: 'Se aparecer queda crítica, conferir adquirente naquele dia.',
        link: '/financeiro/conciliacao-pagamentos',
      },
      {
        id: 'q3', titulo: 'Relatório semanal IA — leu tudo?',
        o_que_fazer: 'Abre Relatório Semanal IA. Lê o atual de Ord e Deb.',
        o_que_esperar: 'Texto direto, números reais, recomendações acionáveis. Algo confuso?',
        link: '/estrategico/relatorio-semanal',
      },
    ],
  },
];

interface Estado {
  feito: boolean;
  nota: string;
}

const STORAGE_KEY = 'checklist-validacao-v1';

export default function ChecklistValidacaoPage() {
  const [estado, setEstado] = useState<Record<string, Estado>>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEstado(JSON.parse(raw));
    } catch (e) {
      console.warn('localStorage read fail', e);
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (carregado) localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  }, [estado, carregado]);

  const toggle = (id: string) => setEstado(p => ({ ...p, [id]: { ...p[id], feito: !p[id]?.feito, nota: p[id]?.nota ?? '' } }));
  const setNota = (id: string, nota: string) => setEstado(p => ({ ...p, [id]: { feito: p[id]?.feito ?? false, nota } }));

  const total = CHECKLIST.reduce((s, a) => s + a.testes.length, 0);
  const feitos = Object.values(estado).filter(e => e.feito).length;
  const comNota = Object.values(estado).filter(e => e.nota?.trim()).length;

  const exportar = () => {
    const linhas: string[] = ['# Checklist Validação Zykor — feedback\n'];
    for (const area of CHECKLIST) {
      linhas.push(`\n## ${area.emoji} ${area.area}\n`);
      for (const t of area.testes) {
        const e = estado[t.id];
        const check = e?.feito ? '✅' : '⬜';
        linhas.push(`- ${check} **${t.titulo}**`);
        if (e?.nota?.trim()) linhas.push(`  - 📝 ${e.nota.trim()}`);
      }
    }
    const blob = new Blob([linhas.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checklist-zykor-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-pink-600" /> Checklist de Validação
        </h1>
        <p className="text-sm text-gray-500">
          22 testes guiados pra você passear pelo Zykor e marcar o que tá certo, o que tá errado e o que falta.
          Use 3-5 dias. Salva automático no navegador.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Progresso</p>
          <p className="text-2xl font-bold">{feitos}/{total}</p>
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded h-2 mt-2 overflow-hidden">
            <div className="bg-pink-500 h-full" style={{ width: `${(feitos / total) * 100}%` }} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Com nota</p>
          <p className="text-2xl font-bold text-amber-600">{comNota}</p>
          <p className="text-[10px] text-gray-400">testes onde você anotou algo</p>
        </Card>
        <Card className="p-4 flex items-center">
          <Button onClick={exportar} className="w-full bg-pink-600 hover:bg-pink-700">
            <Save className="w-4 h-4 mr-2" /> Exportar feedback
          </Button>
        </Card>
      </div>

      {CHECKLIST.map(area => (
        <Card key={area.area} className="p-5">
          <h2 className="text-lg font-bold mb-3">{area.emoji} {area.area}</h2>
          <div className="space-y-3">
            {area.testes.map(t => {
              const e = estado[t.id];
              const feito = e?.feito ?? false;
              return (
                <div key={t.id} className={`border rounded-md p-3 ${feito ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200' : 'border-gray-200 dark:border-gray-800'}`}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggle(t.id)} className="mt-1 shrink-0">
                      {feito ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Circle className="w-5 h-5 text-gray-400" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold ${feito ? 'line-through text-gray-500' : ''}`}>{t.titulo}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1"><strong>📋 Fazer:</strong> {t.o_que_fazer}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400"><strong>✅ Esperar:</strong> {t.o_que_esperar}</p>
                      {t.link && (
                        <Link href={t.link} target="_blank" className="text-xs text-pink-600 hover:underline mt-1 inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> {t.link}
                        </Link>
                      )}
                      {t.pergunta_assistente && (
                        <p className="text-xs bg-pink-50 dark:bg-pink-900/20 border border-pink-200 rounded px-2 py-1 mt-2 italic">
                          💬 &ldquo;{t.pergunta_assistente}&rdquo;
                        </p>
                      )}
                      <textarea
                        value={e?.nota ?? ''}
                        onChange={ev => setNota(t.id, ev.target.value)}
                        placeholder="O que deu errado? O que faltou? O que surpreendeu?"
                        className="w-full mt-2 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <Card className="p-4 bg-amber-50 dark:bg-amber-900/10 border-amber-200">
        <p className="text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Quando terminar (ou no meio):</strong> clica em &ldquo;Exportar feedback&rdquo; e me manda o arquivo .md.
            Eu vou ler cada nota e priorizar os fixes.
          </span>
        </p>
      </Card>
    </main>
  );
}
