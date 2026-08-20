import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { TIPOS_PESQUISA, nomeCurtoDoBar, type TipoPesquisa } from '@/lib/rh/pesquisa-felicidade';

/**
 * TÍTULO E PRÉVIA DO LINK da pesquisa.
 *
 * Gonza (20/08/2026): o link colado no WhatsApp aparecia como "Zykor — o núcleo da gestão de
 * bares", que é o metadata do app inteiro. Quem recebe não entende que aquilo é a pesquisa
 * dele — e link sem contexto no grupo é link que ninguém abre.
 *
 * A página em si é client component (tem estado de formulário), e client component não exporta
 * metadata. Por isso o título mora neste layout, que é servidor: ele lê a rodada pelo token e
 * monta "Pesquisa da Felicidade · Ordinário".
 *
 * Só sai daqui o que a própria página já mostra a quem abre o link (tipo e nome do bar) —
 * nada de resultado, nada de outras rodadas. Token inválido cai no genérico, sem dizer que
 * não existe: a página é que dá esse recado.
 */

export const dynamic = 'force-dynamic';

/** dd.mm.aaaa — o mesmo formato do título que o time já usa no Google Forms */
const fmtData = (iso: string) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}.${m}.${a}`;
};

async function rodadaDoToken(token: string): Promise<{ tipo: TipoPesquisa; bar: string; data: string } | null> {
  try {
    const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: rodada } = await (c as any).schema('hr').from('pesquisa_rodada')
      .select('tipo, bar_id, referencia').eq('token', token).maybeSingle();
    if (!rodada) return null;
    const { data: bar } = await (c as any).schema('operations').from('bares')
      .select('nome').eq('id', rodada.bar_id).maybeSingle();
    return {
      tipo: (rodada.tipo || 'felicidade') as TipoPesquisa,
      bar: nomeCurtoDoBar(bar?.nome),
      data: fmtData(rodada.referencia),
    };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params;
  const info = await rodadaDoToken(token);

  // "Pesquisa da Felicidade Deboche - 17.08.2026": mesma cara do título do Forms que o time
  // manda hoje, pra quem recebe reconhecer de cara.
  const titulo = info
    ? [`${TIPOS_PESQUISA[info.tipo].titulo} ${info.bar}`.trim(), info.data].filter(Boolean).join(' - ')
    : 'Pesquisa · Zykor';
  const descricao = info
    ? `${TIPOS_PESQUISA[info.tipo].convite}. Leva menos de um minuto.`
    : 'Responder a pesquisa.';

  return {
    title: titulo,
    description: descricao,
    // Link de pesquisa não entra em buscador: é pra um time específico, não é página pública.
    robots: { index: false, follow: false },
    // a imagem da prévia é gerada por opengraph-image.tsx (card roxo com nome, bar e data) —
    // não declarar `images` aqui deixa o Next usar aquela.
    openGraph: {
      type: 'website', siteName: 'Zykor', locale: 'pt_BR',
      title: titulo, description: descricao,
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descricao },
  };
}

export default function LayoutPesquisa({ children }: { children: React.ReactNode }) {
  return children;
}
