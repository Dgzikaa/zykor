import OpenAI from 'openai';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Transcreve um áudio (gravado no navegador) em texto, via OpenAI Whisper. Usado pelo
 * microfone do composer de chamados: o áudio NÃO é armazenado — vira texto que o usuário
 * revisa antes de enviar. Recebe multipart/form-data com o campo `audio`.
 */
export const POST = withAuth(async ({ request }) => {
  if (!process.env.OPENAI_API_KEY) return fail('Transcrição indisponível (sem OPENAI_API_KEY)', 503);

  let form: FormData;
  try { form = await request.formData(); } catch { return fail('Envie o áudio como multipart/form-data', 400); }
  const file = form.get('audio');
  if (!(file instanceof File) || file.size === 0) return fail('Áudio ausente', 400);
  if (file.size > 25 * 1024 * 1024) return fail('Áudio muito grande (máx. 25MB)', 413);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'pt',
      response_format: 'text',
    });
    const texto = (typeof r === 'string' ? r : (r as any)?.text ?? '').trim();
    return success({ texto });
  } catch (e: any) {
    console.error('[chamados] transcrever falhou:', e);
    return fail(e?.message || 'Falha ao transcrever', 500);
  }
});
