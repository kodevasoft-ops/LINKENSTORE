// src/lib/api.ts
// Cliente central de API — todas las llamadas al backend Django pasan por aquí.
// Nunca se llama a fetch() directamente desde un componente.

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = body?.message || body?.detail || 'Error de conexión con el servidor.';
    throw new ApiError(message, res.status, body?.details);
  }
  return body as T;
}

// ── Tipos que reflejan los serializers reales de Django ──────────────────
export interface Product {
  id: string;
  slug: string;
  name: string;
  price: string;
  compare_at: string | null;
  effective_price: string;
  on_promotion: boolean;
  image: string | null;
  area_name: string;
  brand_name: string;
  punto_name: string;
  punto_slug: string;
  stock: number;
  rating: number;
  reviews_count: number;
}

export interface ProductDetail extends Product {
  description: string;
  specs: Record<string, unknown>;
  images: { id: string; url: string }[];
  sku: string;
}

export interface PaginatedResponse<T> {
  count: number;
  pages: number;
  page: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
}

// ── Auth ───────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/v1/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { first_name: string; last_name: string; email: string; password: string; password_confirm: string }) =>
    request<LoginResponse>('/api/v1/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  me: (token: string) => request<CustomerProfile>('/api/v1/auth/me/', { token }),
  updateMe: (payload: { first_name?: string; last_name?: string; phone?: string }, token: string) =>
    request<CustomerProfile>('/api/v1/auth/me/', { method: 'PATCH', token, body: JSON.stringify(payload) }),
};

export interface CustomerProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: string;
  punto_name: string | null;
  created_at: string;
}

// ── Catálogo ───────────────────────────────────────────────────────────
export interface ProductFilters {
  search?: string;
  area?: string;
  brand?: string;
  price_min?: number;
  price_max?: number;
  in_stock?: boolean;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export const catalogApi = {
  list: (filters: ProductFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return request<PaginatedResponse<Product>>(`/api/v1/products/?${params.toString()}`);
  },
  detail: (slug: string) => request<ProductDetail>(`/api/v1/products/${slug}/`),
  featured: (limit = 8) => request<{ results: Product[] }>(`/api/v1/products/featured/?limit=${limit}`),
  related: (slug: string) => request<{ results: Product[] }>(`/api/v1/products/${slug}/related/`),
  areas: () => request(`/api/v1/areas/menu/`),
};

export interface Review {
  id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export const reviewsApi = {
  list: (slug: string) => request<{ results: Review[] }>(`/api/v1/products/${slug}/reviews/`),
  create: (slug: string, payload: { rating: number; comment: string }, token: string) =>
    request<Review>(`/api/v1/products/${slug}/reviews/`, { method: 'POST', token, body: JSON.stringify(payload) }),
};

export const wishlistApi = {
  add: (slug: string, token: string) =>
    request<{ detail: string }>(`/api/v1/products/${slug}/wishlist/`, { method: 'POST', token }),
};

// ── Checkout (sesión de pago — puede agrupar varios puntos) ──────────────
export interface CreateCheckoutPayload {
  items: { product_id: string; quantity: number }[];
  shipping_address: {
    full_name: string;
    phone: string;
    address: string;
    city: string;
    notes?: string;
    document_type: string;
    document_number: string;
  };
  requires_shipping?: boolean;
  coupon_code?: string;
}

export interface CreatedCheckoutSession {
  id: string;
  session_number: string;
  wompi_reference: string;
  total: string;
  status: string;
}

export interface WompiCheckoutParams {
  public_key: string;
  currency: string;
  amount_in_cents: number;
  reference: string;
  signature_integrity: string;
  redirect_url: string;
}

export const checkoutApi = {
  create: (payload: CreateCheckoutPayload, token: string) =>
    request<CreatedCheckoutSession>('/api/v1/orders/checkout-sessions/', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    }),
  getWompiParams: (sessionId: string, token: string) =>
    request<WompiCheckoutParams>(`/api/v1/orders/checkout-sessions/${sessionId}/checkout/`, { token }),
  myPurchases: (token: string, page = 1) =>
    request<PaginatedResponse<{
      id: string; session_number: string; status: string; status_display: string;
      total: string; created_at: string; paid_at: string | null;
      orders: SalesOrder[];
      envio: { carrier: string; guide_number: string; status_display: string } | null;
    }>>(`/api/v1/orders/checkout-sessions/?page=${page}`, { token }),
};

/** Construye la URL del Web Checkout hospedado de Wompi con los parámetros firmados por el backend. */
export function buildWompiCheckoutUrl(params: WompiCheckoutParams): string {
  const qs = new URLSearchParams({
    'public-key': params.public_key,
    currency: params.currency,
    'amount-in-cents': String(params.amount_in_cents),
    reference: params.reference,
    'signature:integrity': params.signature_integrity,
    'redirect-url': params.redirect_url,
  });
  return `https://checkout.wompi.co/p/?${qs.toString()}`;
}

// ── Rastreo público de envíos (Interrápidísimo vía InterSoft) ────────────
export interface TrackShipmentResult {
  encontrado: boolean;
  guide_number?: string;
  carrier?: string;
  datos?: Record<string, unknown>;
  error?: string;
}

export const shippingApi = {
  track: async (guideNumber: string): Promise<TrackShipmentResult> => {
    try {
      return await request<TrackShipmentResult>(
        `/api/v1/orders/rastrear-envio/?guia=${encodeURIComponent(guideNumber)}`
      );
    } catch (err) {
      if (err instanceof ApiError) {
        return { encontrado: false, error: err.message };
      }
      throw err;
    }
  },
};

// ── Panel de Vendedor/Administrador: ventas pendientes, confirmación TNS, envíos ──
export interface SalesOrder {
  id: string;
  order_number: string;
  checkout_session: string;
  requires_shipping: boolean;
  punto_name: string;
  status: string;
  status_display: string;
  customer_name: string;
  subtotal: string;
  total: string;
  tns_confirmed: boolean;
  tns_confirmation_ref: string;
  invoice_status: string;
  items: { id: string; product_name: string; unit_price: string; quantity: number; subtotal: string }[];
  created_at: string;
  paid_at: string | null;
}

export const salesApi = {
  ventasPendientes: (token: string, page = 1) =>
    request<PaginatedResponse<SalesOrder>>(`/api/v1/orders/ventas-pendientes/?page=${page}`, { token }),
  ventasFeed: (token: string, page = 1, puntoSlug?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (puntoSlug) params.set('punto', puntoSlug);
    return request<PaginatedResponse<SalesOrder>>(`/api/v1/orders/ventas-feed/?${params.toString()}`, { token });
  },
  confirmTns: (orderId: string, reference: string, token: string) =>
    request<SalesOrder>(`/api/v1/orders/${orderId}/confirm-tns/`, {
      method: 'POST', token, body: JSON.stringify({ reference }),
    }),
  crearEnvio: (
    payload: { checkout_session_id: string; guide_number: string; destination_city?: string },
    token: string
  ) =>
    request(`/api/v1/orders/envios/`, {
      method: 'POST', token, body: JSON.stringify(payload),
    }),
};

export interface EnvioListItem {
  id: string;
  carrier: string;
  guide_number: string;
  destination_city: string;
  status: string;
  status_display: string;
  created_at: string;
  updated_at: string;
}

export const enviosApi = {
  list: (token: string, page = 1) =>
    request<PaginatedResponse<EnvioListItem>>(`/api/v1/orders/envios/?page=${page}`, { token }),
};

// ── Panel de Administrador: gestión de productos del propio punto ────────
export interface ManagedProduct {
  id: string;
  slug: string;
  name: string;
  sku: string;
  price: string;
  compare_at: string | null;
  cost: string;
  stock: number;
  min_stock: number;
  is_active: boolean;
  is_featured: boolean;
  show_in_catalog: boolean;
  images: { id: string; url: string }[];
  images_count: number;
  brand: string | null;
  brand_name: string;
  punto_name: string;
  description: string;
}

export interface CreateProductPayload {
  name: string;
  sku?: string;
  description?: string;
  price: string;
  compare_at?: string | null;
  cost?: string;
  min_stock?: number;
  brand?: string | null;
  is_featured?: boolean;
}

export const productsApi = {
  listInternal: (token: string, page = 1, search = '') => {
    const params = new URLSearchParams({ internal: '1', page: String(page) });
    if (search) params.set('search', search);
    return request<PaginatedResponse<ManagedProduct>>(`/api/v1/products/?${params.toString()}`, { token });
  },
  detail: (slug: string, token: string) =>
    request<ManagedProduct>(`/api/v1/products/${slug}/?internal=1`, { token }),
  create: (payload: CreateProductPayload, token: string) =>
    request<ManagedProduct>('/api/v1/products/', { method: 'POST', token, body: JSON.stringify(payload) }),
  update: (slug: string, payload: Partial<CreateProductPayload>, token: string) =>
    request<ManagedProduct>(`/api/v1/products/${slug}/`, { method: 'PATCH', token, body: JSON.stringify(payload) }),
  setVisibility: (slug: string, show: boolean, token: string) =>
    request<{ show_in_catalog: boolean }>(`/api/v1/products/${slug}/visibilidad/`, {
      method: 'PATCH', token, body: JSON.stringify({ show_in_catalog: show }),
    }),
  setVisibilityBulk: (productIds: string[], show: boolean, token: string) =>
    request<{ actualizados: number; show_in_catalog: boolean }>('/api/v1/products/visibilidad-masiva/', {
      method: 'POST', token, body: JSON.stringify({ product_ids: productIds, show_in_catalog: show }),
    }),
  uploadImage: async (slug: string, file: File, token: string) => {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${BASE}/api/v1/products/${slug}/images/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(body?.message || body?.detail || 'No se pudo subir la imagen.', res.status);
    return body as ManagedProduct;
  },
  deleteImage: (slug: string, imageId: string, token: string) =>
    request<ManagedProduct>(`/api/v1/products/${slug}/images/${imageId}/`, { method: 'DELETE', token }),
  listBrands: () => request<{ id: string; name: string }[]>('/api/v1/brands/'),

  // ── Importación/exportación de Excel para curar el catálogo ────────────
  exportarExcel: async (token: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/api/v1/products/exportar-excel/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new ApiError('No se pudo generar el Excel.', res.status);
    return res.blob();
  },
  importarExcel: async (file: File, mode: 'replace' | 'append', token: string, confirmReplace = false) => {
    const form = new FormData();
    form.append('file', file);
    form.append('mode', mode);
    if (mode === 'replace') form.append('confirm_replace', confirmReplace ? 'true' : 'false');
    const res = await fetch(`${BASE}/api/v1/products/importar-excel/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(body?.detail || 'No se pudo importar el archivo.', res.status);
    return body as {
      id: string; mode: string; skus_procesados: number;
      skus_encontrados: number; skus_no_encontrados: number; skus_faltantes: string[];
    };
  },
  historialImportaciones: (token: string, page = 1) =>
    request<PaginatedResponse<{
      id: string; punto_name: string; uploaded_by_name: string; file_name: string;
      mode: string; mode_display: string; skus_found: number; skus_missing: number; created_at: string;
    }>>(`/api/v1/products/importaciones/?page=${page}`, { token }),
};

// ── Dashboard de Supervisor/SuperAdmin ────────────────────────────────────
export interface SupervisorDashboard {
  revenue_hoy: number;
  revenue_30d: number;
  ventas_trend_14d: { date: string; total: number; count: number }[];
  ventas_por_punto: { punto__name: string; punto__slug: string; total: number; count: number }[];
  productos_por_punto: { punto__name: string; total: number }[];
  users_by_role: Record<string, number>;
  ordenes_pendientes_tns: number;
  productos_stock_bajo: number;
  productos_sin_stock: number;
  reparaciones_activas: number;
}

export const analyticsApi = {
  supervisorDashboard: (token: string) =>
    request<SupervisorDashboard>('/api/v1/analytics/supervisor-dashboard/', { token }),
};

// ── Cupones (SuperAdmin) ───────────────────────────────────────────────
export interface CouponData {
  id: string;
  code: string;
  discount_pct: string;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  min_purchase_amount: string;
  created_at: string;
}

export const couponsApi = {
  list: (token: string, page = 1) =>
    request<PaginatedResponse<CouponData>>(`/api/v1/orders/coupons/?page=${page}`, { token }),
  create: (payload: Partial<CouponData>, token: string) =>
    request<CouponData>('/api/v1/orders/coupons/', { method: 'POST', token, body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<CouponData>, token: string) =>
    request<CouponData>(`/api/v1/orders/coupons/${id}/`, { method: 'PATCH', token, body: JSON.stringify(payload) }),
};

// ── Panel de Técnicos ──────────────────────────────────────────────────────
export interface RepairPart {
  id: string;
  name: string;
  quantity: number;
  unit_cost: string;
  subtotal: string;
  created_at: string;
}

export interface RepairImage {
  id: string;
  image: string;
  caption: string;
  created_at: string;
}

export interface RepairTicket {
  id: string;
  ticket_number: string;
  status: string;
  status_display: string;
  customer: string;
  customer_name: string;
  customer_phone: string;
  technician: string | null;
  technician_name: string;
  device_type: string;
  device_brand: string;
  device_model: string;
  serial_number: string;
  reported_issue: string;
  diagnosis_notes: string;
  technician_notes: string;
  estimated_cost: string | null;
  final_cost: string | null;
  parts_total: string;
  parts: RepairPart[];
  images: RepairImage[];
  received_at: string;
  updated_at: string;
  ready_at: string | null;
  delivered_at: string | null;
}

export interface RepairStats {
  total: number;
  received: number;
  diagnosis: number;
  in_progress: number;
  waiting_part: number;
  ready: number;
  delivered: number;
}

export interface RepairPublicTracking {
  ticket_number: string;
  status: string;
  status_display: string;
  device_type: string;
  device_brand: string;
  device_model: string;
  technician_name: string;
  received_at: string;
  ready_at: string | null;
  delivered_at: string | null;
}

export const repairsApi = {
  list: (token: string, page = 1, statusFilter?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter) params.set('status', statusFilter);
    return request<PaginatedResponse<RepairTicket>>(`/api/v1/repairs/?${params.toString()}`, { token });
  },
  detail: (id: string, token: string) =>
    request<RepairTicket>(`/api/v1/repairs/${id}/`, { token }),
  stats: (token: string) =>
    request<RepairStats>('/api/v1/repairs/stats/', { token }),
  updateStatus: (
    id: string,
    payload: { status?: string; diagnosis_notes?: string; technician_notes?: string; final_cost?: number },
    token: string
  ) =>
    request<RepairTicket>(`/api/v1/repairs/${id}/status/`, { method: 'PATCH', token, body: JSON.stringify(payload) }),
  assignTechnician: (id: string, technicianId: string, token: string) =>
    request<RepairTicket>(`/api/v1/repairs/${id}/assign/`, {
      method: 'PATCH', token, body: JSON.stringify({ technician_id: technicianId }),
    }),
  addPart: (id: string, part: { name: string; quantity: number; unit_cost: string }, token: string) =>
    request<RepairTicket>(`/api/v1/repairs/${id}/parts/`, { method: 'POST', token, body: JSON.stringify(part) }),
  addImage: async (id: string, file: File, caption: string, token: string) => {
    const form = new FormData();
    form.append('image', file);
    if (caption) form.append('caption', caption);
    const res = await fetch(`${BASE}/api/v1/repairs/${id}/images/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(body?.message || body?.detail || 'No se pudo subir la imagen.', res.status);
    return body as RepairTicket;
  },
  publicTracking: async (ticketNumber: string): Promise<RepairPublicTracking | null> => {
    try {
      return await request<RepairPublicTracking>(
        `/api/v1/repairs/public/?ticket=${encodeURIComponent(ticketNumber)}`
      );
    } catch (err) {
      if (err instanceof ApiError) return null;
      throw err;
    }
  },
  tecnicosDisponibles: (token: string) =>
    request<{ id: string; full_name: string; email: string }[]>('/api/v1/repairs/tecnicos-disponibles/', { token }),
};

// ── Módulo de WhatsApp (360dialog) — pausado hasta activación manual ─────
export interface WhatsAppConfigData {
  is_active: boolean;
  has_api_key: boolean;
  phone_display_name: string;
  webhook_basic_auth_user: string;
  respond_on_message: boolean;
  cart_reminder_enabled: boolean;
  cart_reminder_delay_minutes: number;
  followup_enabled: boolean;
  followup_delay_hours: number;
  order_confirmation_enabled: boolean;
  activated_by_name: string;
  activated_at: string | null;
  updated_at: string;
}

export const whatsappApi = {
  getConfig: (token: string) => request<WhatsAppConfigData>('/api/v1/whatsapp/config/', { token }),
  updateConfig: (payload: Partial<WhatsAppConfigData> & { api_key?: string }, token: string) =>
    request<WhatsAppConfigData>('/api/v1/whatsapp/config/', { method: 'PATCH', token, body: JSON.stringify(payload) }),
};
