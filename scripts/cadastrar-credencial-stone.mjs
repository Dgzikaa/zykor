#!/usr/bin/env node
/**
 * Cadastra credencial Stone (Cliente Stone / API de Conciliação) no formato
 * ENVELOPE (cifrado). A chave do Portal Stone é criptografada AQUI, na sua
 * máquina, com a CREDENTIALS_MASTER_KEY (a mesma do Vercel). O banco recebe só
 * o texto cifrado — nada utilizável fica no Supabase.
 *
 * A chave do Portal vale p/ todos os StoneCodes do mesmo CNPJ; informe os
 * StoneCodes (affiliationCode) do bar em `stone_codes` (NÃO são segredo).
 *
 * Não precisa instalar nada: Node 18+ (já tem `fetch`).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

const ALG = 'aes-256-gcm';
const VERSION = 'v1';

function getKey() {
  const b64 = process.env.CREDENTIALS_MASTER_KEY;
  if (!b64) throw new Error('CREDENTIALS_MASTER_KEY não definida no ambiente.');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('CREDENTIALS_MASTER_KEY precisa ser 32 bytes em base64.');
  return key;
}

// Idêntico a frontend/src/lib/crypto/secretBox.ts — mantenha em sincronia.
function encryptSecret(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const pt = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ct]).toString('base64')}`;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('Uso: node scripts/cadastrar-credencial-stone.mjs <arquivo.json>');

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');

  getKey(); // valida a chave-mestra cedo

  const credenciais = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(credenciais)) throw new Error('O JSON deve ser uma lista de credenciais.');

  let ok = 0;
  let falhas = 0;
  for (const c of credenciais) {
   try {
    for (const campo of ['bar_id', 'nome', 'api_key', 'stone_codes']) {
      if (!c[campo]) throw new Error(`falta o campo obrigatório: ${campo}`);
    }
    if (!Array.isArray(c.stone_codes) || c.stone_codes.length === 0) {
      throw new Error('stone_codes deve ser uma lista não-vazia (StoneCodes do bar).');
    }

    const row = {
      bar_id: c.bar_id,
      sistema: 'stone',
      ambiente: c.ambiente || 'producao',
      client_id: null, // Cliente Stone não usa client_id (auth é Basic com a chave)
      client_secret: null, // nunca em texto
      empresa_nome: c.nome,
      empresa_cnpj: c.cnpj || null,
      ativo: true,
      configuracoes: {
        stone_codes: c.stone_codes.map((s) => String(s).trim()),
        enc: {
          api_key: encryptSecret(String(c.api_key)),
        },
      },
    };

    const resp = await fetch(`${url}/rest/v1/api_credentials`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`✗ ${c.nome} (bar ${c.bar_id}): HTTP ${resp.status} — ${txt}`);
      falhas++;
    } else {
      const [inserted] = await resp.json();
      console.log(`✓ ${c.nome} (bar ${c.bar_id}) cadastrada cifrada — id ${inserted?.id}`);
      ok++;
    }
   } catch (e) {
    console.error(`✗ ${c.nome || '?'} (bar ${c.bar_id}): ${e.message}`);
    falhas++;
   }
  }

  console.log(`\nResumo: ${ok} cadastrada(s), ${falhas} com erro.`);
  if (ok > 0) console.log('⚠️  DELETE o arquivo de input agora: Remove-Item scripts/credenciais-stone.local.json');
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});

/*
 * ── PASSO A PASSO (PowerShell, na pasta C:\Projects\zykor) ──────────────────
 *
 * 1) Gere a chave no Portal Stone (titular da conta):
 *      Perfil > Chaves de Autenticação > Criar Chave > "API de Conciliação Stone"
 *
 * 2) Copie o exemplo e preencha (1 entrada por bar/CNPJ):
 *      Copy-Item scripts/credenciais-stone.exemplo.json scripts/credenciais-stone.local.json
 *    Edite com api_key (a chave do Portal) e stone_codes (os StoneCodes do bar).
 *
 * 3) Defina as 3 variáveis de ambiente (nesta janela do PowerShell):
 *      $env:CREDENTIALS_MASTER_KEY="<a chave-mestra do Vercel>"
 *      $env:NEXT_PUBLIC_SUPABASE_URL="https://uqtgsvujwcbymjmvkjhy.supabase.co"
 *      $env:SUPABASE_SERVICE_ROLE_KEY="<service role key do Supabase>"
 *
 * 4) Rode:
 *      node scripts/cadastrar-credencial-stone.mjs scripts/credenciais-stone.local.json
 *
 * 5) DELETE o arquivo com a chave:
 *      Remove-Item scripts/credenciais-stone.local.json
 */
