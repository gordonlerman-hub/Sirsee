import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let supabase = null;

function authRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export async function initAuth() {
  const response = await fetch("/api/config");
  const config = await response.json();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return false;
  }

  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      autoRefreshToken: true,
      persistSession: true
    }
  });

  await consumeAuthRedirect();
  return true;
}

export function isAuthConfigured() {
  return Boolean(supabase);
}

export async function consumeAuthRedirect() {
  if (!supabase) return null;

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const authError = params.get("error_description") || params.get("error");

  if (authError) {
    clearAuthRedirectParams();
    throw new Error(decodeURIComponent(authError.replace(/\+/g, " ")));
  }

  if (!code) return null;

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  clearAuthRedirectParams();
  if (error) throw error;
  return data.session?.user ?? null;
}

function clearAuthRedirectParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export async function getSessionUser() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error("Sign-in is not configured yet.");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectUrl(),
      skipBrowserRedirect: true
    }
  });
  if (error) throw normalizeAuthError(error);
  if (!data?.url) {
    throw new Error("Google sign-in is not enabled yet. Add Google OAuth credentials in Supabase.");
  }
  window.location.assign(data.url);
}

export async function signUpWithPassword(email, password) {
  if (!supabase) throw new Error("Sign-in is not configured yet.");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw normalizeAuthError(error);
  return data;
}

export async function signInWithPassword(email, password) {
  if (!supabase) throw new Error("Sign-in is not configured yet.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw normalizeAuthError(error);
  return data.user;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getAccessToken() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}

function normalizeAuthError(error) {
  const message = error?.message || "Could not sign you in.";
  if (/provider is not enabled/i.test(message)) {
    return new Error(
      "Google sign-in is not enabled yet. Run scripts/configure_google_auth.py after adding Google OAuth credentials to .env."
    );
  }
  return error instanceof Error ? error : new Error(message);
}
