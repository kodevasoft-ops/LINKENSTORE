import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://tudominio.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // El panel interno y el checkout nunca deben indexarse en buscadores.
        disallow: ['/panel/', '/checkout/', '/cuenta/', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
