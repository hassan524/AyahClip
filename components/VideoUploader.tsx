'use client';

import { useRef, useState, useCallback } from 'react';

interface Props {
  onVideoSelected: (file: File, url: string, duration: number) => void;
}

export default function VideoUploader({ onVideoSelected }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Please upload a video file (MP4, MOV, etc.)');
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      onVideoSelected(file, url, video.duration);
    };
  }, [onVideoSelected]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
        ${dragging ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div className="text-5xl mb-4">🎬</div>
      <p className="text-white font-medium text-lg mb-2">Drop your recitation video here</p>
      <p className="text-white/40 text-sm mb-6">or tap to browse</p>
      <div className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-medium transition-colors">
        Choose Video
      </div>
      <p className="text-white/30 text-xs mt-4">MP4, MOV, WebM • Max 500MB</p>
    </div>
  );
}
