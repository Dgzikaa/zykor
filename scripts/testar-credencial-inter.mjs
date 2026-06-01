#!/usr/bin/env node
/**
 * Testa as credenciais Inter cifradas (envelope) de ponta a ponta, SEM mover dinheiro:
 *   1. busca as credenciais ativas no banco
 *   2. descriptografa client_secret + cert + key com a CREDENTIALS_MASTER_KEY
 *   3. autentica no Inter (OAuth2 + mTLS) — se o token vem, está tudo válido
 *
 * Node puro (18+). Mesmas env vars do script de cadastro.
 *
 *   $env:CREDENTIALS_MASTER_KEY="<chave>"
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://uqtgsvujwcbymjmvkjhy.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service role key>"
 *   node scripts/testar-credencial-inter.mjs
 */

import crypto from 'node:crypto';
import https from 'node:https';

function getKey() {
  const b64 = process.env.CREDENTIALS_MASTER_KEY;
  if (!b64) throw new Error('CREDENTIALS_MASTER_KEY não definida.');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('CREDENTIALS_MASTER_KEY precisa ser 32 bytes em base64.');
  return key;
}

function decryptSecret(payload) {
  const key = getKey();
  if (!payload || !payload.startsWith('v1:')) throw new Error('segredo não está no formato v1:');
  const raw = Buffer.from(payload.slice(3), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

function getInterToken(clientId, clientSecret, cert, key) {
  const data = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'pagamento-pix.write',
  }).toString();

  return new Promise(resolve => {
    const req = https.request(
      {
        hostname: 'cdpj.partners.bancointer.com.br',
        port: 443,
        path: '/oauth/v2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
        },
        cert,
        key,
      },
      res => {
        let b = '';
        res.on('data', c => (b += c));
        res.on('end', () => {
          try {
            const p = JSON.parse(b);
            if (p.access_token) resolve({ ok: true, scope: p.scope, expires_in: p.expires_in });
            else resolve({ ok: false, err: b });
          } catch {
            resolve({ ok: false, err: b });
          }
        });
      }
    );
    req.on('error', e => resolve({ ok: false, err: e.message }));
    req.write(data);
    req.end();
  });
}

async function main() {
  getKey();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');

  const resp = await fetch(
    `${url}/rest/v1/api_credentials?sistema=eq.banco_inter&ativo=eq.true&select=id,bar_id,empresa_nome,client_id,configuracoes&order=bar_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  const rows = await resp.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('Nenhuma credencial banco_inter ativa encontrada.');
    return;
  }

  for (const row of rows) {
    const nome = `${row.empresa_nome} (id ${row.id}, bar ${row.bar_id})`;
    try {
      const enc = row.configuracoes?.enc;
      if (!enc) throw new Error('sem bloco enc (não cifrada)');
      const clientSecret = decryptSecret(enc.client_secret).toString('utf8');
      const cert = decryptSecret(enc.cert);
      const key = decryptSecret(enc.key);
      process.stdout.write(`• ${nome}: descriptografia OK (cert ${cert.length}b, key ${key.length}b) … `);

      const r = await getInterToken(row.client_id, clientSecret, cert, key);
      if (r.ok) console.log(`✓ Inter autenticou (scope: ${r.scope}, expira ${r.expires_in}s)`);
      else console.log(`✗ Inter recusou: ${r.err}`);
    } catch (e) {
      console.log(`✗ ${nome}: ${e.message}`);
    }
  }
}

main().catch(e => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
