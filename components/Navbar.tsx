'use client';

import Image from 'next/image';
import { Menu } from 'lucide-react';
import { useState } from 'react';

interface Props {
  step: string;
  onReset: () => void;
  quotesEnabled: boolean;
  onToggleQuotes: () => void;
  onContactClick?: () => void;
}

export default function Navbar({
  step,
  onReset,
  quotesEnabled,
  onToggleQuotes,
  onContactClick,
}: Props) {
  const [open, setOpen] = useState(false);

  const scrollTo = (id: string) => {
    setOpen(false);

    if (step !== 'upload') {
      onReset();
      setTimeout(() => {
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6">

        {/* Logo */}
        <button
          onClick={onReset}
          className="flex items-center cursor-pointer"
        >
          <Image
            src="/logo.png"
            alt="AyahClip"
            width={150}
            height={150}
            className="h-20 w-auto -my-6 object-contain"
            priority
          />
        </button>

        {step === 'upload' ? (
          <>
            {/* Desktop */}
            <nav className="hidden items-center gap-8 md:flex">
              <button
                onClick={() => scrollTo('how-it-works')}
                className="font-medium text-gray-700 transition hover:text-emerald-600 cursor-pointer"
              >
                How It Works
              </button>

              <button
                onClick={() => scrollTo('faqs')}
                className="font-medium text-gray-700 transition hover:text-emerald-600 cursor-pointer"
              >
                FAQs
              </button>

              <button
                onClick={onContactClick}
                className="font-medium text-gray-700 transition hover:text-emerald-600 cursor-pointer"
              >
                Contact Us
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-2 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <Menu className="h-6 w-6 text-emerald-700" />
            </button>
          </>
        ) : (
          <button
            onClick={onReset}
            className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
          >
            ← Back Home
          </button>
        )}
      </div>

      {/* Mobile Menu */}
      {open && step === 'upload' && (
        <div className="border-t border-emerald-100 bg-white md:hidden">
          <div className="flex flex-col gap-4 p-5">
            <button
              onClick={() => scrollTo('how-it-works')}
              className="text-left text-gray-700 font-medium hover:text-emerald-600 transition-colors cursor-pointer"
            >
              How It Works
            </button>

            <button
              onClick={() => scrollTo('faqs')}
              className="text-left text-gray-700 font-medium hover:text-emerald-600 transition-colors cursor-pointer"
            >
              FAQs
            </button>

            <button
              onClick={() => {
                setOpen(false);
                if (onContactClick) onContactClick();
              }}
              className="text-left text-gray-700 font-medium hover:text-emerald-600 transition-colors cursor-pointer"
            >
              Contact Us
            </button>
          </div>
        </div>
      )}
    </header>
  );
}