import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let supabase = null;

const OAUTH_POPUP_FEATURES = "popup=yes,width=520,height=700,left=100,top=100";
const OAUTH_POLL_MS = 250;
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

function authRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export function isEmbeddedAuthBrowser() {
  const ua = navigator.userAgent || "";
  // Only Cursor / Electron preview browsers block Google OAuth reliably.
  return /Electron|Cursor/i.test(ua);
}

export function externalAuthAppUrl() {
  return authRedirectUrl();
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
  window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
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

export async function getGoogleOAuthUrl() {
  if (!supabase) throw new Error("Sign-in is not configured yet.");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectUrl(),
      skipBrowserRedirect: true,
      queryParams: {
        prompt: "select_account"
      }
    }
  });
  if (error) throw normalizeAuthError(error);
  if (!data?.url) {
    throw new Error("Google sign-in is not enabled yet. Add Google OAuth credentials in Supabase.");
  }
  return data.url;
}

function decodeOAuthError(value) {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

function waitForOAuthPopup(popup) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const redirectOrigin = authRedirectUrl();

    const timer = window.setInterval(async () => {
      if (Date.now() - startedAt > OAUTH_TIMEOUT_MS) {
        window.clearInterval(timer);
        try {
          popup.close();
        } catch {
          // Ignore popup close failures.
        }
        reject(new Error("Google sign-in timed out. Try again."));
        return;
      }

      if (popup.closed) {
        window.clearInterval(timer);
        try {
          const user = await getSessionUser();
          if (user) {
            resolve(user);
            return;
          }
          reject(new Error("Google sign-in was canceled."));
        } catch (error) {
          reject(error);
        }
        return;
      }

      let href = "";
      try {
        href = popup.location.href;
      } catch {
        return;
      }

      if (!href.startsWith(redirectOrigin)) {
        return;
      }

      const params = new URL(href).searchParams;
      const authError = params.get("error_description") || params.get("error");
      if (authError) {
        window.clearInterval(timer);
        popup.close();
        reject(new Error(decodeOAuthError(authError)));
        return;
      }

      const code = params.get("code");
      if (!code) {
        return;
      }

      window.clearInterval(timer);
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        popup.close();
        if (error) throw error;
        resolve(data.session?.user ?? null);
      } catch (error) {
        try {
          popup.close();
        } catch {
          // Ignore popup close failures.
        }
        reject(error);
      }
    }, OAUTH_POLL_MS);
  });
}

export async function signInWithGoogle() {
  if (isEmbeddedAuthBrowser()) {
    throw new Error(
      "Google sign-in does not work in Cursor's preview browser. Open sirseegift.com on your phone or in your usual browser, then try again."
    );
  }

  // Open the popup synchronously so mobile browsers do not block it.
  const popup = window.open("about:blank", "sirsee-google-auth", OAUTH_POPUP_FEATURES);
  const oauthUrl = await getGoogleOAuthUrl();

  if (!popup) {
    window.location.replace(oauthUrl);
    return consumeAuthRedirect();
  }

  try {
    popup.location.href = oauthUrl;
  } catch (error) {
    popup.close();
    throw error;
  }

  return waitForOAuthPopup(popup);
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
