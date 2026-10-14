import type { Metadata } from "next";
import "./globals.css";
import { MobileNavigation } from "@/components/MobileNavigation";

export const metadata: Metadata = {
  title: "Parent | Straight Line Academy",
  description: "Sign in to the Straight Line Academy parent portal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="min-h-dvh bg-background text-foreground antialiased"
      >
        {children}
        <MobileNavigation />
      </body>
    </html>
  );
}
