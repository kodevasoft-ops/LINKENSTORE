'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { ArrowLeft, ImagePlus, X, Loader2, Save, PackageX } from 'lucide-react';
import { productsApi, type ManagedProduct, ApiError } from '@/lib/api';
import styles from './EditProduct.module.css';

const MAX_IMAGES = 4;

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug);
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const [product, setProduct] = useState<ManagedProduct | null>(null);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [productData, brandsData] = await Promise.all([
        productsApi.detail(slug, token),
        productsApi.listBrands(),
      ]);
      setProduct(productData);
      setBrands(brandsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el producto.');
    } finally {
      setLoading(false);
    }
  }, [slug, token]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!product || !token) return;
    setSaving(true);
    setError(null);
    try {
      await productsApi.update(slug, {
        name: product.name,
        sku: product.sku,
        price: product.price,
        compare_at: product.compare_at || null,
        cost: product.cost,
        min_stock: product.min_stock,
        description: product.description,
        brand: product.brand,
        is_featured: product.is_featured,
      }, token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!token || !product) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await productsApi.uploadImage(slug, file, token);
      setProduct(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!token) return;
    try {
      const updated = await productsApi.deleteImage(slug, imageId, token);
      setProduct(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la imagen.');
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><Loader2 size={24} className="spin" /></div>;
  if (error && !product) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}><PackageX size={28} /><p>{error}</p></div>;
  if (!product) return null;

  const emptySlots = MAX_IMAGES - product.images.length;

  return (
    <div>
      <button className={styles.back} onClick={() => router.push('/panel/productos')}>
        <ArrowLeft size={15} /> Volver a productos
      </button>
      <h1 className={styles.title}>{product.name}</h1>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Fotos — {product.images.length}/{MAX_IMAGES}</div>
        <div className={styles.imagesGrid}>
          {product.images.map((img) => (
            <div key={img.id} className={styles.imageSlot}>
              <Image src={img.url} alt={product.name} fill sizes="150px" style={{ objectFit: 'cover' }} />
              <button className={styles.removeBtn} onClick={() => handleDeleteImage(img.id)} aria-label="Eliminar foto">
                <X size={14} />
              </button>
            </div>
          ))}
          {Array.from({ length: Math.max(emptySlots, 0) }).map((_, i) => (
            <div
              key={i}
              className={`${styles.emptySlot} ${uploading ? styles.disabled : ''}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 size={20} className="spin" /> : <ImagePlus size={20} />}
              <span>Agregar foto</span>
            </div>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = '';
          }}
        />
        <p className={styles.limitNote}>Máximo {MAX_IMAGES} fotos por producto. JPG, PNG o WebP.</p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Información</div>
        <div className={styles.field}>
          <label htmlFor="name">Nombre</label>
          <input id="name" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} />
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label htmlFor="sku">SKU</label>
            <input id="sku" value={product.sku} onChange={(e) => setProduct({ ...product, sku: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label htmlFor="brand">Marca</label>
            <select
              id="brand"
              value={product.brand || ''}
              onChange={(e) => setProduct({ ...product, brand: e.target.value || null })}
            >
              <option value="">Sin marca</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="description">Descripción</label>
          <textarea id="description" rows={4} value={product.description} onChange={(e) => setProduct({ ...product, description: e.target.value })} />
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
          Guardar cambios
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Precios y stock</div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label htmlFor="price">Precio de venta</label>
            <input id="price" type="number" min="0" step="0.01" value={product.price} onChange={(e) => setProduct({ ...product, price: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label htmlFor="compare_at">Precio antes de descuento (opcional)</label>
            <input id="compare_at" type="number" min="0" step="0.01" value={product.compare_at || ''}
              onChange={(e) => setProduct({ ...product, compare_at: e.target.value || null })} />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label htmlFor="cost">Costo interno</label>
            <input id="cost" type="number" min="0" step="0.01" value={product.cost}
              onChange={(e) => setProduct({ ...product, cost: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label htmlFor="min_stock">Stock mínimo (alerta)</label>
            <input id="min_stock" type="number" min="0" value={product.min_stock}
              onChange={(e) => setProduct({ ...product, min_stock: parseInt(e.target.value, 10) || 0 })} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          Stock actual: <strong style={{ color: 'var(--txt)' }}>{product.stock} unidades</strong> — este valor se
          sincroniza automáticamente desde TNS y no se edita aquí manualmente.
        </p>
        <div className={styles.checkboxRow}>
          <input
            type="checkbox" id="is_featured" checked={product.is_featured}
            onChange={(e) => setProduct({ ...product, is_featured: e.target.checked })}
          />
          <label htmlFor="is_featured">Mostrar como producto destacado en la página de inicio</label>
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
