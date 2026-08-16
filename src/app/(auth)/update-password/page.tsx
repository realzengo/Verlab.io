"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";
import {
  AUTH_INPUT_CLASSES,
  AUTH_PRIMARY_BUTTON_CLASSES,
} from "@/components/auth/authStyles";
import { createClient } from "@/lib/supabase/client";

function UpdatePasswordForm() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    }

    setDone(true);
    setIsSubmitting(false);
    setTimeout(() => {
      router.push("/app");
      router.refresh();
    }, 1500);
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#0075ff]/10 text-[#0075ff]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.6px] text-heading">
          Password updated
        </h1>
        <p className="mt-1.5 text-sm text-body">Taking you to your dashboard&hellip;</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-center text-[30px] font-extrabold tracking-[-0.6px] text-heading">
        Set a new password
      </h1>
      <p className="mt-1.5 text-center text-sm text-body">
        Choose a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5">
        <label className="sr-only" htmlFor="new-password">
          New password
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="New password"
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

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className={AUTH_PRIMARY_BUTTON_CLASSES}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={null}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
