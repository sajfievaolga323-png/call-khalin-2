"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Copy, Mic, MicOff, Monitor, MonitorOff, Settings, Video, VideoOff, X } from "lucide-react";
import VideoTile from "@/components/VideoTile";
import Chat, { ChatMessage } from "@/components/Chat";

const ctrl = "flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-aqua";

export default function Room() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("Гость");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    try { setName(localStorage.getItem("khalin-name") || "Гость"); } catch {}
  }, []);

  // Камера и микрофон
  useEffect(() => {
    let s: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      .then((m) => {
        if (cancelled) return m.getTracks().forEach((t) => t.stop());
        s = m;
        setStream(m);
      })
      .catch(() => setError("Нет доступа к камере или микрофону. Разрешите доступ в настройках браузера."));
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Чат между вкладками одной комнаты (замените на WebSocket для реальных участников)
  useEffect(() => {
    const ch = new BroadcastChannel(`khalin-room-${id}`);
    ch.onmessage = (e) => setMessages((m) => [...m, e.data as ChatMessage]);
    channel.current = ch;
    return () => ch.close();
  }, [id]);

  const send = useCallback(
    (text: string) => {
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        name,
        text,
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((m) => [...m, msg]);
      channel.current?.postMessage(msg);
    },
    [name]
  );

  const toggleMic = () => {
    stream?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn(!micOn);
  };
  const toggleCam = () => {
    stream?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn(!camOn);
  };

  const stopScreen = useCallback(() => {
    setScreen((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);
  const toggleScreen = async () => {
    if (screen) return stopScreen();
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      s.getVideoTracks()[0].onended = () => setScreen(null);
      setScreen(s);
    } catch {}
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const saveName = (v: string) => {
    const n = v.trim() || "Гость";
    setName(n);
    try { localStorage.setItem("khalin-name", n); } catch {}
  };

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-ocean-bg p-3 lg:h-screen">
      <header className="glass flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold">🪷 Комната <span className="text-ocean-aqua">{id}</span></h1>
        <button
          onClick={copyLink}
          className="flex items-center gap-2 rounded-xl bg-ocean-aqua/20 px-3 py-2 text-sm text-ocean-aqua transition hover:bg-ocean-aqua/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-aqua"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Скопировано" : "Скопировать ссылку"}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_380px]">
        <section className="flex min-h-0 flex-col gap-3">
          <div className="grid flex-1 content-start gap-3 overflow-y-auto sm:grid-cols-2">
            <VideoTile name={`${name} (вы)`} stream={stream} muted micOn={micOn} camOn={camOn} />
            {screen && <VideoTile name="Демонстрация экрана" stream={screen} muted />}
          </div>
          {error && <p className="rounded-xl bg-ocean-coral/20 p-3 text-sm text-ocean-coral">{error}</p>}

          <div className="glass flex justify-center gap-3 px-4 py-3">
            <button onClick={toggleMic} aria-label="Микрофон" title="Микрофон" className={`${ctrl} ${micOn ? "bg-white/10" : "bg-ocean-coral"}`}>
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button onClick={toggleCam} aria-label="Камера" title="Камера" className={`${ctrl} ${camOn ? "bg-white/10" : "bg-ocean-coral"}`}>
              {camOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            <button onClick={toggleScreen} aria-label="Демонстрация экрана" title="Демонстрация" className={`${ctrl} ${screen ? "bg-ocean-aqua text-ocean-bg" : "bg-white/10"}`}>
              {screen ? <MonitorOff size={20} /> : <Monitor size={20} />}
            </button>
            <button onClick={() => setSettings(true)} aria-label="Настройки" title="Настройки" className={`${ctrl} bg-white/10`}>
              <Settings size={20} />
            </button>
          </div>
        </section>

        <Chat messages={messages} onSend={send} myName={name} />
      </div>

      {settings && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4" onClick={() => setSettings(false)}>
          <div className="glass w-full max-w-sm bg-ocean-panel/90 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">⚙️ Настройки</h2>
              <button onClick={() => setSettings(false)} aria-label="Закрыть"><X size={20} /></button>
            </div>
            <label htmlFor="nm" className="text-sm text-white/70">Ваше имя</label>
            <input
              id="nm"
              defaultValue={name}
              onBlur={(e) => saveName(e.target.value)}
              maxLength={30}
              className="mt-1 w-full rounded-xl border border-white/20 bg-ocean-bg/60 px-4 py-2.5 outline-none focus:border-ocean-aqua"
            />
          </div>
        </div>
      )}
    </div>
  );
}
