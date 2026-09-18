'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Search, ChevronLeft, ChevronRight, Loader2, PackageX, Pencil, X, FileSpreadsheet, Download, Upload, History, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { productsApi, type ManagedProduct, type CreateProductPayload, ApiError } from '@/lib/api';
import styles from './Productos.module.css';

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function stockClass(stock: number) {
  if (stock <= 0) return styles.stockOut;
  if (stock <= 3) return styles.stockLow;
  return styles.stockOk;
}

export default function ProductosPanelPage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showExcel, setShowExcel] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = useCallback(async (p: number, s: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await productsApi.listInternal(token, p, s);
      setProducts(data.results);
      setPages(data.pages);
      setCount(data.count);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(page, search); setSelected(new Set()); }, [page, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  const toggleVisibility = async (product: ManagedProduct) => {
    if (!token) return;
    const next = !product.show_in_catalog;
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, show_in_catalog: next } : p)));
    try {
      await productsApi.setVisibility(product.slug, next, token);
    } catch {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, show_in_catalog: !next } : p)));
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyBulkVisibility = async (show: boolean) => {
    if (!token || selected.size === 0) return;
    setBulkLoading(true);
    try {
      await productsApi.setVisibilityBulk(Array.from(selected), show, token);
      setProducts((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, show_in_catalog: show } : p)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aplicar el cambio.');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div>
      <div className={styles.head}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Productos</h1>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{count} en tu inventario</span>
      </div>

      <div className={styles.searchBar}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, flex: 1 }}>
          <input
            className={styles.searchInput}
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className={styles.btnGhost}><Search size={15} /></button>
        </form>
        <button className={styles.btnGhost} onClick={() => setShowExcel(true)}>
          <FileSpreadsheet size={15} /> Catálogo (Excel)
        </button>
        <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Nuevo producto
        </button>
      </div>

      {loading && <div className={styles.empty}><Loader2 size={24} className="spin" /></div>}
      {!loading && error && <div className={styles.empty}><PackageX size={28} /><p>{error}</p></div>}
      {!loading && !error && products.length === 0 && (
        <div className={styles.empty}><PackageX size={28} /><p>No tienes productos todavía.</p></div>
      )}

      {selected.size > 0 && (
        <div className={styles.bulkBar}>
          <span>{selected.size} producto{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          <div className={styles.bulkActions}>
            <button className={`${styles.bulkBtn} ${styles.bulkBtnShow}`} onClick={() => applyBulkVisibility(true)} disabled={bulkLoading}>
              {bulkLoading ? <Loader2 size={13} className="spin" /> : <Eye size={13} />} Mostrar en catálogo
            </button>
            <button className={`${styles.bulkBtn} ${styles.bulkBtnHide}`} onClick={() => applyBulkVisibility(false)} disabled={bulkLoading}>
              <EyeOff size={13} /> Ocultar del catálogo
            </button>
            <button className={styles.bulkBtnClear} onClick={() => setSelected(new Set())}>Cancelar</button>
          </div>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className={styles.table}>
          {products.map((p) => (
            <div key={p.id} className={styles.row}>
              <input
                type="checkbox"
                className={styles.rowCheckbox}
                checked={selected.has(p.id)}
                onChange={() => toggleSelected(p.id)}
              />
              <div className={styles.thumb}>
                {p.images[0] && <Image src={p.images[0].url} alt={p.name} fill sizes="52px" style={{ objectFit: 'cover' }} />}
              </div>
              <div>
                <div className={styles.name}>{p.name}</div>
                <div className={styles.sku}>SKU: {p.sku || '—'} · {p.images_count}/4 fotos</div>
              </div>
              <span className={styles.price}>{currency.format(Number(p.price))}</span>
              <span className={`${styles.stockTag} ${stockClass(p.stock)}`}>{p.stock} und.</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className={styles.visToggle} onClick={() => toggleVisibility(p)}>
                  <div className={`${styles.switch} ${p.show_in_catalog ? styles.on : ''}`}>
                    <div className={styles.switchDot} />
                  </div>
                  <span>{p.show_in_catalog ? 'Visible' : 'Oculto'}</span>
                </div>
                <Link href={`/panel/productos/${p.slug}`} className={styles.editBtn}>
                  <Pencil size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{page} / {pages}</span>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {showCreate && token && (
        <CreateProductModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(1, search); setPage(1); }}
        />
      )}
      {showExcel && token && (
        <ExcelCatalogModal
          token={token}
          onClose={() => setShowExcel(false)}
          onImported={() => load(page, search)}
        />
      )}
    </div>
  );
}

function ExcelCatalogModal({ token, onClose, onImported }: {
  token: string; onClose: () => void; onImported: () => void;
}) {
  const [tab, setTab] = useState<'importar' | 'historial'>('importar');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('append');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    skus_procesados: number; skus_encontrados: number; skus_no_encontrados: number; skus_faltantes: string[];
  } | null>(null);

  const [history, setHistory] = useState<{
    id: string; uploaded_by_name: string; file_name: string; mode_display: string;
    skus_found: number; skus_missing: number; created_at: string;
  }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await productsApi.historialImportaciones(token, 1);
      setHistory(data.results);
    } catch {
      // silencioso — el historial es informativo, no bloquea el flujo principal
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await productsApi.exportarExcel(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventario_catalogo.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    if (mode === 'replace' && !confirmReplace) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await productsApi.importarExcel(file, mode, token, confirmReplace);
      setResult(res);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo importar el archivo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.importModal}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Catálogo por Excel</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className={styles.importTabs}>
          <button className={`${styles.importTab} ${tab === 'importar' ? styles.on : ''}`} onClick={() => setTab('importar')}>
            Importar
          </button>
          <button
            className={`${styles.importTab} ${tab === 'historial' ? styles.on : ''}`}
            onClick={() => { setTab('historial'); loadHistory(); }}
          >
            Historial
          </button>
        </div>

        {tab === 'importar' && (
          <>
            <button className={styles.btnGhost} style={{ width: '100%', marginBottom: 16, justifyContent: 'center' }} onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
              Descargar plantilla con mi inventario actual
            </button>

            <label className={styles.dropZone}>
              <input
                type="file" accept=".xlsx,.xlsm" style={{ display: 'none' }}
                onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
              />
              <Upload size={22} color="var(--muted)" style={{ margin: '0 auto' }} />
              <p>{file ? 'Cambiar archivo' : 'Selecciona tu archivo .xlsx con la columna "sku"'}</p>
              {file && <p className={styles.fileName}>{file.name}</p>}
            </label>

            <div className={styles.modeRow}>
              <div className={`${styles.modeOption} ${mode === 'append' ? styles.selected : ''}`} onClick={() => { setMode('append'); setConfirmReplace(false); }}>
                <strong>Agregar (recomendado)</strong>
                <span>Suma estos SKUs a los ya visibles. Nunca oculta nada.</span>
              </div>
              <div className={`${styles.modeOption} ${mode === 'replace' ? styles.selected : ''}`} onClick={() => setMode('replace')}>
                <strong>Reemplazar todo</strong>
                <span>Oculta cualquier producto que no esté en este archivo</span>
              </div>
            </div>

            {mode === 'replace' && (
              <div className={styles.warningBox}>
                <AlertTriangle size={14} />
                <span>Esto va a <strong>ocultar del catálogo</strong> cualquier producto que no esté en el archivo, aunque hoy esté visible.</span>
              </div>
            )}
            {mode === 'replace' && (
              <label className={styles.confirmRow}>
                <input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} />
                <span>Entiendo y quiero reemplazar toda la selección actual</span>
              </label>
            )}

            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Para agregar o quitar un producto puntual del catálogo no hace falta Excel — márcalo en la
              lista y usa el botón &quot;Aplicar a seleccionados&quot;.
            </p>

            {error && <p className={styles.error}>{error}</p>}

            {result && (
              <div className={styles.resultBox}>
                <div className={styles.resultRow}><span>SKUs procesados</span><strong>{result.skus_procesados}</strong></div>
                <div className={styles.resultRow}>
                  <span><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> Encontrados y visibles ahora</span>
                  <strong>{result.skus_encontrados}</strong>
                </div>
                {result.skus_no_encontrados > 0 && (
                  <>
                    <div className={styles.resultRow}>
                      <span><AlertTriangle size={12} style={{ verticalAlign: -2, color: '#ff9f0a' }} /> No encontrados en tu inventario</span>
                      <strong style={{ color: '#ff9f0a' }}>{result.skus_no_encontrados}</strong>
                    </div>
                    <div className={styles.missingList}>{result.skus_faltantes.join(', ')}</div>
                  </>
                )}
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={onClose}>Cerrar</button>
              <button className={styles.btnPrimary} onClick={handleImport} disabled={loading || !file || (mode === 'replace' && !confirmReplace)}>
                {loading ? <Loader2 size={14} className="spin" /> : 'Importar'}
              </button>
            </div>
          </>
        )}

        {tab === 'historial' && (
          <div>
            {historyLoading && <Loader2 size={18} className="spin" />}
            {!historyLoading && history.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Todavía no hay importaciones registradas.</p>
            )}
            {!historyLoading && history.map((h) => (
              <div key={h.id} className={styles.historyRow}>
                <div>
                  <div>{h.file_name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                    {h.uploaded_by_name} · {h.mode_display} · {new Date(h.created_at).toLocaleString('es-CO')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ color: 'var(--y)' }}>{h.skus_found} ok</div>
                  {h.skus_missing > 0 && <div style={{ color: '#ff9f0a' }}>{h.skus_missing} faltantes</div>}
                </div>
              </div>
            ))}
            <div className={styles.modalActions} style={{ marginTop: 16 }}>
              <button className={styles.btnGhost} onClick={onClose} style={{ width: '100%' }}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateProductModal({ token, onClose, onCreated }: {
  token: string; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateProductPayload>({ name: '', sku: '', price: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await productsApi.create(form, token);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Nuevo producto</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className={styles.field}>
            <label htmlFor="name">Nombre</label>
            <input id="name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label htmlFor="sku">SKU</label>
              <input id="sku" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="price">Precio</label>
              <input id="price" type="number" min="0" step="0.01" required
                value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="description">Descripción</label>
            <textarea id="description" rows={3}
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
