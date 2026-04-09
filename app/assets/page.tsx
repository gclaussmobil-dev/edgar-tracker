// app/assets/page.tsx
'use client';
import { useRouter } from 'next/navigation';

export default function AssetsPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Suchleiste */}
        <input
          type="text"
          placeholder="Ticker oder Firmenname suchen..."
          className="w-full px-5 py-4 bg-[#13131A] border border-[#1E1E2E] rounded-xl text-white placeholder-gray-500 text-lg focus:outline-none focus:border-gray-500 font-mono"
          defaultValue="NVDA"
          readOnly
        />

        {/* NVDA Karte */}
        <div
          className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-5 cursor-pointer hover:border-gray-500 transition-colors"
          onDoubleClick={() => router.push('/assets/nvda')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#1E1E2E] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                NVDA
              </div>
              <div>
                <p className="text-white font-semibold text-lg">NVIDIA Corporation</p>
                <p className="text-gray-500 font-mono text-sm">NVDA · NASDAQ</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-gray-500 text-sm">LIVE</span>
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-3">Doppelklick zum Öffnen</p>
        </div>
      </div>
    </main>
  );
}
