/** @type {import('next').NextConfig} */
const nextConfig = {
  // Necesario para que el Dockerfile pueda copiar .next/standalone —
  // sin esto, el build de Docker falla buscando una carpeta que no existe.
  output: 'standalone',
  images: {
    remotePatterns: [
      // Dominio público custom conectado al bucket R2 (variable MEDIA_DOMAIN,
      // ej. media.tudominio.com) — se configura en Cloudflare R2 → Custom Domains.
      ...(process.env.MEDIA_DOMAIN
        ? [{ protocol: 'https', hostname: process.env.MEDIA_DOMAIN }]
        : []),
      // Subdominio gratuito que Cloudflare asigna por defecto a cada bucket R2
      // (útil mientras no se conecta un dominio propio, ej. en desarrollo/staging).
      { protocol: 'https', hostname: '**.r2.dev' },
      // Endpoint directo de R2 (por si se sirve sin dominio custom en algún entorno).
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      // Backend local en desarrollo (Django sirviendo /media/ directo con DEBUG=True).
      { protocol: 'http', hostname: 'localhost', port: '8000' },
      { protocol: 'http', hostname: 'web', port: '8000' },
    ],
  },
};

module.exports = nextConfig;
