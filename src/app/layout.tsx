import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexora — multi-model AI chat, agents & app builder",
  description:
    "Nexora — real AI models via the backend (OpenRouter and more), a master multi-agent, an app/website builder with live preview, and a code terminal.",
  icons: {
    icon: "/nexora-logo.png",
    apple: "/nexora-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf9f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // suppressHydrationWarning because the theme ("dark" class) is applied to
  // <html> on the client after mount.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://js.puter.com/v2/" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
