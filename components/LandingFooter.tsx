'use client';

interface Props {
  onContactClick?: () => void;
}

export default function LandingFooter({ onContactClick }: Props) {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white py-8 px-4">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-700">
          <a
            href="/privacy"
            className="transition-colors hover:text-emerald-600"
          >
            Privacy Policy
          </a>

          <span className="text-gray-300">|</span>

          <a
            href="/terms"
            className="transition-colors hover:text-emerald-600"
          >
            Terms of Service
          </a>
        </div>

        <div className="basis-full sm:basis-auto flex items-center justify-center gap-3 text-xs sm:text-sm text-gray-700">
          <span className="hidden sm:inline text-gray-300">|</span>
          <button
            onClick={onContactClick}
            className="cursor-pointer bg-transparent border-none transition-colors hover:text-emerald-600"
          >
            Contact
          </button>
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] sm:text-xs leading-5 sm:leading-6 lg:px-50 px-5 text-gray-500">
        © 2026 AyahClip. All rights reserved.
      </p>
    </footer>
  );
}