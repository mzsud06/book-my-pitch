import type { Metadata, Viewport } from "next";
import { GeistSans } from 'geist/font/sans';
import CookieNotice from '@/components/CookieNotice';
import "./globals.css";

export const metadata: Metadata = {
  title: "BookMyPitch: Play football tonight in London",
  description: "Find a game near you or start one in under a minute. No bank transfers, everyone pays automatically when the team is full.",
  icons: {
    // favicon.png/.ico have a solid black background (matching --black) —
    // logo.png itself stays transparent since it's also used inline on the
    // nav bar, where transparency blends correctly; a transparent favicon
    // instead composites to white in most browsers/search results, making
    // the ball nearly invisible at small sizes.
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
  openGraph: {
    title: "BookMyPitch: Play football tonight",
    description: "Find a game near you or start one in under a minute. No bank transfers, everyone pays automatically when the team is full.",
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
      <body>
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
