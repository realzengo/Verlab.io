"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import {
  AUTH_INPUT_CLASSES,
  AUTH_OAUTH_BUTTON_CLASSES,
  AUTH_PRIMARY_BUTTON_CLASSES,
} from "@/components/auth/authStyles";
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
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <h1 className="text-[30px] font-extrabold tracking-[-0.6px] text-heading">
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
        Back to sign in
      </Link>
    </motion.div>
  ) : (
    <motion.div
      key="form"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={FADE_TRANSITION}
    >
      <h1 className="text-center text-[30px] font-extrabold tracking-[-0.6px] text-heading">
        Create your Verlab account
      </h1>
      <p className="mt-1.5 text-center text-sm text-body">
        Start building your faceless page today.
      </p>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading}
        className={`${AUTH_OAUTH_BUTTON_CLASSES} mt-6`}
      >
        {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-hairline" />
        <span className="text-xs font-medium text-subtle">or sign up with email</span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-hairline" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <label className="sr-only" htmlFor="signup-email">
          Email address
        </label>
        <input
          id="signup-email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={AUTH_INPUT_CLASSES}
        />

        <label className="sr-only" htmlFor="signup-password">
          Password
        </label>
        <div className="relative">
          <input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Password"
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
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="-mt-1.5 text-xs text-subtle">Must be at least 6 characters.</p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className={`${AUTH_PRIMARY_BUTTON_CLASSES} mt-1`}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign Up"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-subtle">
        By signing up, you agree to our{" "}
        <Link href="/legal/terms" className="font-medium text-body hover:text-heading hover:underline">
          Terms of Use
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="font-medium text-body hover:text-heading hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-4 text-center text-sm text-body">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in here
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
