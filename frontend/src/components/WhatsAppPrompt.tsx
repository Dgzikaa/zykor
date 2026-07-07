'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MessageCircle, Loader2 } from 'lucide-react';

// Contas de serviço/tablet que NÃO devem ser cobradas.
const EXCLUIDOS = new Set([
  'producaobar@zykor.com.br',
  'producaocozinha@zykor.com.br',
  'meta-review@zykor.com.br',
]);

const soDigitos = (s: string) => (s || '').replace(/\D/g, '');

/**
 * Modal global: ao entrar no sistema, se o usuário não tem telefone cadastrado
 * (auth_custom.usuarios.telefone) e não é conta de serviço, pede o WhatsApp.
 * Ao salvar, some pra sempre (telefone cadastrado). "Agora não" adia até o próximo login.
 * Montado no MinimalLayout (dentro do AuthGuard → só usuário autenticado).
 */
export function WhatsAppPrompt() {
  const [open, setOpen] = useState(false);
  const [tel, setTel] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('wa_prompt_dismiss') === '1') {
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const res = await api.get('/api/usuarios/perfil');
        if (cancelado || !res?.success) return;
        const email = String(res.perfil?.email || '').toLowerCase();
        const telefone = soDigitos(res.perfil?.telefone || '');
        const temTelefone = telefone.length >= 10;
        if (!temTelefone && !EXCLUIDOS.has(email)) setOpen(true);
      } catch {
        /* silencioso — não atrapalha o login */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const valido = tel.length === 10 || tel.length === 11;

  const salvar = async () => {
    if (!valido) {
      toast.error('Informe o número com DDD (10 ou 11 dígitos).');
      return;
    }
    setSalvando(true);
    try {
      const res = await api.put('/api/usuarios/perfil', { celular: tel });
      if (res?.success) {
        toast.success('WhatsApp salvo! Você vai receber os alertas por lá. 🎉');
        setOpen(false);
      } else {
        toast.error(res?.error || 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const depois = () => {
    try {
      sessionStorage.setItem('wa_prompt_dismiss', '1');
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) depois();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" /> Cadastre seu WhatsApp
          </DialogTitle>
          <DialogDescription>
            Pra você receber os alertas do Zykor no WhatsApp (checklist, financeiro, produção…),
            cadastre seu número. Leva 5 segundos.
          </DialogDescription>
        </DialogHeader>
        <div className="py-1">
          <Input
            type="text"
            inputMode="numeric"
            placeholder="61999998888 (com DDD)"
            value={tel}
            onChange={(e) => setTel(soDigitos(e.target.value).slice(0, 11))}
          />
          {tel.length > 0 && !valido && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Digite DDD + número (10 ou 11 dígitos).
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={depois} disabled={salvando}>
            Agora não
          </Button>
          <Button onClick={salvar} disabled={salvando || !valido}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WhatsAppPrompt;
