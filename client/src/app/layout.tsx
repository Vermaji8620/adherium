import type { Metadata } from 'next';
import Script from 'next/script';
import fs from 'node:fs';
import path from 'node:path';
import PrototypeFrame from '@/components/PrototypeFrame';
import './globals.css';

export const metadata: Metadata = {
  title: 'Adherium · Respiratory Monitoring',
  description: 'Local synthetic-data review workspace',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const markup = fs.readFileSync(
    path.join(process.cwd(), 'public/prototype/app-shell.html'),
    'utf8',
  );
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-initializer" strategy="beforeInteractive">
          {`(() => {
            let theme = null;
            try {
              theme = localStorage.getItem('adherium-theme');
            } catch {}
            if (theme !== 'light' && theme !== 'dark') {
              theme = matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
            }
            document.documentElement.dataset.theme = theme;
          })();`}
        </Script>
      </head>
      <body>
        <PrototypeFrame markup={markup} />
        {children}
      </body>
    </html>
  );
}
