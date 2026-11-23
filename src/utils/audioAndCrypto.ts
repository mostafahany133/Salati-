import { AdhanSoundId, DayPrayerLog, SalatiSettings } from "../types/salati";

let tasbihCtx: AudioContext | null = null;

export function playSoftTasbihClick(milestone = false): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!tasbihCtx || tasbihCtx.state === "closed") {
      tasbihCtx = new AudioCtx();
    }
    if (tasbihCtx.state === "suspended") {
      tasbihCtx.resume().catch(() => {});
    }
    const now = tasbihCtx.currentTime;
    const osc = tasbihCtx.createOscillator();
    const gain = tasbihCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(milestone ? 660 : 480, now);
    osc.frequency.exponentialRampToValueAtTime(milestone ? 880 : 320, now + 0.045);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (milestone ? 0.14 : 0.05));
    osc.connect(gain);
    gain.connect(tasbihCtx.destination);
    osc.start(now);
    osc.stop(now + (milestone ? 0.16 : 0.06));
  } catch {
    // ignore audio block
  }
}

export function playWakeUpAlarmBurst(): () => void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return () => {};

    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28, now);
    master.connect(ctx.destination);

    // 4 clear ascending wake-up alarm phrases over ~5 seconds
    const pattern = [
      { freq: 523.25, delay: 0.0, dur: 0.35 },
      { freq: 659.25, delay: 0.28, dur: 0.35 },
      { freq: 783.99, delay: 0.56, dur: 0.55 },
      { freq: 523.25, delay: 1.4, dur: 0.35 },
      { freq: 659.25, delay: 1.68, dur: 0.35 },
      { freq: 783.99, delay: 1.96, dur: 0.55 },
      { freq: 587.33, delay: 2.8, dur: 0.35 },
      { freq: 783.99, delay: 3.1, dur: 0.35 },
      { freq: 987.77, delay: 3.4, dur: 0.65 },
    ];
    const oscs: OscillatorNode[] = [];
    for (const p of pattern) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(p.freq, now + p.delay);
      gain.gain.setValueAtTime(0.001, now + p.delay);
      gain.gain.exponentialRampToValueAtTime(0.85, now + p.delay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + p.delay + p.dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + p.delay);
      osc.stop(now + p.delay + p.dur + 0.04);
      oscs.push(osc);
    }

    return () => {
      try {
        oscs.forEach((o) => {
          try {
            o.stop();
          } catch {
            // ignore
          }
        });
        ctx.close();
      } catch {
        // ignore
      }
    };
  } catch {
    return () => {};
  }
}

// Gentle synthesized Web Audio API Adhan chimes / reflections (works completely offline)
export function playAdhanPreview(sound: AdhanSoundId): () => void {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return () => {};

  const ctx = new AudioCtx();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.16, now);
  master.connect(ctx.destination);

  const melodies: Record<AdhanSoundId, { freq: number; delay: number; dur: number }[]> = {
    makkah_chime: [
      { freq: 392.0, delay: 0, dur: 0.7 },
      { freq: 440.0, delay: 0.45, dur: 0.7 },
      { freq: 523.25, delay: 0.9, dur: 1.0 },
      { freq: 440.0, delay: 1.55, dur: 1.1 },
    ],
    madinah_dawn: [
      { freq: 329.63, delay: 0, dur: 0.8 },
      { freq: 392.0, delay: 0.5, dur: 0.8 },
      { freq: 493.88, delay: 1.05, dur: 1.2 },
    ],
    soft_fajr: [
      { freq: 293.66, delay: 0, dur: 0.9 },
      { freq: 349.23, delay: 0.6, dur: 1.0 },
      { freq: 440.0, delay: 1.25, dur: 1.3 },
    ],
    gentle_takbir: [
      { freq: 440.0, delay: 0, dur: 0.55 },
      { freq: 440.0, delay: 0.5, dur: 0.55 },
      { freq: 587.33, delay: 1.0, dur: 1.1 },
    ],
  };

  const notes = melodies[sound] || melodies.makkah_chime;
  const oscillators: OscillatorNode[] = [];

  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(n.freq, now + n.delay);
    gain.gain.setValueAtTime(0.001, now + n.delay);
    gain.gain.exponentialRampToValueAtTime(0.6, now + n.delay + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + n.delay);
    osc.stop(now + n.delay + n.dur + 0.05);
    oscillators.push(osc);
  }

  return () => {
    try {
      oscillators.forEach((o) => {
        try {
          o.stop();
        } catch {
          // ignore already stopped
        }
      });
      ctx.close();
    } catch {
      // ignore
    }
  };
}

// AES-256-GCM Backup Encryption & Safe Merge Restore (Section 8)
export interface EncryptedBackupEnvelope {
  format: "salati-encrypted-backup";
  version: number;
  createdAt: string;
  saltBase64: string;
  ivBase64: string;
  ciphertextBase64: string;
}

export interface SalatiBackupPayload {
  settings: SalatiSettings;
  logs: Record<string, DayPrayerLog>;
  exportedAt: string;
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSalatiBackup(
  payload: SalatiBackupPayload,
  passphrase: string
): Promise<EncryptedBackupEnvelope> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoded
  );
  return {
    format: "salati-encrypted-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    saltBase64: toBase64(salt),
    ivBase64: toBase64(iv),
    ciphertextBase64: toBase64(ciphertext),
  };
}

export async function decryptSalatiBackup(
  envelope: EncryptedBackupEnvelope,
  passphrase: string
): Promise<SalatiBackupPayload> {
  if (envelope.format !== "salati-encrypted-backup") {
    throw new Error("Invalid backup file format");
  }
  const salt = fromBase64(envelope.saltBase64);
  const iv = fromBase64(envelope.ivBase64);
  const ciphertext = fromBase64(envelope.ciphertextBase64);
  const key = await deriveAesKey(passphrase, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as SalatiBackupPayload;
}
