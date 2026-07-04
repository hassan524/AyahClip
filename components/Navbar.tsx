'use client';

interface Props {
  step: string;
  onReset: () => void;
  quotesEnabled: boolean;
  onToggleQuotes: () => void;
}

export default function Navbar({ step, onReset, quotesEnabled, onToggleQuotes }: Props) {
  const scrollTo = (id: string) => {
    if (step !== 'upload') {
      onReset();
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="bg-emerald-900 px-4 sm:px-6 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <span onClick={onReset} className="text-white font-bold text-lg cursor-pointer">
          AyahClip
        </span>

        {step === 'upload' ? (
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo('options')} className="text-sm text-white/80 hover:text-white">
              Options
            </button>
            <button onClick={() => scrollTo('how-it-works')} className="text-sm text-white/80 hover:text-white">
              How It Works
            </button>
            <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer select-none">
              <input type="checkbox" checked={!quotesEnabled} onChange={onToggleQuotes} className="w-3.5 h-3.5" />
              Don't show quotes
            </label>
            <button
              onClick={() => scrollTo('uploader')}
              className="text-sm font-semibold text-emerald-900 bg-white hover:bg-emerald-50 px-4 py-1.5 rounded"
            >
              Start
            </button>
          </nav>
        ) : (
          <button onClick={onReset} className="text-sm text-white/90 hover:text-white">
            ← Back Home
          </button>
        )}
      </div>
    </header>
  );
}