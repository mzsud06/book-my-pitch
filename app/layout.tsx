import type { Metadata, Viewport } from "next";
import { GeistSans } from 'geist/font/sans';
import "./globals.css";

export const metadata: Metadata = {
  title: "BookMyPitch — Play football tonight at Globe Pitch",
  description: "Find a game at Globe Pitch, Bethnal Green, or start one in under a minute. No bank transfers — everyone pays automatically when the team is full.",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  openGraph: {
    title: "BookMyPitch — Play football tonight",
    description: "Find a game at Globe Pitch, Bethnal Green, or start one in under a minute. No bank transfers — everyone pays automatically when the team is full.",
    url: "https://bookmypitch.uk",
    type: "website",
    images: [
      {
        url: "https://bookmypitch.uk/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
