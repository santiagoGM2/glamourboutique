import Storefront from '@/components/storefront';
import { getCatalog } from '@/lib/server/catalog';
import { getPreviewCatalog } from '@/lib/preview';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const catalog = await getCatalog();
  return (
    <Storefront
      initialCatalog={
        catalog.status === 'unconfigured' && catalog.updatedAt === null
          ? getPreviewCatalog()
          : catalog
      }
    />
  );
}
