'use client';
import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';

export default function Dialog({
  children,
  title,
  onClose,
  kind = 'panel',
  className = '',
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  kind?: 'panel' | 'modal';
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    ref.current?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${kind} ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X size={23} weight="light" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
