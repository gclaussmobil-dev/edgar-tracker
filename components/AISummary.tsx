// components/AISummary.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function AISummary() {
  const [summary, setSummary] = useState<string>('Zusammenfassung wird geladen...');
  const [updatedAt, setUpdatedAt] = useState<string>('');

  useEffect(() => {
    // Initial laden
    supabase
      .from('ai_summary')
      .select('content, generated_at')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSummary(data.content);
          setUpdatedAt(new Date(data.generated_at).toLocaleTimeString('de-DE'));
        }
      });

    // Realtime Subscription
    const channel = supabase
      .channel('ai_summary_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_summary' }, (payload) => {
        setSummary(payload.new.content);
        setUpdatedAt(new Date(payload.new.generated_at).toLocaleTimeString('de-DE'));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <section className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold text-lg">NVDA — Zusammenfassung</h2>
        {updatedAt && <span className="text-gray-600 text-xs">Aktualisiert: {updatedAt}</span>}
      </div>
      <p className="text-gray-300 leading-relaxed">{summary}</p>
    </section>
  );
}
