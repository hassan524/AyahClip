import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-emerald-700 hover:text-emerald-800 text-sm font-semibold flex items-center gap-1 mb-8 cursor-pointer">
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-emerald-950 mb-6">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 mb-8">Last updated: July 2026</p>
        
        <div className="space-y-6 text-zinc-600 leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-lg font-bold text-emerald-900 mb-3">1. Data Processing</h2>
            <p>
              AyahClip is a client-side application. When you upload files (audio or video), they are processed locally in your web browser. We do not store, upload, or share your media files on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-900 mb-3">2. AI Transcription</h2>
            <p>
              Audio data is temporarily transcribed using API endpoints solely for the purpose of matching verses. No transcription data is saved or used for model training.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-900 mb-3">3. Cookies & Analytics</h2>
            <p>
              We may use basic analytical tools to understand website usage and improve our platform. No personally identifiable information is collected.
            </p>
          </section>

          <section>
            <p className="mt-8 pt-6 border-t border-zinc-100">
              If you have any questions or feedback, please contact us at <a href="mailto:hassanrehan9975@gmail.com" className="text-emerald-700 hover:underline">hassanrehan9975@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
