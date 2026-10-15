import { useState } from 'react';

import { Card } from '@/shared/ui/Card';
import { SegTabs } from '@/shared/ui/SegTabs';

import { AmbulanceProvidersCard } from '@/features/ops-content/presentation/components/AmbulanceProvidersCard';
import { FaqsCard } from '@/features/ops-content/presentation/components/FaqsCard';
import { LegalDocumentsCard } from '@/features/ops-content/presentation/components/LegalDocumentsCard';
import { LocationsCard } from '@/features/ops-content/presentation/components/LocationsCard';

const TABS = ['Legal documents', 'FAQs', 'Locations', 'Ambulance providers'] as const;
type ContentTab = (typeof TABS)[number];

/**
 * Patient-app content (UAT report §8): the legal texts the app shows and
 * consents record, FAQs, the location list and ambulance providers — all
 * platform-curated (`settings.view` to read; add/edit/del per action).
 */
export function OpsContentScreen() {
  const [tab, setTab] = useState<ContentTab>('Legal documents');
  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex items-center gap-3">
        <SegTabs
          tabs={TABS}
          value={tab}
          onChange={(t) => setTab(TABS.find((x) => x === t) ?? tab)}
        />
      </Card>
      {tab === 'Legal documents' && <LegalDocumentsCard />}
      {tab === 'FAQs' && <FaqsCard />}
      {tab === 'Locations' && <LocationsCard />}
      {tab === 'Ambulance providers' && <AmbulanceProvidersCard />}
    </div>
  );
}
