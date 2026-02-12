/**
 * Script para recalcular todas as semanas de desempenho.
 * Requer: carregar .env.local do frontend (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * 
 * Uso: npx tsx scripts/recalcular-desempenho-todas.ts
 * Ou: cd frontend && node -e "require('dotenv').config({path:'.env.local'}); ..."
 */
import 'dotenv/config';
import { resolve } from 'path';

async function main() {
  const envPath = resolve(process.cwd(), 'frontend', '.env.local');
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  } catch {
    // dotenv pode não estar disponível
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em frontend/.env.local');
    process.exit(1);
  }

  const fnUrl = `${url}/functions/v1/desempenho-semanal-auto`;
  console.log('🔄 Invocando recálculo completo...');

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recalcular_todas: true }),
  });

  const data = await res.json();

  if (res.ok) {
    console.log('✅ Sucesso:', data);
    console.log(`   Recalculadas: ${data.recalculadas || 0} semanas`);
    if (data.erros > 0) console.log(`   Erros: ${data.erros}`);
  } else {
    console.error('❌ Erro:', data);
    process.exit(1);
  }
}

main();
