import { runCatalogCron } from '@/lib/server/cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request): Promise<Response> {
  return runCatalogCron(request);
}
