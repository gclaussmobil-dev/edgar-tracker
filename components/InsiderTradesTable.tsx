// components/InsiderTradesTable.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { InsiderTrade } from '@/types';
import { TRANSACTION_CODE_LABELS } from '@/types';

const CODE_SIGNAL: Record<string, { label: string; color: string }> = {
  P: { label: '▲ Kauf', color: 'text-green-400' },
  S: { label: '▼ Verkauf', color: 'text-red-400' },
  A: { label: '● Award', color: 'text-gray-400' },
  F: { label: '● Steuer', color: 'text-gray-400' },
  G: { label: '● Gift', color: 'text-gray-400' },
  D: { label: '● Disposition', color: 'text-gray-400' },
  M: { label: '● Option', color: 'text-blue-400' },
};

export function InsiderTradesTable() {
  const [trades, setTrades] = useState<InsiderTrade[]>([]);
  const [filter, setFilter] = useState<'all' | 'P' | 'S'>('all');

  useEffect(() => {
    supabase
      .from('insider_trades')
      .select('*')
      .order('filed_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setTrades(data); });

    const channel = supabase
      .channel('insider_trades_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'insider_trades' }, (payload) => {
        setTrades((prev) => [payload.new as InsiderTrade, ...prev].slice(0, 20));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = filter === 'all' ? trades : trades.filter((t) => t.transaction_code === filter);

  return (
    <section className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">Insider Trades (Form 4)</h2>
        <div className="flex gap-2">
          {(['all', 'P', 'S'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${filter === f ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
            >
              {f === 'all' ? 'Alle' : f === 'P' ? 'Käufe' : 'Verkäufe'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-600 text-xs uppercase tracking-wide border-b border-[#1E1E2E]">
              <th className="pb-2 text-left">Signal</th>
              <th className="pb-2 text-left">Person</th>
              <th className="pb-2 text-left">Rolle</th>
              <th className="pb-2 text-right">Aktien</th>
              <th className="pb-2 text-right">Wert</th>
              <th className="pb-2 text-right">Datum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E1E2E]">
            {filtered.map((trade) => {
              const sig = CODE_SIGNAL[trade.transaction_code] ?? { label: '●', color: 'text-gray-400' };
              return (
                <tr key={trade.id} className="hover:bg-[#1A1A24] transition-colors">
                  <td className={`py-3 font-mono text-xs ${sig.color}`} title={TRANSACTION_CODE_LABELS[trade.transaction_code]}>
                    {sig.label}
                  </td>
                  <td className="py-3 text-white">{trade.person_name}</td>
                  <td className="py-3 text-gray-400 text-xs">{trade.role}</td>
                  <td className="py-3 text-right font-mono text-gray-300">{trade.shares.toLocaleString()}</td>
                  <td className={`py-3 text-right font-mono ${trade.transaction_code === 'P' ? 'text-green-400' : trade.transaction_code === 'S' ? 'text-red-400' : 'text-gray-400'}`}>
                    {trade.total_value ? `$${(trade.total_value / 1_000_000).toFixed(1)}M` : '—'}
                  </td>
                  <td className="py-3 text-right text-gray-500 text-xs font-mono">
                    {new Date(trade.filed_at).toLocaleDateString('de-DE')}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-600">Keine Daten</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
