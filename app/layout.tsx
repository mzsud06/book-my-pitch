import type { Metadata, Viewport } from "next";
import { GeistSans } from 'geist/font/sans';
import localFont from 'next/font/local';
import CookieNotice from '@/components/CookieNotice';
import "./globals.css";

// Display face: Archivo (SIL OFL, bundled in /app/fonts) with its width axis,
// so headlines can run condensed (kit-number / scoreboard feel). Body stays Geist.
const archivo = localFont({
  src: './fonts/Archivo-wdth.woff2',
  variable: '--font-archivo',
  weight: '100 900',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
});

export const metadata: Metadata = {
  title: "BookMyPitch: Play football tonight in London",
  description: "Find a game near you or start one in under a minute. No bank transfers, everyone pays automatically when the team is full.",
  icons: {
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
    <html lang="en" className={`${GeistSans.variable} ${archivo.variable}`}>
      <body>
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
