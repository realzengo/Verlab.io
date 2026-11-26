"use client";

import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { TURNSTILE_PENDING_MESSAGE, TurnstileWidget, useTurnstile } from "@/components/security/Turnstile";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import {
  AUTH_INPUT_CLASSES,
  AUTH_LABEL_CLASSES,
  AUTH_OAUTH_BUTTON_CLASSES,
  AUTH_SIGNIN_BUTTON_CLASSES,
} from "@/components/auth/authStyles";
import { createClient } from "@/lib/supabase/client";
import { useResetOnPageRestore } from "@/lib/hooks/useResetOnPageRestore";
import { EMAIL_MAX, isValidEmail } from "@/lib/validation";

const FADE_TRANSITION = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

type View = "login" | "forgot" | "forgot-sent";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const turnstile = useTurnstile();
  const posthog = usePostHog();

  useResetOnPageRestore(() => {
    setIsSubmitting(false);
    setIsGoogleLoading(false);
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!turnstile.ready) {
      setError(TURNSTILE_PENDING_MESSAGE);
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: turnstile.consume() },
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    posthog?.capture("login_succeeded", { method: "email" });
    router.push(next);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    setIsGoogleLoading(true);
    posthog?.capture("google_auth_started", { context: "login" });

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsGoogleLoading(false);
    }
  }

  async function handleForgotPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!turnstile.ready) {
      setError(TURNSTILE_PENDING_MESSAGE);
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/update-password")}`,
      captchaToken: turnstile.consume(),
    });

    if (resetError) {
      setError(resetError.message);
      setIsSubmitting(false);
      return;
    }

    setView("forgot-sent");
    setIsSubmitting(false);
  }

  let content: ReactNode;

  if (view === "forgot-sent") {
    content = (
      <motion.div
        key="forgot-sent"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={FADE_TRANSITION}
        className="text-center"
      >
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#335cff]/10 text-[#335cff]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-heading">
          Check your inbox
        </h1>
        <p className="mt-2 text-[15px] text-body">
          We sent a password reset link to{" "}
          <span className="font-medium text-heading">{email}</span>.
        </p>
        <button
          type="button"
          onClick={() => setView("login")}
          className="mt-6 inline-flex text-sm font-semibold text-[#335cff] hover:underline"
        >
          Back to sign in
        </button>
      </motion.div>
    );
  } else if (view === "forgot") {
    content = (
      <motion.div
        key="forgot"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={FADE_TRANSITION}
      >
        <button
          type="button"
          onClick={() => {
            setError(null);
            setView("login");
          }}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-heading"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <h1 className="text-center text-[28px] font-bold leading-tight tracking-[-0.025em] text-heading">
          Reset your password
        </h1>
        <p className="mt-2 text-center text-[15px] text-body">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleForgotPassword} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="forgot-email" className={AUTH_LABEL_CLASSES}>
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              maxLength={EMAIL_MAX}
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={AUTH_INPUT_CLASSES}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <TurnstileWidget onToken={turnstile.setToken} resetKey={turnstile.resetKey} />

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${AUTH_SIGNIN_BUTTON_CLASSES} mt-2`}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
          </button>
        </form>
      </motion.div>
    );
  } else {
    content = (
      <motion.div
        key="login"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={FADE_TRANSITION}
      >
        <h1 className="text-center text-[30px] font-bold leading-tight tracking-[-0.03em] text-heading">
          Sign in to Verlab
        </h1>
        <p className="mt-2 text-center text-[15px] text-body">
          Welcome back. Pick up where you left off.
        </p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className={`${AUTH_OAUTH_BUTTON_CLASSES} mt-8`}
        >
          {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-xs font-medium uppercase text-subtle">or</span>
          <div className="h-px flex-1 bg-hairline" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className={AUTH_LABEL_CLASSES}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              maxLength={EMAIL_MAX}
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={AUTH_INPUT_CLASSES}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="login-password" className={AUTH_LABEL_CLASSES}>
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setView("forgot");
                }}
                className="text-[13px] font-medium text-[#335cff] hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${AUTH_INPUT_CLASSES} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-subtle transition-colors hover:bg-zinc-100 hover:text-heading"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <TurnstileWidget onToken={turnstile.setToken} resetKey={turnstile.resetKey} />

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${AUTH_SIGNIN_BUTTON_CLASSES} mt-2`}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-body">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-[#335cff] hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {content}
    </AnimatePresence>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
