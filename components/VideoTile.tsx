"use client";

import { useEffect, useRef, useState } from "react";
import { MicOff } from "lucide-react";
import { drawAquarium } from "./drawAquarium";


const MP_SRC = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";

/** Скрипт MediaPipe — классический (не ES-модуль): надёжнее всего подключать его тегом <script>,
 *  тогда конструктор гарантированно появляется в window.SelfieSegmentation (в prod-сборке Next импорт ненадёжен). */
function loadSelfieSegmentation(): Promise<any> {
  const w = window as any;
  if (w.SelfieSegmentation) return Promise.resolve(w.SelfieSegmentation);
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = MP_SRC;
    el.crossOrigin = "anonymous";
    el.onload = () => (w.SelfieSegmentation ? resolve(w.SelfieSegmentation) : reject(new Error("no SelfieSegmentation")));
    el.onerror = () => reject(new Error("failed to load MediaPipe"));
    document.head.appendChild(el);
  }).catch(async () => {
    const mod: any = await import("@mediapipe/selfie_segmentation");
    return mod.SelfieSegmentation;
  });
}

type Props = { name: string; stream: MediaStream | null; muted?: boolean; micOn?: boolean; camOn?: boolean };

export default function VideoTile({ name, stream, muted = false, micOn = true, camOn = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aquarium, setAquarium] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Виртуальный фон: MediaPipe Selfie Segmentation + canvas-аквариум
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!aquarium || !video || !canvas || !stream) return;

    let stopped = false;
    let raf = 0;
    let seg: any = null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setLoading(true);

    const start = async () => {
      const Ctor = await loadSelfieSegmentation();
      if (stopped || !Ctor) return;
      seg = new Ctor({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
      });
      seg.setOptions({ modelSelection: 1 });
      seg.onResults((r: any) => {
        if (stopped) return;
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        ctx.save();
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(r.segmentationMask, 0, 0, w, h);
        ctx.globalCompositeOperation = "source-in";
        ctx.drawImage(r.image, 0, 0, w, h);
        ctx.globalCompositeOperation = "destination-over";
        drawAquarium(ctx, w, h, performance.now() / 1000);
        ctx.restore();
        setLoading(false);
      });
      const loop = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2) await seg.send({ image: video });
        } catch {}
        raf = requestAnimationFrame(loop);
      };
      loop();
    };
    start().catch(() => setLoading(false));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      try { seg?.close?.(); } catch {}
      setLoading(false);
    };
  }, [aquarium, stream]);

  const showCanvas = aquarium && camOn;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="glass relative aspect-video overflow-hidden bg-ocean-panel/60">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`absolute inset-0 h-full w-full object-cover ${showCanvas ? "opacity-0" : ""}`}
        />
        <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full object-cover ${showCanvas ? "" : "hidden"}`} />
        {!camOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-ocean-panel">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-ocean-aqua/20 text-3xl font-bold text-ocean-aqua">
              {name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-ocean-bg/60 text-sm">Загрузка модели…</div>}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-sm">
          {!micOn && <MicOff size={14} className="text-ocean-coral" />}
          {name}
        </div>
      </div>
      <button
        onClick={() => setAquarium((v) => !v)}
        aria-pressed={aquarium}
        className={`self-start rounded-xl border px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-aqua ${
          aquarium ? "border-ocean-aqua bg-ocean-aqua/20 text-ocean-aqua" : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
        }`}
      >
        🐠 Аквариум {aquarium ? "вкл" : "выкл"}
      </button>
    </div>
  );
}
