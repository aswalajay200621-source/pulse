import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { SplashScreen } from "@/components/shared/splash-screen";
import { TopProgressBar } from "@/components/shared/top-progress-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulse — Application Health & Security Monitoring",
  description: "Keep your app alive and safe after launch, in plain language. Monitor uptime, detect security problems, and keep applications healthy.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Radio+Canada+Big:wght@400;500;600;700&family=Red+Hat+Text:wght@500;600;700&family=Source+Code+Pro:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground" style={{ fontFamily: '"Radio Canada Big", sans-serif' }}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TopProgressBar />
          <SplashScreen />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
