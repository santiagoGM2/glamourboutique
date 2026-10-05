import { loadEnvConfig } from '@next/env';
import { syncCatalog, SyncError } from '../src/lib/server/sync';

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  try {
    const result = await syncCatalog();
    console.log(`Catálogo actualizado: ${result.productCount} productos; ${result.syncedAt}.`);
  } catch (error) {
    console.error(
      error instanceof SyncError
        ? error.message
        : 'Error de sincronización. No se reemplazó el catálogo.',
    );
    process.exitCode = 1;
  }
}

void main();
