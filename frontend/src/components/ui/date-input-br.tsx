'use client';

import * as React from 'react';
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
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function DateInputBR({ value, onChange, min, id, className, placeholder = 'dd/mm/aaaa', disabled }: Props) {
  const [txt, setTxt] = React.useState(isoToBr(value));

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

  return (
    <Input
      id={id}
      value={txt}
      onChange={handle}
      inputMode="numeric"
      placeholder={placeholder}
      maxLength={10}
      disabled={disabled}
      className={cn(abaixoDoMin && 'border-red-500', className)}
    />
  );
}
