"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { AUTH_INPUT_CLASSES } from "@/components/auth/authStyles";
import { createClient } from "@/lib/supabase/client";

const FADE_TRANSITION = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setIsGoogleLoading(true);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${next}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    // If email confirmation is off, Supabase returns a session immediately.
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }

    setConfirmationSent(true);
    setIsSubmitting(false);
  }

  const content = confirmationSent ? (
    <motion.div
      key="confirmation"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={FADE_TRANSITION}
      className="text-center"
    >
      <div>
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-heading">
          Check your inbox
        </h1>
        <p className="mt-1.5 text-sm text-body">
          We sent a confirmation link to{" "}
          <span className="font-medium text-heading">{email}</span>. Click it to
          activate your account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          Back to login
        </Link>
      </div>
    </motion.div>
  ) : (
    <motion.div
      key="form"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={FADE_TRANSITION}
    >
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-heading">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-body">
          Start building your faceless page today.
        </p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl border border-hairline bg-surface py-3 text-sm font-semibold text-heading transition-colors hover:bg-app disabled:opacity-50 disabled:pointer-events-none"
        >
          {isGoogleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-xs font-medium text-subtle">
            or continue with email
          </span>
          <div className="h-px flex-1 bg-hairline" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-body">
            Email
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={AUTH_INPUT_CLASSES}
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-body">
            Password
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${AUTH_INPUT_CLASSES} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-subtle transition-colors hover:text-heading"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign up
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-subtle">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secured with 256-bit encryption
          </p>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-body">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline"
        >
          Log in
        </Link>
      </p>
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait" initial={false}>
      {content}
    </AnimatePresence>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
