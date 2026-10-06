import { loadEnvConfig } from '@next/env';
import { syncCatalog, SyncError } from '../src/lib/server/sync';

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  try {
    const result = await syncCatalog();
    console.log(`Catálogo actualizado: ${result.productCount} productos; ${result.syncedAt}.`);
    if (result.selection) {
      console.log(
        `Selección: ${result.selection.counts['821117']}/200 del proveedor 821117; ${result.selection.counts['1101290000']}/200 del proveedor 1101290000.`,
      );
    }
    if (result.changeSummary) {
      console.log(
        `Cambios de precio: ${result.changeSummary.significantPriceChanges} superiores a $5.000 COP; ${result.changeSummary.minorPriceChanges} menores. Cambios de existencias: ${result.changeSummary.stockChanges}.`,
      );
    }
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
