'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { segundaDe, somaDias } from '@/lib/rh/ata-semanal';
import { cn } from '@/lib/utils';
import { CalendarDays, Loader2, Copy, Check, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

/**
 * Ata semanal do RH (objetivo 3 da ata de 13/08/2026): a mensagem de segunda, montada sozinha.
 *
 * A tela mostra o texto pronto pra copiar e colar no grupo. O disparo automático no WhatsApp
 * ainda não entra: o canal Umbler do Zykor não entrega (ver o vigia do ContaHub) — quando
 * entregar, é só plugar este mesmo texto.
 */

const fmt = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

export default function AtaSemanalPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const { showToast } = useToast();
  const hoje = new Date().toISOString().slice(0, 10);
  // abre na semana que acabou — é a que se manda na segunda
  const [semana, setSemana] = useState(() => segundaDe(somaDias(hoje, -7)));
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setPageTitle('📋 Ata semanal do RH');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const { data, isLoading } = useApiSWR<any>(selectedBar ? `/api/rh/ata-semanal?semana=${semana}` : null);
  const b = data?.blocos;
  const texto: string = data?.texto || '';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    } catch { showToast({ type: 'error', title: 'Não consegui copiar', message: 'Selecione o texto e copie na mão.' }); }
  };

  const semCheckin = b && b.cobertura.escalados > 0 && b.cobertura.com_checkin < b.cobertura.escalados;

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5 max-w-4xl">
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Button size="sm" variant="outline" className="h-9 px-2" onClick={() => setSemana(somaDias(semana, -7))}><ChevronLeft className="w-4 h-4" /></Button>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            {fmt(semana)} a {fmt(somaDias(semana, 6))}
          </div>
          <Button size="sm" variant="outline" className="h-9 px-2" onClick={() => setSemana(somaDias(semana, 7))}><ChevronRight className="w-4 h-4" /></Button>
          <Input type="date" value={semana} onChange={(e) => e.target.value && setSemana(segundaDe(e.target.value))} className="h-9 w-[150px]" />
          <Button size="sm" className="h-9 ml-auto" onClick={copiar} disabled={!texto}>
            {copiado ? <><Check className="w-4 h-4 mr-1.5" />Copiado</> : <><Copy className="w-4 h-4 mr-1.5" />Copiar mensagem</>}
          </Button>
        </div>

        {isLoading ? <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div> : (
          <>
            {semCheckin && (
              <Card className="mb-3 ring-1 ring-amber-300 dark:ring-amber-700 border-0">
                <CardContent className="py-2.5 flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Só <strong>{b.cobertura.com_checkin} de {b.cobertura.escalados}</strong> turnos da semana tiveram check-in do líder.
                    O bloco de faltas conta apenas o que foi conferido — o ponto sozinho superconta, porque PJ e liderança não batem.
                  </span>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
              <CardContent className="py-4">
                <pre className={cn('whitespace-pre-wrap break-words text-sm leading-relaxed font-sans')}>{texto}</pre>
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground mt-3">
              A Pesquisa da Felicidade fica de fora da ata por enquanto, como combinado na reunião.
              O disparo automático no WhatsApp entra quando o canal do Zykor voltar a entregar.
            </p>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
