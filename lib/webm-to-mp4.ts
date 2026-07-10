import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export function preloadFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return Promise.resolve(ffmpegInstance);
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }
  return loadPromise;
}

export async function convertWebmToMp4(webmBlob: Blob): Promise<Blob> {
  const ffmpeg = await preloadFfmpeg();
  const inputName = `in-${Date.now()}.webm`;
  const outputName = `out-${Date.now()}.mp4`;

  await ffmpeg.writeFile(inputName, await fetchFile(webmBlob));
  await ffmpeg.exec([
    '-i', inputName,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
  return new Blob([bytes.slice()], { type: 'video/mp4' });
}

function pickMimeType(): { mimeType: string; needsConversion: boolean } {
  const mp4Types = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
  ];
  for (const t of mp4Types) {
    if (MediaRecorder.isTypeSupported(t)) return { mimeType: t, needsConversion: false };
  }
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
    return { mimeType: 'video/webm;codecs=vp8,opus', needsConversion: true };
  }
  return { mimeType: 'video/webm', needsConversion: true };
}

export { pickMimeType };
