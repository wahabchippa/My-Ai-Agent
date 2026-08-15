"use client";

import { useState } from "react";
import { LoginScreen } from "./LoginScreen";
import { SignupScreen } from "./SignupScreen";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";

type AuthView = "login" | "signup" | "forgot-password";

export function AuthScreen() {
  const [view, setView] = useState<AuthView>("login");

  const handleSuccess = () => {
    // Refresh page to load authenticated state
    window.location.reload();
  };

  switch (view) {
    case "signup":
      return (
        <SignupScreen
          onSuccess={handleSuccess}
          onSwitchToLogin={() => setView("login")}
        />
      );
    case "forgot-password":
      return (
        <ForgotPasswordScreen
          onSwitchToLogin={() => setView("login")}
        />
      );
    default:
      return (
        <LoginScreen
          onSuccess={handleSuccess}
          onSwitchToSignup={() => setView("signup")}
          onSwitchToForgotPassword={() => setView("forgot-password")}
        />
      );
  }
}
