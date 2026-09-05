import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "onlySign",
  description: "Gestisci i tuoi dispositivi e certificati.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}