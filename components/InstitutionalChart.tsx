// components/InstitutionalChart.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { InstitutionalHolding } from '@/types';

export function InstitutionalChart() {
  const [holdings, setHoldings] = useState<InstitutionalHolding[]>([]);

  useEffect(() => {
    supabase
      .from('institutional_holdings')
      .select('*')
      .order('pct_outstanding', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setHoldings(data); });
  }, []);

  const max = Math.max(...holdings.map((h) => h.pct_outstanding), 1);

  return (
    <section className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6">
      <h2 className="text-white font-semibold text-lg mb-4">Institutionelle Holdings (13F)</h2>
      <div className="space-y-3">
        {holdings.map((h) => (
          <div key={h.id} className="flex items-center gap-3">
            <span className="text-gray-400 text-sm w-40 truncate">{h.institution_name}</span>
            <div className="flex-1 bg-[#1E1E2E] rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(h.pct_outstanding / max) * 100}%` }}
              />
            </div>
            <span className="text-white font-mono text-sm w-12 text-right">{h.pct_outstanding.toFixed(2)}%</span>
          </div>
        ))}
        {holdings.length === 0 && <p className="text-gray-600 text-sm">Keine Daten</p>}
      </div>
    </section>
  );
}
