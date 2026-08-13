'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open:      boolean;
  onClose:   () => void;
  title?:    string;
  children:  React.ReactNode;
  footer?:   React.ReactNode;
  maxWidth?: number;
}

export default function Modal({ open, onClose, title, children, footer, maxWidth = 520 }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <X size={18} color="var(--text-secondary)" />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
