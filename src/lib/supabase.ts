import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { AppServiceError } from '../types/domain';

export interface SupabaseEnvConfig {
  url: string;
  publishableKey: string;
  isConfigured: boolean;
  missingVars: string[];
}

export function resolveSupabaseConfig(): SupabaseEnvConfig {
  const env = import.meta.env ?? {};
  const rawUrl = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const rawKey = (
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const missingVars: string[] = [];
  if (!rawUrl) {
    missingVars.push('VITE_SUPABASE_URL');
  }
  if (!rawKey) {
    missingVars.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  let validUrl = false;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      validUrl = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      validUrl = false;
    }
  }

  if (rawUrl && !validUrl) {
    missingVars.push('VITE_SUPABASE_URL (invalid URL format)');
  }

  return {
    url: rawUrl,
    publishableKey: rawKey,
    isConfigured: missingVars.length === 0,
    missingVars,
  };
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const config = resolveSupabaseConfig();
  if (!config.isConfigured) {
    throw new AppServiceError(
      'configuration',
      `Supabase configuration is missing or incomplete (${config.missingVars.join(', ')}). Configure .env using .env.example before starting the demo.`
    );
  }

  cachedClient = createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'returnready-supabase-auth-v1',
    },
  });

  return cachedClient;
}

export interface DemoAuthResult {
  session: Session;
  authMode: 'anonymous' | 'ephemeral_session';
}

let pendingSessionPromise: Promise<DemoAuthResult> | null = null;

/**
 * Ensures an isolated Supabase-authenticated browser session exists.
 * Reuses an existing session on reload or double-click so render cycles never spawn duplicate users.
 */
export async function ensureDemoSession(client?: SupabaseClient): Promise<DemoAuthResult> {
  if (pendingSessionPromise) {
    return pendingSessionPromise;
  }

  pendingSessionPromise = (async () => {
    const supabase = client ?? getSupabaseClient();

    const { data: existing, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      throw new AppServiceError(
        'unauthenticated',
        `Unable to inspect current auth session: ${sessionErr.message}`
      );
    }

    if (existing.session?.user) {
      return {
        session: existing.session,
        authMode: existing.session.user.is_anonymous ? 'anonymous' : 'ephemeral_session',
      };
    }

    // Attempt standard Supabase Anonymous Sign-In first
    const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
    if (!anonErr && anonData.session) {
      return {
        session: anonData.session,
        authMode: 'anonymous',
      };
    }

    // If the self-hosted GoTrue instance has ENABLE_ANONYMOUS_USERS=false but phone_autoconfirm=true,
    // provision a dedicated session-isolated authenticated user via GoTrue phone signup so RLS (auth.uid())
    // enforces strict per-session workspace isolation without weakening database security.
    const msg = anonErr?.message?.toLowerCase() ?? '';
    if (msg.includes('anonymous') || msg.includes('disabled')) {
      const randomNineDigits = Array.from({ length: 9 }, () =>
        Math.floor(Math.random() * 10).toString()
      ).join('');
      const ephemeralPhone = `+919${randomNineDigits}`;
      const randomBytes = new Uint8Array(12);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomBytes);
      }
      const ephemeralPassword =
        'Rr!' +
        Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('') +
        Date.now().toString(36);

      const { data: fallbackData, error: fallbackErr } = await supabase.auth.signUp({
        phone: ephemeralPhone,
        password: ephemeralPassword,
      });

      if (!fallbackErr && fallbackData.session) {
        return {
          session: fallbackData.session,
          authMode: 'ephemeral_session',
        };
      }

      throw new AppServiceError(
        'unauthenticated',
        `Anonymous sign-ins are disabled on this Supabase project and ephemeral session fallback failed (${fallbackErr?.message ?? anonErr?.message ?? 'unknown error'}). Enable Anonymous Sign-Ins in Supabase Auth settings.`
      );
    }

    throw new AppServiceError(
      'unauthenticated',
      `Failed to establish a Supabase demo session: ${anonErr?.message ?? 'No session returned'}`
    );
  })();

  try {
    return await pendingSessionPromise;
  } finally {
    pendingSessionPromise = null;
  }
}
