'use client';

import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

/**
 * Campo de data que SEMPRE exibe dd/mm/aaaa, independente da locale do navegador.
 *
 * O `<input type="date">` nativo mostra a data no formato da locale do Chrome (em
 * inglês vira mm/dd/aaaa) e isso não dá pra forçar por HTML/CSS. Aqui usamos um input
 * de texto mascarado: exibe dd/mm/aaaa e emite/recebe ISO (YYYY-MM-DD) por fora — então
 * o resto do código continua trabalhando com ISO como antes.
 */
export function isoToBr(iso?: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function brToIso(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null; // rejeita 31/02 etc.
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function maskBr(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '/' + d.slice(2, 4);
  if (d.length > 4) out += '/' + d.slice(4, 8);
  return out;
}

interface Props {
  value: string;                    // ISO (YYYY-MM-DD) ou ''
  onChange: (iso: string) => void;  // emite ISO ('' quando vazio/incompleto)
  min?: string;                     // ISO — data mínima (marca borda vermelha se abaixo)
  max?: string;                     // ISO — data máxima (passada ao seletor nativo)
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  calendar?: boolean;               // exibe botão de calendário (abre o seletor nativo do navegador)
}

export function DateInputBR({ value, onChange, min, max, id, className, placeholder = 'dd/mm/aaaa', disabled, calendar }: Props) {
  const [txt, setTxt] = React.useState(isoToBr(value));
  const nativeRef = React.useRef<HTMLInputElement>(null);

  // Sincroniza quando o valor externo muda (reset do form, edição, etc.).
  React.useEffect(() => { setTxt(isoToBr(value)); }, [value]);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskBr(e.target.value);
    setTxt(masked);
    if (masked === '') { onChange(''); return; }
    const iso = brToIso(masked);
    if (iso) onChange(iso);       // só emite quando a data está completa e válida
  };

  const abaixoDoMin = !!(value && min && value < min);

  // Desktop: showPicker() abre o calendário nativo (precisa de gesto do usuário). No celular o
  // simples toque no input date sobreposto já abre o seletor do SO — por isso ele fica opacity-0
  // MAS tocável (pointer-events-auto/tamanho real), não h-0/pointer-events-none.
  const abrirCalendario = () => {
    const el = nativeRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el || disabled) return;
    try { el.showPicker?.(); } catch { /* mobile: o toque no próprio input já abriu o seletor */ }
  };

  const campo = (
    <Input
      id={id}
      value={txt}
      onChange={handle}
      inputMode="numeric"
      placeholder={placeholder}
      maxLength={10}
      disabled={disabled}
      className={cn(abaixoDoMin && 'border-red-500', calendar && 'pr-9', className)}
    />
  );

  if (!calendar) return campo;

  return (
    <div className="relative">
      {campo}
      {/* Ícone decorativo do calendário (o toque/clique é capturado pelo input date abaixo). */}
      <CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {/* Seletor nativo transparente sobre o ícone. Tocável nos dois mundos:
          - celular: o toque abre direto o seletor de data do SO;
          - desktop: onClick chama showPicker(). O texto exibido é sempre o input mascarado acima. */}
      <input
        ref={nativeRef}
        type="date"
        value={value || ''}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Abrir calendário"
        onClick={abrirCalendario}
        onChange={(e) => onChange(e.target.value)}
        className="absolute right-0 top-0 h-full w-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}
