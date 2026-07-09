import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardrails Console",
  description: "Image + caption content safety checker, powered by NVIDIA Nemotron.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
