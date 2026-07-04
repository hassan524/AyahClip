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
      className={`relative border-2 border-dashed rounded-md p-12 text-center cursor-pointer transition-colors bg-white
        ${dragging ? 'border-emerald-700 bg-emerald-50' : 'border-zinc-300 hover:border-emerald-600'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <svg className="w-10 h-10 mx-auto mb-4 text-emerald-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p className="text-emerald-950 font-semibold mb-1">Drop your recitation video here</p>
      <p className="text-zinc-500 text-sm mb-6">or click to browse local files</p>
      <div className="inline-flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-md font-medium transition-colors">
        Choose Video
      </div>
      <p className="text-zinc-400 text-xs mt-4">Supports MP4, MOV, WebM • Max 500MB</p>
    </div>
  );
}