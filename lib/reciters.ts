/**
 * Central reciter registry.
 *
 * This is the ONLY place reciters are defined. Both the frontend dropdown
 * and the /api/quran-surah route import from here, so there is no more
 * fuzzy name-matching between a UI label and an external API's naming —
 * the `id` you pick in the UI is the same key the API route looks up.
 *
 * TO ADD A RECITER:
 *   1. If they're on alquran.cloud's edition list, source: 'alquran',
 *      sourceId: the `identifier` field from that list.
 *   2. Otherwise, check https://everyayah.com/recitations_ayat.html for
 *      their exact folder name and use source: 'everyayah'.
 *      URL pattern is: https://everyayah.com/data/{sourceId}/{surah}{ayah}.mp3
 *      (surah and ayah are each zero-padded to 3 digits).
 *   That's it — no other file needs to change.
 */

export type ReciterSource = 'alquran' | 'everyayah';

export interface Reciter {
  id: string;            // stable internal id, sent from client to API
  name: string;          // display name
  initials: string;      // avatar initials
  source: ReciterSource;
  sourceId: string;       // edition identifier (alquran) or folder name (everyayah)
}

export const RECITERS: Reciter[] = [
  // ---- alquran.cloud editions (confirmed working, per-ayah audio) ----
  { id: 'alafasy',        name: 'Mishary Rashid Alafasy',     initials: 'MA', source: 'alquran', sourceId: 'ar.alafasy' },
  { id: 'sudais',         name: 'Abdul Rahman Al-Sudais',     initials: 'AS', source: 'alquran', sourceId: 'ar.abdurrahmaansudais' },
  { id: 'abdulbasit',     name: 'Abdul Basit Abdul Samad',    initials: 'AB', source: 'alquran', sourceId: 'ar.abdulbasitmurattal' },
  { id: 'muaiqly',        name: 'Maher Al Muaiqly',           initials: 'MM', source: 'alquran', sourceId: 'ar.mahermuaiqly' },
  { id: 'shuraim',        name: 'Saud Al-Shuraim',            initials: 'SS', source: 'alquran', sourceId: 'ar.saoodshuraym' },
  { id: 'rifai',          name: 'Hani Ar-Rifai',              initials: 'HR', source: 'alquran', sourceId: 'ar.hanirifai' },
  { id: 'shaatree',       name: 'Abu Bakr Al-Shatri',         initials: 'AS', source: 'alquran', sourceId: 'ar.shaatree' },
  { id: 'ajamy',          name: 'Ahmad Al-Ajmi',              initials: 'AA', source: 'alquran', sourceId: 'ar.ahmedajamy' },
  { id: 'basfar',         name: 'Abdullah Basfar',            initials: 'AB', source: 'alquran', sourceId: 'ar.abdullahbasfar' },
  { id: 'hudhaify',       name: 'Ali Al-Hudhaify',            initials: 'AH', source: 'alquran', sourceId: 'ar.hudhaify' },
  { id: 'minshawi',       name: 'Mohamed Siddiq El-Minshawi', initials: 'ME', source: 'alquran', sourceId: 'ar.minshawi' },
  { id: 'husary',         name: 'Mahmoud Khalil Al-Husary',   initials: 'MH', source: 'alquran', sourceId: 'ar.husary' },
  { id: 'ayyoub',         name: 'Muhammad Ayyoub',            initials: 'MY', source: 'alquran', sourceId: 'ar.muhammadayyoub' },
  { id: 'jibreel',        name: 'Muhammad Jibreel',           initials: 'MJ', source: 'alquran', sourceId: 'ar.muhammadjibreel' },
  { id: 'akhdar',         name: 'Ibrahim Al-Akhdar',          initials: 'IA', source: 'alquran', sourceId: 'ar.ibrahimakhbar' },

  // ---- everyayah.com (per-ayah audio, verified folder pattern) ----
  // Yasser Al-Dosari folder confirmed live via a public API that streams
  // from everyayah.com/data/Yasser_Ad-Dussary_128kbps/*.mp3
  { id: 'dosari',         name: 'Yasser Al-Dosari',           initials: 'YD', source: 'everyayah', sourceId: 'Yasser_Ad-Dussary_128kbps' },
  { id: 'ghamdi',         name: 'Saad Al-Ghamdi',             initials: 'SG', source: 'everyayah', sourceId: 'Ghamadi_40kbps' },
  { id: 'qatami',         name: 'Nasser Al Qatami',           initials: 'NQ', source: 'everyayah', sourceId: 'Nasser_Alqatami_128kbps' },
  { id: 'ajmi_everyayah', name: 'Ahmed Al-Ajmi (alt)',        initials: 'AA', source: 'everyayah', sourceId: 'Ahmed_ibn_Ali_al-Ajamy_128kbps' },
];

export function findReciter(id: string): Reciter | undefined {
  return RECITERS.find((r) => r.id === id);
}

/**
 * NOTE on the reciters above marked "everyayah": these folder names come
 * from the public folder-naming convention documented at
 * https://everyayah.com/recitations_ayat.html — double check any NEW
 * entry you add against that page before shipping, since a typo means a
 * silent 404 on audio (the API route below already guards against that
 * with a HEAD check + graceful error, but it's better to get it right).
 */