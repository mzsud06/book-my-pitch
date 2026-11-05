import type { Metadata, Viewport } from "next";
import '@fontsource-variable/fraunces';
import '@fontsource-variable/figtree';
import CookieNotice from '@/components/CookieNotice';
import "./globals.css";

export const metadata: Metadata = {
  title: "BookMyPitch: Book a 5-a-side pitch in East London",
  description: "Pick a pitch, share one link, and your mates join. Nobody is charged until the game is full.",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
  openGraph: {
    title: "BookMyPitch: Book a 5-a-side pitch",
    description: "Pick a pitch, share one link, and your mates join. Nobody is charged until the game is full.",
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
  };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
