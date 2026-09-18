import type { MetadataRoute } from 'next';
import { catalogApi } from '@/lib/api';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tudominio.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/productos`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/reparaciones`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // El sitemap de productos se arma en vivo contra el catálogo real — nunca
  // queda desactualizado ni incluye productos ocultos (show_in_catalog=False),
  // porque reutiliza el mismo endpoint público que ya filtra correctamente.
  // Recorre todas las páginas — el catálogo puede tener más de una "página" de 100.
  try {
    const productRoutes: MetadataRoute.Sitemap = [];
    let page = 1;
    let totalPages = 1;
    do {
      const data = await catalogApi.list({ ordering: '-created_at', page, page_size: 100 });
      totalPages = data.pages;
      productRoutes.push(...data.results.map((p) => ({
        url: `${BASE}/productos/${p.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })));
      page += 1;
    } while (page <= totalPages && page <= 50); // tope de seguridad: 5.000 productos

    return [...staticRoutes, ...productRoutes];
  } catch {
    // Si el backend no responde al momento de generar el sitemap, se
    // entrega igual el sitemap estático — nunca debe romper el build.
    return staticRoutes;
  }
}
