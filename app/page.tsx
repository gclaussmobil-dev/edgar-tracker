import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center px-4">
      <div className="max-w-lg text-center space-y-6">
        <p className="text-sm font-mono text-green-400 tracking-widest uppercase">
          SEC EDGAR · Live
        </p>
        <h1 className="text-5xl font-bold text-white leading-tight">
          Institutional flows.
          <br />
          <span className="text-gray-400">Simplified.</span>
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed">
          SEC EDGAR Daten in Echtzeit — Insider Trades, institutionelle
          Positionen und Quartalszahlen. Sauber aufbereitet, sofort lesbar.
        </p>
        <Link
          href="/assets"
          className="inline-block mt-4 px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors text-lg"
        >
          Starten →
        </Link>
      </div>
    </main>
  );
}
