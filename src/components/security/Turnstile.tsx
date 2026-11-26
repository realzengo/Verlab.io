"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Cloudflare Turnstile bot check for sign-up, sign-in, password reset,
// password change and checkout.
//
// Off switch: leave NEXT_PUBLIC_TURNSTILE_SITE_KEY unset and the widget
// renders nothing and every form works as before. If you turn it off, also
// switch CAPTCHA off in Supabase (Authentication > Bot and Abuse Protection),
// or Supabase will reject sign-ups and sign-ins that arrive without a token.
//
// Tokens are single-use and expire after ~5 minutes: call consume() to take
// the current token for one request, which also fetches a fresh one.

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const TURNSTILE_ENABLED = TURNSTILE_SITE_KEY.length > 0;

/** Shown when someone submits before the check has produced a token. */
export const TURNSTILE_PENDING_MESSAGE = "One moment: we're still checking your browser. Please try again in a second.";

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile failed to load")));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * The widget itself. It stays invisible unless Cloudflare needs the visitor
 * to click ("interaction-only"). Changing `resetKey` replaces it with a
 * fresh widget, which is how a used token gets renewed.
 */
export function TurnstileWidget({
  onToken,
  resetKey = 0,
  className,
}: {
  onToken: (token: string | null) => void;
  resetKey?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const container = containerRef.current;
    if (!TURNSTILE_ENABLED || !container) return;
    let widgetId: string | undefined;
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId = turnstile.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: "interaction-only",
          size: "flexible",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [resetKey]);

  if (!TURNSTILE_ENABLED) return null;
  return <div ref={containerRef} className={cn("empty:hidden", className)} />;
}

/**
 * State for one form's widget:
 *   const turnstile = useTurnstile();
 *   <TurnstileWidget onToken={turnstile.setToken} resetKey={turnstile.resetKey} />
 *   if (!turnstile.ready) return setError(TURNSTILE_PENDING_MESSAGE);
 *   const captchaToken = turnstile.consume(); // undefined when Turnstile is off
 */
export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const consume = useCallback((): string | undefined => {
    if (!TURNSTILE_ENABLED) return undefined;
    const current = token ?? undefined;
    setToken(null);
    setResetKey((key) => key + 1);
    return current;
  }, [token]);

  return { token, setToken, resetKey, consume, ready: !TURNSTILE_ENABLED || token !== null };
}
