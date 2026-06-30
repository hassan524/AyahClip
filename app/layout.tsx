import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AyahClip – Quran Recitation Video Maker',
  description: 'Upload any Quran recitation video. AI auto-detects ayahs and adds Arabic + English overlay.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;500;700&family=Caveat:wght@400;700&family=Cinzel:wght@400;700&family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=El+Messiri:wght@400;700&family=Harmattan:wght@400;700&family=Inter:wght@400;500;600;700&family=Kufam:wght@400;700&family=Lalezar&family=Lateef&family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;700&family=Open+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Outfit:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Poppins:ital,wght@0,400;0,700;1,400;1,700&family=Quicksand:wght@400;700&family=Reem+Kufi:wght@400;700&family=Roboto:wght@400;700&family=Scheherazade+New:wght@400;700&family=Tajawal:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: 'Inter, sans-serif' }}>{children}</body>
    </html>
  );
}
