#!/usr/bin/env node
/**
 * Cadastra credenciais Inter no formato ENVELOPE (cifrado).
 *
 * Os segredos (client_secret, cert, key) são criptografados AQUI, na sua máquina,
 * com a CREDENTIALS_MASTER_KEY (a mesma que vai no Vercel). O banco recebe só o
 * texto cifrado — nada utilizável fica no Supabase.
 *
 * Não precisa instalar nada: usa só Node puro (versão 18+, que já tem `fetch`).
 *
 * COMO USAR — veja o passo a passo no final do arquivo ou peça pro Claude.
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
  if (!inputPath) throw new Error('Uso: node scripts/cadastrar-credencial-inter.mjs <arquivo.json>');

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
    for (const campo of ['bar_id', 'nome', 'client_id', 'client_secret', 'conta_corrente', 'cert_path', 'key_path']) {
      if (!c[campo]) throw new Error(`falta o campo obrigatório: ${campo}`);
    }
    if (!fs.existsSync(c.cert_path)) throw new Error(`arquivo cert não encontrado: ${c.cert_path}`);
    if (!fs.existsSync(c.key_path)) throw new Error(`arquivo key não encontrado: ${c.key_path}`);
    const certBuf = fs.readFileSync(c.cert_path);
    const keyBuf = fs.readFileSync(c.key_path);

    const row = {
      bar_id: c.bar_id,
      sistema: 'banco_inter',
      ambiente: c.ambiente || 'producao',
      client_id: String(c.client_id),
      client_secret: null, // nunca em texto
      empresa_nome: c.nome,
      empresa_cnpj: c.cnpj || null,
      ativo: true,
      configuracoes: {
        conta_corrente: String(c.conta_corrente),
        enc: {
          client_secret: encryptSecret(String(c.client_secret)),
          cert: encryptSecret(certBuf),
          key: encryptSecret(keyBuf),
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
  if (ok > 0) console.log('⚠️  DELETE o arquivo de input agora: Remove-Item scripts/credenciais-inter.local.json');
}

main().catch(e => {
  console.error('ERRO:', e.message);
  process.exit(1);
});

/*
 * ── PASSO A PASSO (PowerShell, na pasta C:\Projects\zykor) ──────────────────
 *
 * 1) Copie o exemplo e preencha as 3 contas:
 *      Copy-Item scripts/credenciais-inter.exemplo.json scripts/credenciais-inter.local.json
 *    Edite scripts/credenciais-inter.local.json com client_id, client_secret,
 *    conta_corrente e os CAMINHOS dos arquivos .crt e .key de cada conta.
 *
 * 2) Defina as 3 variáveis de ambiente (nesta janela do PowerShell):
 *      $env:CREDENTIALS_MASTER_KEY="<a chave-mestra>"
 *      $env:NEXT_PUBLIC_SUPABASE_URL="https://uqtgsvujwcbymjmvkjhy.supabase.co"
 *      $env:SUPABASE_SERVICE_ROLE_KEY="<service role key do Supabase>"
 *
 * 3) Rode:
 *      node scripts/cadastrar-credencial-inter.mjs scripts/credenciais-inter.local.json
 *
 * 4) DELETE o arquivo com os segredos:
 *      Remove-Item scripts/credenciais-inter.local.json
 */
