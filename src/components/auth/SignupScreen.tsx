"use client";

import { useState } from "react";
import { AuthLayout } from "./AuthLayout";
import { UserIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, CheckIcon, AlertIcon } from "../ui/icons";
import { cn } from "@/utils/cn";

interface SignupScreenProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function SignupScreen({ onSuccess, onSwitchToLogin }: SignupScreenProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Password strength check
  const passwordChecks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&#^()_+\-=\[\]{}|;:,.<>]/.test(password),
  };
  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;
  const passwordMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!passwordMatch) {
      setError("Passwords do not match");
      return;
    }

    if (passwordStrength < 4) {
      setError("Password does not meet requirements");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Signup auto-logs in via server cookie — reload to enter the app
      window.location.reload();
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
              <MailIcon size={32} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-text mb-2">Check your email</h1>
          <p className="text-sm text-text-secondary mb-6">
            We've sent a verification link to <strong className="text-text">{email}</strong>.
            Click the link to verify your account.
          </p>
          <button onClick={onSwitchToLogin} className="btn btn-primary w-full">
            Back to login
          </button>
          <p className="mt-4 text-xs text-text-muted">
            Didn't receive the email? Check your spam folder or{" "}
            <button className="text-accent hover:underline">resend</button>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-text mb-1">Create an account</h1>
          <p className="text-sm text-text-secondary">
            Get started with Nexora for free
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger-soft border border-danger/20 px-4 py-3 text-sm text-danger animate-fade-in flex items-center gap-2">
              <AlertIcon size={16} />
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Full name
            </label>
            <div className="relative">
              <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="input !pl-10"
                required
                minLength={2}
                disabled={loading}
              />
            </div>
          </div>

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
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <div className="relative">
              <LockIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input !pl-10 !pr-10"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition"
              >
                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>

            {/* Password strength */}
            {password && (
              <div className="mt-2 space-y-2 animate-fade-in">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition",
                        i <= passwordStrength
                          ? passwordStrength <= 2 ? "bg-danger" : passwordStrength <= 3 ? "bg-warning" : "bg-success"
                          : "bg-subtle"
                      )}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {[
                    { key: "length", label: "8+ characters" },
                    { key: "lowercase", label: "Lowercase" },
                    { key: "uppercase", label: "Uppercase" },
                    { key: "number", label: "Number" },
                    { key: "special", label: "Special char" },
                  ].map((check) => (
                    <div
                      key={check.key}
                      className={cn(
                        "flex items-center gap-1",
                        passwordChecks[check.key as keyof typeof passwordChecks] ? "text-success" : "text-text-muted"
                      )}
                    >
                      <CheckIcon size={12} />
                      {check.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Confirm password
            </label>
            <div className="relative">
              <LockIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  "input pl-10",
                  confirmPassword && !passwordMatch && "border-danger focus:border-danger"
                )}
                required
                disabled={loading}
              />
              {confirmPassword && (
                <div className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2",
                  passwordMatch ? "text-success" : "text-danger"
                )}>
                  {passwordMatch ? <CheckIcon size={18} /> : <AlertIcon size={18} />}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !name || !email || !password || !passwordMatch || passwordStrength < 4}
            className="btn btn-primary w-full py-3"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-void/20 border-t-void" />
                Creating account...
              </div>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {/* Terms */}
        <p className="mt-4 text-center text-xs text-text-muted">
          By signing up, you agree to our{" "}
          <a href="#" className="text-accent hover:underline">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="text-accent hover:underline">Privacy Policy</a>
        </p>

        {/* Login Link */}
        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            className="text-accent hover:text-accent-hover font-medium transition"
          >
            Sign in
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
