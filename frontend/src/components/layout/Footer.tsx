import Link from 'next/link';
import { MapPin, Phone, Mail, MessageCircle, Instagram } from 'lucide-react';
import styles from './Footer.module.css';

const PUNTOS = [
  { label: 'Telefonía', slug: 'telefonia' },
  { label: 'Repuestos', slug: 'repuestos' },
  { label: 'Máquinas', slug: 'maquinas' },
  { label: 'Accesorios', slug: 'accesorios' },
  { label: 'Hogar', slug: 'hogar' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.ftrMain}`}>
        <div className={styles.ftrGrid}>
          <div>
            <div className={styles.brandName}>
              Celu<em>Fénix</em>
            </div>
            <p className={styles.brandDesc}>
              Smartphones, repuestos, máquinas, accesorios y hogar — con soporte técnico
              y seguimiento de compra en un solo lugar.
            </p>
            <div className={styles.socs}>
              <a href="#" className={styles.soc} aria-label="Instagram">
                <Instagram size={15} />
              </a>
              <a href="#" className={styles.soc} aria-label="WhatsApp">
                <MessageCircle size={15} />
              </a>
            </div>
          </div>

          <div className={styles.ftrCol}>
            <div className={styles.colHead}>Categorías</div>
            {PUNTOS.map((p) => (
              <Link key={p.slug} href={`/productos?punto=${p.slug}`} className={styles.link}>
                {p.label}
              </Link>
            ))}
          </div>

          <div className={styles.ftrCol}>
            <div className={styles.colHead}>Empresa</div>
            <span className={styles.link}>Quiénes somos</span>
            <span className={styles.link}>Garantías</span>
            <span className={styles.link}>Trabaja con nosotros</span>
          </div>

          <div className={styles.ftrCol}>
            <div className={styles.colHead}>Servicios</div>
            <Link href="/reparaciones" className={styles.link}>Rastrear reparación</Link>
            <span className={styles.link}>Rastrear envío</span>
            <span className={styles.link}>Preguntas frecuentes</span>
          </div>

          <div className={styles.ftrCol}>
            <div className={styles.colHead}>Contacto</div>
            <div className={styles.contactItem}>
              <MapPin size={14} className={styles.contactIcon} />
              <span className={styles.contactText}>Bogotá, Colombia</span>
            </div>
            <div className={styles.contactItem}>
              <Phone size={14} className={styles.contactIcon} />
              <span className={styles.contactText}>+57 300 000 0000</span>
            </div>
            <div className={styles.contactItem}>
              <Mail size={14} className={styles.contactIcon} />
              <span className={styles.contactText}>contacto@celufenix.com</span>
            </div>
            <a href="https://wa.me/573000000000" target="_blank" rel="noopener noreferrer" className={styles.waBtn}>
              <MessageCircle size={14} /> Escríbenos
            </a>
          </div>
        </div>
      </div>

      <div className={`wrap ${styles.ftrBot}`}>
        <div className={styles.payRow}>
          <span className={styles.payLabel}>Pagos seguros con</span>
          <span className={styles.payBadge}>PSE</span>
          <span className={styles.payBadge}>Nequi</span>
          <span className={styles.payBadge}>Daviplata</span>
          <span className={styles.payBadge}>Efecty</span>
          <span className={styles.payBadge}>Visa</span>
          <span className={styles.payBadge}>Mastercard</span>
        </div>
        <p className={styles.copy}>© {year} CeluFénix. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
