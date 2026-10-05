import { getCatalog } from '@/lib/server/catalog';
import { CheckoutError, createQuote } from '@/lib/server/checkout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 24 * 1_024;
const headers = { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };

async function readBoundedBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    throw new CheckoutError(
      'BODY_TOO_LARGE',
      'Tu bolsa tiene demasiados datos. Reduce la selección e inténtalo de nuevo.',
      413,
    );
  }
  if (!request.body) throw new CheckoutError('INVALID_CART', 'Tu bolsa está vacía.', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new CheckoutError(
          'BODY_TOO_LARGE',
          'Tu bolsa tiene demasiados datos. Reduce la selección e inténtalo de nuevo.',
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new CheckoutError(
      'INVALID_JSON',
      'No pudimos leer tu bolsa. Actualiza la página e inténtalo de nuevo.',
      400,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get('origin');
    if (
      request.headers.get('sec-fetch-site') === 'cross-site' ||
      (origin && origin !== new URL(request.url).origin)
    ) {
      throw new CheckoutError(
        'INVALID_ORIGIN',
        'Abre tu bolsa desde la página de Glamour Boutique Cali.',
        403,
      );
    }
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) {
      throw new CheckoutError(
        'INVALID_CONTENT_TYPE',
        'La solicitud debe usar el formato JSON.',
        415,
      );
    }
    const input = await readBoundedBody(request);
    const quote = createQuote(input, await getCatalog());
    return Response.json(quote, { headers });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers },
      );
    }
    return Response.json(
      {
        error: 'No pudimos confirmar los precios. Inténtalo de nuevo o escríbenos por WhatsApp.',
        code: 'CHECKOUT_ERROR',
      },
      { status: 500, headers },
    );
  }
}
