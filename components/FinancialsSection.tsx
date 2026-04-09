// components/FinancialsSection.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Financials } from '@/types';

function formatBillion(val: number | null) {
  if (!val) return '—';
  return `$${(val / 1_000_000_000).toFixed(1)}B`;
}

export function FinancialsSection() {
  const [rows, setRows] = useState<Financials[]>([]);

  useEffect(() => {
    supabase
      .from('financials')
      .select('*')
      .order('period_end', { ascending: false })
      .limit(8)
      .then(({ data }) => { if (data) setRows(data); });
  }, []);

  const latest = rows[0];
  const prev = rows[4];
  const yoyGrowth = latest && prev && latest.revenue && prev.revenue
    ? (((latest.revenue - prev.revenue) / prev.revenue) * 100).toFixed(0)
    : null;

  return (
    <section className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6">
      <h2 className="text-white font-semibold text-lg mb-4">Quartalszahlen (XBRL)</h2>
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Umsatz', value: formatBillion(latest.revenue), yoy: yoyGrowth ? `↑ ${yoyGrowth}% YoY` : null, color: 'text-green-400' },
            { label: 'Net Income', value: formatBillion(latest.net_income), yoy: null, color: 'text-white' },
            { label: 'EPS diluted', value: latest.eps_diluted ? `$${latest.eps_diluted}` : '—', yoy: null, color: 'text-white' },
            { label: 'Free Cashflow', value: formatBillion(latest.free_cash_flow), yoy: null, color: 'text-white' },
          ].map((card) => (
            <div key={card.label} className="bg-[#1E1E2E] rounded-lg p-4">
              <p className="text-gray-500 text-xs mb-1">{card.label}</p>
              <p className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</p>
              {card.yoy && <p className="text-green-400 text-xs mt-1">{card.yoy}</p>}
              <p className="text-gray-600 text-xs mt-1">{latest.period_end}</p>
            </div>
          ))}
        </div>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 uppercase tracking-wide border-b border-[#1E1E2E]">
            <th className="pb-2 text-left">Quartal</th>
            <th className="pb-2 text-right">Umsatz</th>
            <th className="pb-2 text-right">Net Income</th>
            <th className="pb-2 text-right">EPS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1E1E2E]">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-[#1A1A24]">
              <td className="py-2 font-mono text-gray-400">{r.period_end}</td>
              <td className="py-2 text-right font-mono text-white">{formatBillion(r.revenue)}</td>
              <td className="py-2 text-right font-mono text-gray-300">{formatBillion(r.net_income)}</td>
              <td className="py-2 text-right font-mono text-gray-300">{r.eps_diluted ? `$${r.eps_diluted}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
