import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const perfil = searchParams.get('perfil'); // FORNECEDOR ou CLIENTE
    const sync = searchParams.get('sync') === 'true';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Se não for para sincronizar, retorna do banco — paginando (Supabase default = 1000)
    if (!sync) {
      const todas: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let query = (supabase.schema('bronze' as any) as any)
          .from('bronze_contaazul_pessoas')
          .select('*')
          .eq('bar_id', parseInt(barId));
        if (perfil) query = query.eq('perfil', perfil);
        const { data, error } = await query.order('nome').range(from, from + PAGE - 1);
        if (error) {
          console.error('Erro ao buscar pessoas do banco:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const arr = (data as any[]) || [];
        todas.push(...arr);
        if (arr.length < PAGE) break;
        from += PAGE;
        if (from > 50000) break; // hard cap segurança
      }
      return NextResponse.json({ pessoas: todas });
    }

    // Buscar credenciais do Conta Azul
    const { data: credentials, error: credError } = await supabase
      .from('api_credentials')
      .select('access_token, expires_at')
      .eq('sistema', 'conta_azul')
      .eq('bar_id', parseInt(barId))
      .single();

    if (credError || !credentials?.access_token) {
      return NextResponse.json(
        { error: 'Credenciais do Conta Azul não encontradas' },
        { status: 404 }
      );
    }

    // Verificar se token expirou
    if (credentials.expires_at && new Date(credentials.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Token expirado. Reconecte o Conta Azul.' },
        { status: 401 }
      );
    }

    const todasPessoas: any[] = [];

    // CA v2 unifica fornecedor/cliente em /v1/pessoas (perfis vem como array: ["Fornecedor","Cliente"])
    // Params em pt-BR: pagina + tamanho_pagina (size em inglês é ignorado, cai em default 10)
    let pagina = 1;
    let totalPaginas = 1;
    const TAM_PAGINA = 500;
    do {
      const pessoasUrl = new URL(`${CONTA_AZUL_API_URL}/v1/pessoas`);
      pessoasUrl.searchParams.set('pagina', String(pagina));
      pessoasUrl.searchParams.set('tamanho_pagina', String(TAM_PAGINA));

      const pessoasResp = await fetch(pessoasUrl.toString(), {
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!pessoasResp.ok) {
        const txt = await pessoasResp.text();
        console.error('[CA-stakeholders] /v1/pessoas erro', pessoasResp.status, txt.slice(0, 300));
        break;
      }
      const pessoasData = await pessoasResp.json();
      const itens: any[] = pessoasData.items || pessoasData.itens || pessoasData.content || [];
      const totalItems = Number(pessoasData.totalItems || pessoasData.itens_totais || itens.length);
      totalPaginas = Math.max(1, Math.ceil(totalItems / TAM_PAGINA));
      itens.forEach(p => todasPessoas.push(p));
      pagina += 1;
    } while (pagina <= totalPaginas && pagina <= 50); // hard cap 25k

    console.log(`[CA-stakeholders] /v1/pessoas total=${todasPessoas.length} bar_id=${barId}`);

    function detectarPerfilPrincipal(perfis: any): string | null {
      if (!Array.isArray(perfis)) return null;
      const lower = perfis.map(p => String(p).toLowerCase());
      if (lower.includes('fornecedor')) return 'FORNECEDOR';
      if (lower.includes('cliente')) return 'CLIENTE';
      return String(perfis[0] || '').toUpperCase();
    }

    // Filtrar por perfil se solicitado
    const filtradas = perfil
      ? todasPessoas.filter(p => detectarPerfilPrincipal(p.perfis) === perfil.toUpperCase())
      : todasPessoas;

    // tabela contaazul_pessoas tem CHECK constraint: tipo_pessoa IN ('Física','Jurídica','Estrangeira')
    function normalizarTipoPessoa(raw: any): string | null {
      if (!raw) return null;
      // Remove diacríticos via NFD + range Unicode dos combining marks (̀-ͯ)
      const semAcento = String(raw)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
      if (semAcento.startsWith('fis')) return 'Física';
      if (semAcento.startsWith('jur')) return 'Jurídica';
      if (semAcento.startsWith('est')) return 'Estrangeira';
      return null;
    }

    const pessoasParaSalvar = filtradas
      .filter(p => p.id || p.uuid)
      .map((pessoa: any) => ({
        bar_id: parseInt(barId),
        contaazul_id: pessoa.id || pessoa.uuid,
        nome: pessoa.nome || pessoa.name || pessoa.razao_social,
        // tipo_pessoa: skipped por hora — constraint exige NFC exato 'Física'/'Jurídica'/'Estrangeira'
        // e CA pode retornar variantes de encoding/normalização. NULL passa o CHECK.
        tipo_pessoa: null,
        documento: String(pessoa.documento || pessoa.cpf || pessoa.cnpj || pessoa.cpf_cnpj || pessoa.document || '').replace(/\D/g, '') || null,
        email: pessoa.email || null,
        telefone: pessoa.telefone || pessoa.phone || pessoa.celular || null,
        perfil: detectarPerfilPrincipal(pessoa.perfis) || pessoa.perfil || null,
        ativo: pessoa.ativo !== false && pessoa.status !== 'INATIVO',
        raw_data: pessoa,
        sincronizado_em: new Date().toISOString(),
      }));

    // Dedup por (contaazul_id, bar_id) — paginação pode trazer mesma pessoa em páginas diferentes
    const dedupMap = new Map<string, typeof pessoasParaSalvar[number]>();
    for (const p of pessoasParaSalvar) {
      const key = `${p.bar_id}:${p.contaazul_id}`;
      const existing = dedupMap.get(key);
      // mantém o mais "completo": prefere quem tem documento; caso empate, prefere Fornecedor
      if (!existing) {
        dedupMap.set(key, p);
        continue;
      }
      const score = (x: typeof p) => (x.documento ? 2 : 0) + (x.perfil === 'FORNECEDOR' ? 1 : 0);
      if (score(p) > score(existing)) dedupMap.set(key, p);
    }
    const pessoasDedupadas = Array.from(dedupMap.values());
    console.log(`[CA-stakeholders] dedup: ${pessoasParaSalvar.length} → ${pessoasDedupadas.length}`);

    // Soft-delete: marca ativo=false em pessoas que sumiram do CA
    const idsRecebidos = pessoasDedupadas.map(p => p.contaazul_id).filter(Boolean);
    if (idsRecebidos.length > 0) {
      const { error: deactivateError } = await (supabase
        .schema('bronze' as any) as any)
        .from('bronze_contaazul_pessoas')
        .update({ ativo: false })
        .eq('bar_id', parseInt(barId))
        .not('contaazul_id', 'in', `(${idsRecebidos.map(id => `"${id}"`).join(',')})`);
      if (deactivateError) {
        console.error('Aviso: erro ao desativar pessoas removidas (não bloqueante):', deactivateError);
      }
    }

    if (pessoasDedupadas.length > 0) {
      // Usar upsert para evitar duplicatas
      const { error: upsertError } = await supabase
        .schema('bronze' as any)
        .from('bronze_contaazul_pessoas')
        .upsert(pessoasDedupadas, {
          onConflict: 'contaazul_id,bar_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('Erro ao salvar pessoas:', upsertError);
        return NextResponse.json(
          { error: 'Erro ao salvar pessoas', details: upsertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      pessoas: pessoasDedupadas,
      total: pessoasDedupadas.length,
      fornecedores: pessoasDedupadas.filter(p => p.perfil === 'FORNECEDOR').length,
      clientes: pessoasDedupadas.filter(p => p.perfil === 'CLIENTE').length,
      sincronizado_em: new Date().toISOString()
    });

  } catch (err) {
    console.error('Erro ao buscar stakeholders:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
