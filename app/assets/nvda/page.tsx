// app/assets/nvda/page.tsx
import { AISummary } from '@/components/AISummary';
import { InsiderTradesTable } from '@/components/InsiderTradesTable';
import { InstitutionalChart } from '@/components/InstitutionalChart';
import { FinancialsSection } from '@/components/FinancialsSection';
import { MaterialEventsFeed } from '@/components/MaterialEventsFeed';
import Link from 'next/link';

export default function NvdaDetailPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/assets" className="text-gray-600 text-sm hover:text-gray-400 transition-colors">
              ← Zurück
            </Link>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-3xl font-bold text-white">NVDA</h1>
              <span className="text-gray-400">NVIDIA Corporation</span>
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-green-400 text-xs font-mono">LIVE</span>
              </span>
            </div>
          </div>
        </div>

        {/* 5 Sektionen */}
        <AISummary />
        <InsiderTradesTable />
        <InstitutionalChart />
        <FinancialsSection />
        <MaterialEventsFeed />
      </div>
    </main>
  );
}