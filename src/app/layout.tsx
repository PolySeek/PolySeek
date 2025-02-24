import type { Metadata } from 'next';
import { Source_Code_Pro } from 'next/font/google';
import './globals.css';

const sourceCodePro = Source_Code_Pro({ 
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'PolySeek',
  description: 'Advanced Polymarket analysis with AI insights and social sentiment tracking.',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={sourceCodePro.className}>
        <div className="min-h-screen bg-black">
          {children}
        </div>
      </body>
    </html>
  );
} 