import { timingSafeEqual } from 'node:crypto';
import { hasIntegrationConfig, hasStorageConfig, readConfig, type ServerConfig } from './config';
import { syncCatalog } from './sync';

const responseHeaders = { 'Cache-Control': 'no-store, max-age=0' };

interface CronOptions {
  secret?: string;
  config?: ServerConfig;
  sync?: typeof syncCatalog;
}

export async function runCatalogCron(
  request: Request,
  options: CronOptions = {},
): Promise<Response> {
  const secret = options.secret ?? process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return Response.json({ status: 'unauthorized' }, { status: 401, headers: responseHeaders });

  const config = options.config ?? readConfig();
  if (!hasIntegrationConfig(config) || !hasStorageConfig(config))
    return Response.json(
      {
        status: 'not_configured',
        message: 'Falta conectar la fuente del catálogo o su almacenamiento.',
      },
      { status: 503, headers: responseHeaders },
    );

  try {
    const result = await (options.sync ?? syncCatalog)({ config });
    return Response.json({ status: 'updated', ...result }, { headers: responseHeaders });
  } catch {
    // Expose failure to the scheduler without exposing provider credentials or responses.
    return Response.json(
      {
        status: 'failed',
        message: 'No se actualizó el catálogo. Se conserva la última versión válida.',
      },
      { status: 502, headers: responseHeaders },
    );
  }
}
