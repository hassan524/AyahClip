import Groq from 'groq-sdk';

// Structure for the incoming words from the transcription engine
export type InputWord = {
  word: string;  // The spoken word
  start: number; // Exact start timestamp in seconds
  end: number;   // Exact end timestamp in seconds
};

// Initialize the Groq SDK client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Matches transcribed words and segments to exact Quranic Ayahs with hyper-accurate timing.
 */
export async function matchAyahsWithAI(words: InputWord[], segments: any[] = []) {
  
  // 1. CONSTRUCT THE PROMPT
  // We tell the AI to look directly at the individual word timestamps 
  // to calculate the absolute true start and end times for split verses.
  const prompt = `
You are a Quranic scholar. You are given an array of transcription SEGMENTS, and an array of individual WORDS with timestamps.

Your core task:
1. Recognize the correct Surah and Ayah number.
2. Output EXACT Uthmani script with full diacritics (Tashkeel).
3. Provide the English translation.

CRITICAL TIMING & SPLITTING RULE:
- Each object in the "ayahs" array MUST contain exactly ONE Ayah (Do not group multiple Ayahs together).
- If a segment spans across more than one Ayah, you MUST split them into separate objects.
- To find the PERFECT "startTime" and "endTime" for each Ayah object, map it directly to the "words" array. Take the 'start' time of the very first word belonging to this Ayah, and the 'end' time of the very last word belonging to this Ayah. Do not estimate or guess; use the precise word timestamps provided.
- Please start time and end time should work properly
- also some ayahs are big if find verse in object but its verse not complete ayah show it as it is for exmaple this    آمن الرسول بما أنزل إليه من ربه والمؤمنون you should know which to show correct cause long will be alot in screen
- every verse should have arabic signs like this ءَامَنَ ٱلرَّسُولُ بِمَآ أُنزِلَ إِلَيْهِ مِن رَّبِّهِۦ وَٱلْمُؤْمِنُونَ  not plan arabic and in the end of ayah correct ayah number in circle beautyfull only show that circle if the ayah end and which ayah it was for example إِذَا زُلْزِلَتِ ٱلْأَرْضُ زِلْزَالَهَا ١ وَأَخْرَجَتِ ٱلْأَرْضُ أَثْقَالَهَا ٢ وَقَالَ ٱلْإِنسَـٰنُ مَا لَهَا ٣ like that each ayah u should know this ayah just show that after okay? and very correct start time and end time do caluclates with words second also if ayah was long and u seperate them then dont show same ayah number in the end for exaple after this  آمن الرسول بما أنزل إليه من ربه والمؤمنون just show when ayah end and correct and please make sure start time and edn teime working perfectly 
- translation should not be extra if the verse ending with for example وَمَا قَدَرُوا يَقِينًا the transltion should be for exact those words not full ayah "And they did not kill him for sure", and make sure you double check translation and arabic its the matter of quran 
- also please make sure when ayah is ending add thi ayah number in end وَقَالُوا۟ ٱتَّخَذَ ٱلرَّحْمَـٰنُ وَلَدًۭا ٨٨ like that please for every quran ayah u getting first u seperaitng ayah then also put in thi end anyah number no big deal and start and end time perfectly not even second difference do full math and algorithm it should be perfect, please for example after every ayah end add ayah number dont forget that ake sure dont go incorrect in this matter

Output format MUST be a valid JSON object with this exact structure:
{
  "ayahs": [
    {
      "surah": 99,
      "ayahNumber": 1,
      "surahName": "الزلزلة",
      "surahEnglishName": "Al-Zalzalah",
      "arabic": "إِذَا زُلْزِلَتِ الْأَرْضُ زِلْزَالَهَا",
      "translation": "When the earth is shaken with its [final] earthquake",
      "startTime": 6.86,
      "endTime": 11.40,
      "isFullAyah": true
    }
  ]
}

Input Data:
Words (Use this for precise start/end times): ${JSON.stringify(words)}
Segments: ${JSON.stringify(segments)}
`;

  try {
    // 2. CALL THE GROQ API
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a helpful expert in Quranic text and timestamps. You must output only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature to prevent hallucinations and enforce absolute precision
    });

    // Extract raw string text from response
    const content = response.choices[0].message?.content;
    if (!content) {
      throw new Error('No response from AI model');
    }

    // 3. PARSE RESULTS
    const parsed = JSON.parse(content);
    const ayahs = parsed.ayahs || [];
    
    // 4. CLEAN ARABIC TEXT
    // Automatically strip out decorative brackets or verse numbers that LLMs often hallucinate at the end of text strings.
    for (const ayah of ayahs) {
      if (ayah.arabic) {
        ayah.arabic = ayah.arabic
          // Regex kills standard digits, Arabic digits, and ornate end-of-verse brackets like ﴿﴾
          .replace(/[\u06DD\u06D4\u06E9\u06EA\u06EB\u06EC\u06ED\u06EE\u06EF\u06F0-\u06F90-9\u0660-\u0669﴿﴾]/g, '')
          // Compresses any multiple spaces into one clean single space
          .replace(/\s+/g, ' ')
          // Trims trailing or leading spaces
          .trim();
      }
    }

    // 5. RETURN POLISHED DATA
    // Return only valid elements that successfully generated Arabic text
    return ayahs.filter((a: any) => a.arabic && a.arabic.trim().length > 0);
  } catch (error) {
    console.error('Error in matchAyahsWithAI:', error);
    throw error;
  }
}