import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceCampaign – AI Voice Campaign Platform",
  description: "AI-powered voice campaign simulator and call outcome extractor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
