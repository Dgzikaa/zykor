import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// Configurações OAuth - ADICIONE NO SEU .env.local:
// GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
// GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const REDIRECT_URI =
  process.env.NODE_ENV === 'production'
    ? 'https://seu-dominio.com/api/auth/google/callback'
    : 'http://localhost:3000/api/auth/google/callback';

class GoogleOAuthManager {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = GOOGLE_OAUTH_CLIENT_ID;
    this.clientSecret = GOOGLE_OAUTH_CLIENT_SECRET;
    this.redirectUri = REDIRECT_URI;
  }

  private checkCredentials(): boolean {
    if (!this.clientId || !this.clientSecret) {
      console.error('❌ Google OAuth credentials não configuradas');
      return false;
    }
    return true;
  }

  /**
   * Gerar URL de autorização OAuth
   */
  getAuthUrl(state?: string): string {
    if (!this.checkCredentials()) {
      throw new Error('Google OAuth credentials não configuradas');
    }

    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/plus.business.manage',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Trocar código por token
   */
  async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  } | null> {
    if (!this.checkCredentials()) {
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Erro ao trocar código por token:', errorData);
        return null;
      }

      const tokenData = await response.json();

      return tokenData;
    } catch (error) {
      console.error('❌ Erro na troca de código por token:', error);
      return null;
    }
  }

  /**
   * Atualizar token usando refresh_token
   */
  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
    token_type: string;
  } | null> {
    if (!this.checkCredentials()) {
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        console.error('❌ Erro ao atualizar token');
        return null;
      }

      const tokenData = await response.json();

      return tokenData;
    } catch (error) {
      console.error('❌ Erro na atualização do token:', error);
      return null;
    }
  }
}

const oauthManager = new GoogleOAuthManager();

/**
 * GET: Redirecionar para autorização Google
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'authorize') {
      const state = searchParams.get('state') || 'sgb-auth-' + Date.now();
      const authUrl = oauthManager.getAuthUrl(state);

      return NextResponse.redirect(authUrl);
    }

    return NextResponse.json(
      {
        error: 'Ação não especificada. Use ?action=authorize',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ Erro na autorização:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Trocar código por token (manual)
 */
export async function POST(request: NextRequest) {
  try {
    const { code, action } = await request.json();

    if (action === 'exchange') {
      if (!code) {
        return NextResponse.json(
          {
            error: 'Código de autorização é obrigatório',
          },
          { status: 400 }
        );
      }

      const tokenData = await oauthManager.exchangeCodeForToken(code);

      if (!tokenData) {
        return NextResponse.json(
          {
            error: 'Falha ao obter token',
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: tokenData,
      });
    }

    if (action === 'refresh') {
      const { refresh_token } = await request.json();

      if (!refresh_token) {
        return NextResponse.json(
          {
            error: 'Refresh token é obrigatório',
          },
          { status: 400 }
        );
      }

      const tokenData = await oauthManager.refreshToken(refresh_token);

      if (!tokenData) {
        return NextResponse.json(
          {
            error: 'Falha ao atualizar token',
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: tokenData,
      });
    }

    return NextResponse.json(
      {
        error: 'Ação não especificada',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ Erro na troca de token:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
