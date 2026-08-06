'use client';

/**
 * Arquivos — pastas e fotos do bar (pedido da Ana Paula, 05/08/2026).
 *
 * O material dos artistas (foto, presskit) vivia num Drive que só ela mantinha, e toda semana
 * alguém pedia o link de novo no grupo. Aqui cada pasta é um artista/tema, e o link da pasta
 * pode ir pro campo "presskit" do cadastro do artista.
 *
 * O upload NÃO passa pela API: o browser sobe direto pro Storage com URL assinada (o corpo de
 * requisição na Vercel morre em ~4,5 MB, e foto de presskit passa disso fácil).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderPlus, Folder, Upload, Trash2, ArrowLeft, Link2, FileText, Loader2, ImageIcon } from 'lucide-react';
import {
  AVISO_PESADO_BYTES, MAX_ARQUIVO_BYTES, ehImagem, formataTamanho, mimeDoArquivo, validaArquivo,
} from '@/lib/arquivos/midias';

type PastaItem = { nome: string; arquivos: number; bytes: number };
type ArquivoItem = {
  nome: string; caminho: string; bytes: number; mime: string | null;
  atualizado_em: string | null; url: string | null;
};
type Resposta = { pastas: PastaItem[]; arquivos: ArquivoItem[] };

/** Nome exibido: o path guarda `169..._foto.jpg` pra não sobrescrever arquivo de mesmo nome. */
const nomeVisivel = (nome: string) => nome.replace(/^\d{10,}_/, '');

export default function ArquivosPage() {
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const [pasta, setPasta] = useState<string>('');
  const [enviando, setEnviando] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPageTitle('📁 Arquivos');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const endpoint = pasta ? `/api/ferramentas/arquivos?pasta=${encodeURIComponent(pasta)}` : '/api/ferramentas/arquivos';
  const { data, isLoading, mutate } = useApiSWR<Resposta>(endpoint);

  const pastas = useMemo(() => data?.pastas ?? [], [data]);
  const arquivos = useMemo(() => data?.arquivos ?? [], [data]);

  const criarPasta = useCallback(async () => {
    const nome = window.prompt('Nome da pasta (ex.: nome do artista):');
    if (!nome) return;
    const r = await fetch('/api/ferramentas/arquivos/pasta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ title: 'Não deu pra criar', description: j?.error || 'Erro', variant: 'destructive' });
      return;
    }
    mutate();
  }, [mutate, toast]);

  const enviarArquivos = useCallback(async (lista: FileList | null) => {
    if (!lista || lista.length === 0 || !pasta) return;
    const arquivosSel = Array.from(lista);

    // Valida TUDO antes de subir qualquer coisa: melhor avisar agora do que na metade da fila.
    const problemas = arquivosSel
      .map((f) => validaArquivo(f.name, f.type || null, f.size))
      .filter(Boolean) as string[];
    if (problemas.length) {
      toast({ title: 'Arquivo fora das regras', description: problemas.join(' · '), variant: 'destructive' });
      return;
    }
    const pesados = arquivosSel.filter((f) => f.size > AVISO_PESADO_BYTES).length;
    if (pesados) {
      toast({ title: `${pesados} arquivo(s) grande(s)`, description: 'Pode demorar um pouco no 4G — deixe a aba aberta.' });
    }

    // Mesmo client do upload de documentos do RH — não instanciar um segundo aqui.
    const storage = await getSupabaseClient();
    if (!storage) {
      toast({ title: 'Sem conexão com o armazenamento', description: 'Recarregue a página e tente de novo.', variant: 'destructive' });
      return;
    }

    setEnviando(arquivosSel.length);
    let ok = 0;
    for (const file of arquivosSel) {
      try {
        const r = await fetch('/api/ferramentas/arquivos/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pasta, nome_arquivo: file.name, mime: file.type || null, tamanho_bytes: file.size }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || 'Falha ao preparar envio');

        // Celular/scanner às vezes manda o arquivo sem content-type; sem reembrulhar,
        // o bucket recusa como octet-stream.
        const mime = mimeDoArquivo(file.name, file.type || null);
        const corpo = file.type ? file : new File([file], file.name, { type: mime });

        const { error } = await storage.storage.from(j.bucket).uploadToSignedUrl(j.path, j.token, corpo);
        if (error) throw error;
        ok += 1;
      } catch (e: unknown) {
        toast({
          title: `Falhou: ${file.name}`,
          description: e instanceof Error ? e.message : 'Erro no envio',
          variant: 'destructive',
        });
      } finally {
        setEnviando((n) => n - 1);
      }
    }
    if (ok) toast({ title: `${ok} arquivo(s) enviado(s)` });
    mutate();
    if (inputRef.current) inputRef.current.value = '';
  }, [pasta, mutate, toast]);

  const apagarArquivo = useCallback(async (item: ArquivoItem) => {
    if (!window.confirm(`Apagar "${nomeVisivel(item.nome)}"? Não dá pra desfazer.`)) return;
    const r = await fetch(`/api/ferramentas/arquivos?caminho=${encodeURIComponent(item.caminho)}`, { method: 'DELETE' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({ title: 'Não deu pra apagar', description: j?.error || 'Erro', variant: 'destructive' });
      return;
    }
    mutate();
  }, [mutate, toast]);

  const apagarPasta = useCallback(async (nome: string, qtd: number) => {
    if (!window.confirm(`Apagar a pasta "${nome}" e ${qtd} arquivo(s) dentro dela? Não dá pra desfazer.`)) return;
    const r = await fetch(`/api/ferramentas/arquivos?pasta=${encodeURIComponent(nome)}`, { method: 'DELETE' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({ title: 'Não deu pra apagar', description: j?.error || 'Erro', variant: 'destructive' });
      return;
    }
    mutate();
  }, [mutate, toast]);

  const copiarLink = useCallback(async (item: ArquivoItem) => {
    if (!item.url) return;
    await navigator.clipboard.writeText(item.url);
    toast({ title: 'Link copiado', description: 'Vale por 1 hora — para link fixo, compartilhe a pasta.' });
  }, [toast]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 py-4 max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Folder className="h-5 w-5 text-violet-600" />
              {pasta ? pasta : 'Arquivos'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pasta
                ? 'Fotos e material desta pasta. O link de cada arquivo vale 1 hora.'
                : 'Uma pasta por artista ou tema. O link da pasta pode ir no campo Presskit do artista.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {pasta ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setPasta('')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,application/pdf,.zip"
                  onChange={(e) => enviarArquivos(e.target.files)}
                />
                <Button size="sm" onClick={() => inputRef.current?.click()} disabled={enviando > 0} className="gap-2">
                  {enviando > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {enviando > 0 ? `Enviando (${enviando})…` : 'Enviar arquivos'}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={criarPasta} className="gap-2">
                <FolderPlus className="h-4 w-4" /> Nova pasta
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : !pasta ? (
          pastas.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-500">
              Nenhuma pasta ainda. Crie uma com o nome do artista e jogue as fotos dele dentro.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {pastas.map((p) => (
                <Card key={p.nome} className="hover:border-violet-300 transition-colors">
                  <CardContent className="p-4">
                    <button onClick={() => setPasta(p.nome)} className="w-full text-left">
                      <Folder className="h-8 w-8 text-violet-500 mb-2" />
                      <div className="font-medium text-gray-900 dark:text-white truncate" title={p.nome}>{p.nome}</div>
                      <div className="text-xs text-gray-500">
                        {p.arquivos} {p.arquivos === 1 ? 'arquivo' : 'arquivos'} · {formataTamanho(p.bytes)}
                      </div>
                    </button>
                    <button
                      onClick={() => apagarPasta(p.nome, p.arquivos)}
                      className="mt-2 text-xs text-gray-400 hover:text-rose-600 inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> apagar
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : arquivos.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-gray-500">
            Pasta vazia. Use &ldquo;Enviar arquivos&rdquo; — imagem, PDF ou ZIP até {formataTamanho(MAX_ARQUIVO_BYTES)} cada.
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {arquivos.map((a) => (
              <Card key={a.caminho} className="overflow-hidden">
                <div className="h-32 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  {ehImagem(a.mime) && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={nomeVisivel(a.nome)} className="h-full w-full object-cover" />
                  ) : a.mime === 'application/pdf' ? (
                    <FileText className="h-10 w-10 text-gray-400" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-gray-400" />
                  )}
                </div>
                <CardContent className="p-3">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={nomeVisivel(a.nome)}>
                    {nomeVisivel(a.nome)}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{formataTamanho(a.bytes)}</div>
                  <div className="flex items-center gap-3 text-xs">
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
                        abrir
                      </a>
                    )}
                    <button onClick={() => copiarLink(a)} className="text-gray-500 hover:text-violet-600 inline-flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> link
                    </button>
                    <button onClick={() => apagarArquivo(a)} className="text-gray-400 hover:text-rose-600 inline-flex items-center gap-1 ml-auto">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
