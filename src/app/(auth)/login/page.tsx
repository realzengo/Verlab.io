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
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import {
  AUTH_INPUT_CLASSES,
  AUTH_OAUTH_BUTTON_CLASSES,
  AUTH_PRIMARY_BUTTON_CLASSES,
  AUTH_SIGNIN_BUTTON_CLASSES,
} from "@/components/auth/authStyles";
import { createClient } from "@/lib/supabase/client";
import { EMAIL_MAX, isValidEmail } from "@/lib/validation";

const FADE_TRANSITION = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

type View = "login" | "forgot" | "forgot-sent";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

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

  async function handleForgotPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/update-password")}`,
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
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#0075ff]/10 text-[#0075ff]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.6px] text-heading">
          Check your inbox
        </h1>
        <p className="mt-1.5 text-sm text-body">
          We sent a password reset link to{" "}
          <span className="font-medium text-heading">{email}</span>.
        </p>
        <button
          type="button"
          onClick={() => setView("login")}
          className="mt-6 inline-flex text-sm font-semibold text-[#0075ff] hover:underline"
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

        <h1 className="text-center text-[30px] font-extrabold tracking-[-0.6px] text-heading">
          Reset your password
        </h1>
        <p className="mt-1.5 text-center text-sm text-body">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleForgotPassword} className="mt-6 flex flex-col gap-3.5">
          <label className="sr-only" htmlFor="forgot-email">
            Email address
          </label>
          <input
            id="forgot-email"
            type="email"
            required
            maxLength={EMAIL_MAX}
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={AUTH_INPUT_CLASSES}
          />

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className={AUTH_PRIMARY_BUTTON_CLASSES}>
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
        <h1 className="text-center text-[30px] font-extrabold tracking-[-0.6px] text-heading">
          Sign in to Verlab
        </h1>
        <p className="mt-1.5 text-center text-sm text-body">
          Welcome back! Sign in to your account below.
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
          <span className="text-xs font-medium text-subtle">or sign in with email</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-hairline" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className="sr-only" htmlFor="login-email">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            required
            maxLength={EMAIL_MAX}
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={AUTH_INPUT_CLASSES}
          />

          <label className="sr-only" htmlFor="login-password">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
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

          <button
            type="button"
            onClick={() => {
              setError(null);
              setView("forgot");
            }}
            className="self-start text-sm font-semibold text-[#0075ff] hover:underline"
          >
            Forgot password?
          </button>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className={AUTH_SIGNIN_BUTTON_CLASSES}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-body">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-[#0075ff] hover:underline">
            Sign up here
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
