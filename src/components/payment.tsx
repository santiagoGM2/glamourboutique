'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Check, Copy, WhatsappLogo } from '@phosphor-icons/react';
import { PAYMENT_KEY } from '@/lib/format';

export default function Payment({
  canPay,
  whatsappUrl,
}: {
  canPay: boolean;
  whatsappUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('Llave de transferencia');
  async function copyKey() {
    try {
      await navigator.clipboard.writeText(PAYMENT_KEY);
      setCopied(true);
      setError('');
    } catch {
      setError('Puedes seleccionar y copiar la llave que aparece arriba.');
    }
  }
  const nextUrl = whatsappUrl
    ? (() => {
        const url = new URL(whatsappUrl);
        url.searchParams.set(
          'text',
          `${url.searchParams.get('text') || ''}\nMétodo de pago elegido: ${method}.\nAdjuntaré el soporte de transferencia en este chat cuando realice el pago.`,
        );
        return url.toString();
      })()
    : undefined;
  return (
    <div className="payment-content">
      <p className="payment-intro">
        {canPay
          ? 'Elige tu método de pago y envíanos el soporte por WhatsApp junto con tu pedido.'
          : 'Estos son nuestros métodos de pago. Confirma primero el valor final y la disponibilidad con una asesora.'}
      </p>
      <Image
        src="/brand/metodos-de-pago.png"
        alt="Métodos de pago de Glamour: Nequi 3128851441; Banco de Bogotá, ahorros 678108507; Daviplata 3128851441; Efecty, Gane, Baloto y Western Union a nombre de María Margarita Molano, cédula 1130649994."
        width={1122}
        height={1402}
        className="payment-image"
      />
      <fieldset className="payment-select">
        <legend>¿Cómo prefieres pagar?</legend>
        <div>
          {[
            'Llave de transferencia',
            'Nequi',
            'Banco de Bogotá',
            'Daviplata',
            'Efecty / Gane / Baloto',
            'Western Union',
          ].map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="payment-method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
              />
              <span>{value}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="transfer-key">
        <div>
          <span>También puedes transferir a esta llave</span>
          <strong>{PAYMENT_KEY}</strong>
        </div>
        <button
          className="icon-button"
          aria-label="Copiar llave de transferencia"
          onClick={copyKey}
        >
          {copied ? <Check size={22} /> : <Copy size={22} />}
        </button>
      </div>
      <p className="copy-status" role="status">
        {copied ? 'Llave copiada' : error || 'Nequi y Daviplata: 312 885 1441'}
      </p>
      {canPay && nextUrl && (
        <a className="button dark" href={nextUrl} target="_blank" rel="noopener noreferrer">
          <WhatsappLogo size={21} />
          Enviar pedido y soporte por WhatsApp
        </a>
      )}
      <p className="payment-note">
        El comprobante se adjunta directamente en WhatsApp. Tu pedido queda confirmado cuando
        Glamour verifica el pago y la disponibilidad.
      </p>
    </div>
  );
}
