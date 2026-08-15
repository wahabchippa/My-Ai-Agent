"use client";

import { useState } from "react";
import { AuthLayout } from "./AuthLayout";
import { MailIcon, ArrowUpIcon, CheckCircleIcon } from "../ui/icons";
import { cn } from "@/utils/cn";

interface ForgotPasswordScreenProps {
  onSwitchToLogin?: () => void;
}

export function ForgotPasswordScreen({ onSwitchToLogin }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // Always show success to prevent email enumeration
      setSent(true);
    } catch (err) {
      setSent(true); // Still show success for security
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircleIcon size={32} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-text mb-2">Check your email</h1>
          <p className="text-sm text-text-secondary mb-6">
            If an account exists with <strong className="text-text">{email}</strong>,
            you'll receive a password reset link shortly.
          </p>
          <button onClick={onSwitchToLogin} className="btn btn-primary w-full">
            Back to login
          </button>
          <p className="mt-4 text-xs text-text-muted">
            Didn't receive the email? Check your spam folder or try again.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-text mb-1">Forgot password?</h1>
          <p className="text-sm text-text-secondary">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger-soft border border-danger/20 px-4 py-3 text-sm text-danger animate-fade-in">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Email address
            </label>
            <div className="relative">
              <MailIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input !pl-10"
                required
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email}
            className="btn btn-primary w-full py-3"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-void/20 border-t-void" />
                Sending...
              </div>
            ) : (
              "Send reset link"
            )}
          </button>
        </form>

        {/* Back to login */}
        <button
          onClick={onSwitchToLogin}
          className="mt-6 flex w-full items-center justify-center gap-2 text-sm text-text-secondary hover:text-text transition"
        >
          <ArrowUpIcon size={16} className="rotate-[-90deg]" />
          Back to login
        </button>
      </div>
    </AuthLayout>
  );
}
