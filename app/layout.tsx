import type {Metadata} from 'next';
import { Plus_Jakarta_Sans, Space_Grotesk, Manrope } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'], 
  variable: '--font-jakarta',
  weight: ['400', '700', '800']
});

const space = Space_Grotesk({ 
  subsets: ['latin'], 
  variable: '--font-space',
  weight: ['300', '500', '700']
});

const manrope = Manrope({ 
  subsets: ['latin'], 
  variable: '--font-manrope',
  weight: ['400', '500']
});

export const metadata: Metadata = {
  title: 'HIIT Timer - Cinematic Nocturne',
  description: 'Immersive fitness experience',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${space.variable} ${manrope.variable} dark`}>
      <body className="font-body bg-[#111125] text-[#e2e0fc] antialiased min-h-screen flex flex-col overflow-x-hidden selection:bg-[#ffb2b7]/30" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
