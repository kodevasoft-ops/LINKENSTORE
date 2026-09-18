# ⚠️ ESTE ARCHIVO ES NUEVO — nunca tuve acceso al Dockerfile original de tu
# frontend. Es una construcción estándar de Next.js en modo standalone.
# Compáralo con el que ya exista en tu repo antes de reemplazarlo.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Necesarias en build-time para que Next.js las incruste en el bundle del cliente
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WOMPI_PUBLIC_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WOMPI_PUBLIC_KEY=$NEXT_PUBLIC_WOMPI_PUBLIC_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system nodejs && adduser --system --ingroup nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
