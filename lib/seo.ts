import type { Metadata } from 'next';

/** Public site URL — set NEXT_PUBLIC_SITE_URL in production (e.g. https://ayahclip.com). */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://ayahclip.com';

export const siteConfig = {
  name: 'AyahClip',
  title: 'AyahClip – Quran Recitation Video Maker',
  tagline: 'Turn Quran recitations into beautiful, shareable video clips',
  description:
    'Create Quran recitation videos in minutes. Upload audio or video, record your voice, or pick a reciter and verse range. AyahClip auto-detects ayahs, adds Uthmani Arabic and English captions, and lets you style each segment before exporting MP4.',
  keywords: [
    'Quran recitation video',
    'Islamic video maker',
    'Quran captions',
    'Arabic subtitle generator',
    'Quran ayah overlay',
    'recitation video editor',
    'Quran clip maker',
    'Uthmani script video',
    'Quran translation overlay',
    'Islamic content creator',
    'record Quran recitation',
    'Quran video export',
  ],
  author: 'AyahClip',
  contactEmail: 'hassanrehan9975@gmail.com',
  locale: 'en_US',
  ogImage: '/logo.png',
  twitterHandle: undefined as string | undefined,
} as const;

export const publicRoutes = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly' as const, priority: 0.3 },
];

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function constructMetadata({
  title,
  description,
  path = '/',
  noIndex = false,
  image = siteConfig.ogImage,
}: {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
  image?: string;
} = {}): Metadata {
  const pageTitle = title ?? siteConfig.title;
  const pageDescription = description ?? siteConfig.description;
  const canonical = absoluteUrl(path);
  const imageUrl = image.startsWith('http') ? image : absoluteUrl(image);

  return {
    title: title ? { absolute: pageTitle } : { default: siteConfig.title, template: `%s | ${siteConfig.name}` },
    description: pageDescription,
    keywords: [...siteConfig.keywords],
    authors: [{ name: siteConfig.author, url: siteUrl }],
    creator: siteConfig.author,
    publisher: siteConfig.name,
    metadataBase: new URL(siteUrl),
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: siteConfig.locale,
      url: canonical,
      siteName: siteConfig.name,
      title: pageTitle,
      description: pageDescription,
      images: [
        {
          url: imageUrl,
          width: 512,
          height: 512,
          alt: `${siteConfig.name} – ${siteConfig.tagline}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [imageUrl],
      ...(siteConfig.twitterHandle ? { creator: siteConfig.twitterHandle } : {}),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
    category: 'technology',
    applicationName: siteConfig.name,
  };
}

export function webApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteConfig.name,
    url: siteUrl,
    description: siteConfig.description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Upload Quran recitation video or audio',
      'Record recitation in the browser',
      'Create clips from reciter and verse selection',
      'Automatic ayah detection and matching',
      'Uthmani Arabic and English translation overlays',
      'Per-ayah styling and timeline editing',
      'MP4 video export',
    ],
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteUrl,
    logo: absoluteUrl(siteConfig.ogImage),
    contactPoint: {
      '@type': 'ContactPoint',
      email: siteConfig.contactEmail,
      contactType: 'customer support',
    },
  };
}

export function faqJsonLd(
  items: { question: string; answer: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
