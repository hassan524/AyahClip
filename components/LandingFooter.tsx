'use client';

export default function LandingFooter() {
  return (
    <footer className="bg-emerald-900 mt-16 py-8 px-4 text-center">
      <div className="flex items-center justify-center gap-3 text-sm text-white/80 mb-2">
        <a href="#" className="hover:text-white">Privacy Policy</a>
        <span className="text-white/30">|</span>
        <a href="#" className="hover:text-white">Terms of Service</a>
        <span className="text-white/30">|</span>
        <a href="#" className="hover:text-white">Contact</a>
      </div>
      <p className="text-xs text-white/50">© 2026 AyahClip. All rights reserved.</p>
    </footer>
  );
}