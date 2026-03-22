'use client';

import { useState, useCallback } from 'react';

// =====================================================
// TIPOS E INTERFACES
// =====================================================

export interface UploadOptions {
  folder: 'checklist_photos' | 'signatures' | 'profile_photos';
  compress?: boolean;
  maxWidth?: number;
  quality?: number;
  maxSizeMB?: number;
}

export interface UploadResult {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  type: string;
  size: number;
  folder: string;
  compressed: boolean;
}

export interface UploadProgress {
  loading: boolean;
  progress: number;
  error: string | null;
  result: UploadResult | null;
}

// =====================================================
// HOOK DE UPLOAD
// =====================================================

export function useFileUpload() {
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});

  // Função para comprimir imagem no frontend
  const compressImage = useCallback(
    async (
      file: File,
      maxWidth: number = 1920,
      quality: number = 0.8
    ): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context não disponível'));
          return;
        }

        const img = new Image();

        img.onload = () => {
          try {
            // Calcular dimensões mantendo aspect ratio
            let { width, height } = img;

            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            // Desenhar imagem redimensionada
            ctx.drawImage(img, 0, 0, width, height);

            // Converter para blob comprimido
            canvas.toBlob(
              blob => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error('Falha na compressão'));
                }
              },
              'image/jpeg',
              quality
            );
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => reject(new Error('Falha ao carregar imagem'));
        img.src = URL.createObjectURL(file);
      });
    },
    []
  );

  // Função principal de upload
  const uploadFile = useCallback(
    async (file: File, options: UploadOptions): Promise<UploadResult> => {
      const uploadId = Math.random().toString(36).substring(2, 15);

      // Estado inicial do upload
      setUploads(prev => ({
        ...prev,
        [uploadId]: {
          loading: true,
          progress: 0,
          error: null,
          result: null,
        },
      }));

      try {
        // Validações básicas no frontend
        const maxSize = (options.maxSizeMB || 10) * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error(
            `Arquivo muito grande. Máximo: ${options.maxSizeMB || 10}MB`
          );
        }

        const allowedTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
        ];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(
            `Tipo não permitido. Aceitos: ${allowedTypes.join(', ')}`
          );
        }

        // Preparar arquivo (comprimir se necessário)
        let fileToUpload: File | Blob = file;

        if (options.compress && file.type.startsWith('image/')) {
          setUploads(prev => ({
            ...prev,
            [uploadId]: { ...prev[uploadId], progress: 20 },
          }));

          console.log('📸 Comprimindo imagem...');
          fileToUpload = await compressImage(
            file,
            options.maxWidth || 1920,
            options.quality || 0.8
          );

          console.log(
            `✅ Compressão: ${file.size} → ${fileToUpload.size} bytes`
          );
        }

        // Preparar FormData
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('folder', options.folder);
        formData.append('compress', String(options.compress || false));
        formData.append('maxWidth', String(options.maxWidth || 1920));
        formData.append('quality', String(options.quality || 0.8));

        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 50 },
        }));

        // Pegar bar_id selecionado para header
        const selectedBarId = localStorage.getItem('sgb_selected_bar_id');
        const headers: Record<string, string> = {};

        if (selectedBarId) {
          headers['x-selected-bar-id'] = selectedBarId;
        }

        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 70 },
        }));

        // Fazer upload
        const response = await fetch('/api/configuracoes/uploads', {
          method: 'POST',
          headers,
          body: formData,
        });

        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 90 },
        }));

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Erro no upload');
        }

        // Sucesso!
        setUploads(prev => ({
          ...prev,
          [uploadId]: {
            loading: false,
            progress: 100,
            error: null,
            result: result.data,
          },
        }));

        console.log('✅ Upload concluído:', result.data.filename);
        return result.data;
      } catch (error: unknown) {
        console.error('❌ Erro no upload:', error);

        setUploads(prev => ({
          ...prev,
          [uploadId]: {
            loading: false,
            progress: 0,
            error: error instanceof Error ? error.message : String(error),
            result: null,
          },
        }));

        throw error;
      }
    },
    [compressImage]
  );

  // Função para remover arquivo
  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    try {
      const selectedBarId = localStorage.getItem('sgb_selected_bar_id');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (selectedBarId) {
        headers['x-selected-bar-id'] = selectedBarId;
      }

      const response = await fetch(`/api/configuracoes/uploads?id=${fileId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao deletar arquivo');
      }

      console.log('✅ Arquivo deletado');
    } catch (error: unknown) {
      console.error('❌ Erro ao deletar:', error);
      throw error;
    }
  }, []);

  // Função para listar uploads
  const listUploads = useCallback(async (folder?: string) => {
    try {
      const selectedBarId = localStorage.getItem('sgb_selected_bar_id');
      const headers: Record<string, string> = {};

      if (selectedBarId) {
        headers['x-selected-bar-id'] = selectedBarId;
      }

      const params = new URLSearchParams();
      if (folder) params.append('folder', folder);

      const response = await fetch(`/api/configuracoes/uploads?${params}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao listar arquivos');
      }

      return result.data;
    } catch (error: unknown) {
      console.error('❌ Erro ao listar uploads:', error);
      throw error;
    }
  }, []);

  // Limpar estado de um upload específico
  const clearUpload = useCallback((uploadId: string) => {
    setUploads(prev => {
      const { [uploadId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Limpar todos os uploads
  const clearAllUploads = useCallback(() => {
    setUploads({});
  }, []);

  return {
    uploads,
    uploadFile,
    deleteFile,
    listUploads,
    clearUpload,
    clearAllUploads,
    compressImage,
  };
}
