import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { TIPOS_PESQUISA, nomeCurtoDoBar, type TipoPesquisa } from '@/lib/rh/pesquisa-felicidade';

/**
 * A "fotinho" da prévia do link — a mesma ideia do Google Forms, que o time já reconhece
 * (Rodrigo, 20/08/2026: "aparece uma fotinho da prévia: pesquisa da felicidade deboche —
 * 10.12.2026").
 *
 * Sem isto, o WhatsApp mostrava o card genérico do Zykor e o link virava "mais um link" no
 * grupo. Com nome da pesquisa, bar e data, quem recebe sabe o que é antes de abrir — que é
 * metade da taxa de resposta.
 *
 * Desenhada aqui e não com uma imagem fixa porque o texto muda por rodada (tipo, casa e data).
 */

export const dynamic = 'force-dynamic';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Pesquisa Zykor';

const fmtData = (iso: string) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}.${m}.${a}`;
};

export default async function Imagem({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let tipo: TipoPesquisa = 'felicidade';
  let bar = '';
  let data = '';
  try {
    const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: rodada } = await (c as any).schema('hr').from('pesquisa_rodada')
      .select('tipo, bar_id, referencia').eq('token', token).maybeSingle();
    if (rodada) {
      tipo = (rodada.tipo || 'felicidade') as TipoPesquisa;
      data = fmtData(rodada.referencia);
      const { data: b } = await (c as any).schema('operations').from('bares')
        .select('nome').eq('id', rodada.bar_id).maybeSingle();
      bar = nomeCurtoDoBar(b?.nome);
    }
  } catch { /* prévia é enfeite: sem dado, sai o card genérico em vez de link sem imagem */ }

  const titulo = TIPOS_PESQUISA[tipo]?.titulo ?? 'Pesquisa';
  const convite = TIPOS_PESQUISA[tipo]?.convite ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '80px',
          // mesmo roxo da tela de responder: quem abre o link reconhece que chegou no lugar certo
          background: 'linear-gradient(135deg, #4f46e5 0%, #7e22ce 55%, #a21caf 100%)',
          color: 'white', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 30, opacity: 0.75, display: 'flex' }}>Zykor</div>
        <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.1, marginTop: 18, display: 'flex' }}>
          {titulo}
        </div>
        <div style={{ fontSize: 46, marginTop: 14, opacity: 0.92, display: 'flex' }}>
          {[bar, data].filter(Boolean).join('  ·  ')}
        </div>
        <div style={{ fontSize: 30, marginTop: 34, opacity: 0.75, display: 'flex' }}>
          {convite}
        </div>
      </div>
    ),
    size,
  );
}
