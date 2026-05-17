import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookMyPitch — Fill the team. Book the pitch.",
  description: "Pick a slot at Globe Pitch, share the link, and when 10 players join everyone pays automatically. No bank transfers. No chasing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
