"use client";

import { useState } from "react";
import { LoginScreen } from "./LoginScreen";
import { SignupScreen } from "./SignupScreen";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";

type AuthView = "login" | "signup" | "forgot-password";

export function AuthScreen() {
  const [view, setView] = useState<AuthView>("login");

  switch (view) {
    case "signup":
      return (
        <SignupScreen
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
          onSwitchToSignup={() => setView("signup")}
          onSwitchToForgotPassword={() => setView("forgot-password")}
        />
      );
  }
}
