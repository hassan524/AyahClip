import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-emerald-700 hover:text-emerald-800 text-sm font-semibold flex items-center gap-1 mb-8 cursor-pointer">
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-emerald-950 mb-6">Terms of Service</h1>
        <p className="text-sm text-zinc-500 mb-8">Last updated: July 2026</p>
        
        <div className="space-y-6 text-zinc-600 leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-lg font-bold text-emerald-900 mb-3">1. Permitted Use</h2>
            <p>
              AyahClip is provided for personal and educational purposes to generate Quranic recitation clips. You agree not to use this service for any unlawful activities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-900 mb-3">2. Content Responsibility</h2>
            <p>
              You are solely responsible for the media files you upload. You must ensure you have the necessary rights to use and export the content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-900 mb-3">3. Disclaimer of Warranty</h2>
            <p>
              The service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free operation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-900 mb-3">4. Limitation of Liability</h2>
            <p>
              In no event shall AyahClip or its developers be liable for any damages arising out of the use or inability to use this service.
            </p>
          </section>

          <section>
            <p className="mt-8 pt-6 border-t border-zinc-100">
              Thank you for respecting the platform and using it responsibly.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
