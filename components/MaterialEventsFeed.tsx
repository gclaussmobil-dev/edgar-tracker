// components/MaterialEventsFeed.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { MaterialEvent } from '@/types';

const EVENT_BADGES: Record<string, { label: string; icon: string }> = {
  management: { label: 'CEO/Management', icon: '👔' },
  acquisition: { label: 'Übernahme', icon: '💰' },
  earnings_warning: { label: 'Gewinnwarnung', icon: '⚠️' },
  other: { label: 'Event', icon: '📋' },
};

export function MaterialEventsFeed() {
  const [events, setEvents] = useState<MaterialEvent[]>([]);

  useEffect(() => {
    supabase
      .from('material_events')
      .select('*')
      .order('filed_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setEvents(data); });

    const channel = supabase
      .channel('material_events_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'material_events' }, (payload) => {
        setEvents((prev) => [payload.new as MaterialEvent, ...prev].slice(0, 5));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <section className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6">
      <h2 className="text-white font-semibold text-lg mb-4">Material Events (8-K)</h2>
      <div className="space-y-3">
        {events.map((ev) => {
          const badge = EVENT_BADGES[ev.event_type] ?? EVENT_BADGES.other;
          return (
            <div key={ev.id} className="flex items-start gap-3 p-3 bg-[#1E1E2E] rounded-lg">
              <span className="text-lg">{badge.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-[#2A2A3A] text-gray-300 px-2 py-0.5 rounded">{badge.label}</span>
                  <span className="text-gray-600 text-xs">
                    {new Date(ev.filed_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
                <p className="text-gray-300 text-sm truncate">{ev.description}</p>
              </div>
              <a
                href={ev.filing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-xs hover:text-blue-300 whitespace-nowrap"
              >
                Filing →
              </a>
            </div>
          );
        })}
        {events.length === 0 && <p className="text-gray-600 text-sm">Keine Events</p>}
      </div>
    </section>
  );
}
