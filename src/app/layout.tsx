import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quantiv | Inventory & Order Management',
  description: 'A high-precision inventory and order management system with built-in unit conversion.',
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
      </body>
    </html>
  );
}
