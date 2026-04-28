import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/version
 *
 * Devolve o SHA do commit do deploy atual. Cliente compara com a versão
 * embutida no bundle (NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA) — se diferente,
 * mostra banner "nova versão disponível".
 *
 * Em dev (sem Vercel), retorna 'dev' e cliente nunca dispara o banner.
 */
export async function GET() {
  const version = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev';

  return NextResponse.json(
    {
      version,
      deployedAt: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
