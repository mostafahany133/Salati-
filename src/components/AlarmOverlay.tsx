import React, { useEffect, useRef, useState } from "react";
import {
  BellOff,
  Check,
  Sparkles,
  Clock,
  Volume2,
  Play,
  BellRing,
  SkipForward,
} from "lucide-react";
import {
  AdhanSoundId,
  ComputedPrayerSlot,
  Locale,
  PrayerId,
} from "../types/salati";
import { ADHAN_MUEZZINS } from "../data/salatiContent";
import { playAdhanPreview, playWakeUpAlarmBurst } from "../utils/audioAndCrypto";

interface AlarmOverlayProps {
  slot: ComputedPrayerSlot | null;
  soundId: AdhanSoundId;
  muezzinId: string;
  alarmIntervalSec: number;
  locale: Locale;
  onClose: () => void;
  onStartPreparation: () => void;
  onLogPrayer: (prayerId: PrayerId) => void;
}

function fmtSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const AlarmOverlay: React.FC<AlarmOverlayProps> = ({
  slot,
  soundId,
  muezzinId,
  alarmIntervalSec,
  locale,
  onClose,
  onStartPreparation,
  onLogPrayer,
}) => {
  const isAr = locale === "ar";
  const adhanAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopChimeRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<"adhan" | "post_adhan">("adhan");
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [adhanPlaying, setAdhanPlaying] = useState(false);
  const [adhanCurrent, setAdhanCurrent] = useState(0);
  const [adhanDuration, setAdhanDuration] = useState(0);
  const [countdownSec, setCountdownSec] = useState<number>(alarmIntervalSec);
  const [alarmRingCount, setAlarmRingCount] = useState(0);

  const muezzin =
    ADHAN_MUEZZINS.find((m) => m.id === muezzinId) || ADHAN_MUEZZINS[0];

  const stopAllAudio = () => {
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
      adhanAudioRef.current.currentTime = 0;
    }
    stopChimeRef.current?.();
    stopChimeRef.current = null;
    setAdhanPlaying(false);
  };

  const enterPostAdhanPhase = () => {
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
    }
    setAdhanPlaying(false);
    setPhase("post_adhan");
    setAlarmRingCount(0);
    setCountdownSec(alarmIntervalSec > 0 ? alarmIntervalSec : 0);
  };

  // Start real Sheikh Adhan when slot opens
  useEffect(() => {
    if (!slot) {
      stopAllAudio();
      return;
    }
    setPhase("adhan");
    setNeedsTapToPlay(false);
    setAdhanCurrent(0);
    setAdhanDuration(0);
    setAlarmRingCount(0);
    setCountdownSec(alarmIntervalSec);

    const audio = adhanAudioRef.current;
    if (audio) {
      audio.src = `/api/adhan/audio/${encodeURIComponent(muezzin.id)}`;
      audio.load();
      audio
        .play()
        .then(() => {
          setAdhanPlaying(true);
          setNeedsTapToPlay(false);
        })
        .catch(() => {
          setNeedsTapToPlay(true);
          setAdhanPlaying(false);
        });
    }

    return () => {
      stopAllAudio();
    };
  }, [slot, muezzin.id, alarmIntervalSec]);

  // 1-minute (configurable) repeating alarm countdown AFTER Adhan finishes
  useEffect(() => {
    if (!slot || phase !== "post_adhan" || alarmIntervalSec <= 0) return;

    const timer = window.setInterval(() => {
      setCountdownSec((prev) => {
        if (prev <= 1) {
          stopChimeRef.current?.();
          stopChimeRef.current = playWakeUpAlarmBurst();
          setAlarmRingCount((c) => c + 1);
          return alarmIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [slot, phase, alarmIntervalSec]);

  if (!slot) return null;

  const handleManualStartAdhan = () => {
    const audio = adhanAudioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => {
        setNeedsTapToPlay(false);
        setAdhanPlaying(true);
      })
      .catch(() => {
        stopChimeRef.current = playAdhanPreview(soundId);
      });
  };

  const handleStop = () => {
    stopAllAudio();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#04100E]/95 backdrop-blur-md flex items-center justify-center p-6">
      <audio
        ref={adhanAudioRef}
        preload="auto"
        onTimeUpdate={(e) => setAdhanCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setAdhanDuration(e.currentTarget.duration || 0)}
        onEnded={() => enterPostAdhanPhase()}
        onError={() => {
          stopChimeRef.current = playAdhanPreview(soundId);
          setAdhanPlaying(false);
        }}
      />

      <div className="w-full max-w-md rounded-3xl border border-emerald-800/70 bg-[#091D1A] p-8 text-center space-y-6 shadow-2xl">
        <div className="space-y-2">
          <p className="text-xs font-medium text-amber-300/90">
            {isAr ? "دخل وقت الصلاة" : "Prayer Time Has Entered"}
          </p>
          <h2 className="text-4xl font-bold text-white">
            {isAr ? slot.nameAr : slot.nameEn}
          </h2>
          <p className="text-3xl font-semibold text-emerald-300 font-mono-num">
            {slot.formattedTime}
          </p>
          <p className="text-xs text-stone-300">
            {isAr
              ? `الأذان بصوت ${muezzin.nameAr}`
              : `Adhan by ${muezzin.nameEn}`}
          </p>
        </div>

        {/* Phase 1: Real Sheikh Adhan Playback */}
        {phase === "adhan" && (
          <div className="p-4 rounded-2xl border border-emerald-800/60 bg-[#061513] space-y-3">
            {needsTapToPlay ? (
              <button
                type="button"
                onClick={handleManualStartAdhan}
                className="w-full min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>
                  {isAr
                    ? `تشغيل الأذان بصوت ${muezzin.nameAr}`
                    : `Play Adhan (${muezzin.nameEn})`}
                </span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-300 font-medium">
                  <Volume2 className="w-4 h-4" />
                  <span>
                    {adhanPlaying
                      ? isAr
                        ? "الأذان يُرفع الآن... استمع ثم يبدأ منبه التذكير كل دقيقة"
                        : "Adhan is reciting... 1-min wake-up alarms begin afterward"
                      : isAr
                      ? "جارٍ تحميل صوت الأذان..."
                      : "Loading Adhan voice..."}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-emerald-950 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{
                      width:
                        adhanDuration > 0
                          ? `${Math.min(100, (adhanCurrent / adhanDuration) * 100)}%`
                          : "15%",
                    }}
                  />
                </div>
                <p className="text-[11px] font-mono-num text-stone-400">
                  {fmtSec(adhanCurrent)} / {adhanDuration > 0 ? fmtSec(adhanDuration) : muezzin.durationLabel}
                </p>
              </div>
            )}

            {alarmIntervalSec > 0 && (
              <button
                type="button"
                onClick={enterPostAdhanPhase}
                className="text-[11px] text-amber-300/90 hover:text-amber-200 inline-flex items-center gap-1 underline"
              >
                <SkipForward className="w-3 h-3" />
                <span>
                  {isAr
                    ? "اختبار مرحلة ما بعد الأذان (بدء منبه كل دقيقة فوراً)"
                    : "Skip to post-Adhan 1-minute alarm loop"}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Phase 2: Post-Adhan 1-Minute Repeating Wake-Up Alarm Loop */}
        {phase === "post_adhan" && (
          <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-300">
              <BellRing className="w-4 h-4" />
              <span>
                {alarmRingCount === 0
                  ? isAr
                    ? "انتهى الأذان — جرس التذكير للقيام للصلاة بعد:"
                    : "Adhan finished — Next wake-up alarm in:"
                  : isAr
                  ? `حيّ على الصلاة! تنبيه رقم #${alarmRingCount} — يتكرر مجدداً بعد:`
                  : `Stand for Prayer! Alarm #${alarmRingCount} — Next ring in:`}
              </span>
            </div>
            {alarmIntervalSec > 0 ? (
              <p className="text-3xl font-bold font-mono-num text-white">
                {fmtSec(countdownSec)}
              </p>
            ) : (
              <p className="text-xs text-stone-300">
                {isAr ? "تم إتمام الأذان المبارك." : "Adhan completed."}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 pt-1">
          {slot.isObligatory && (
            <button
              type="button"
              onClick={() => {
                stopAllAudio();
                onLogPrayer(slot.id as PrayerId);
              }}
              className="w-full min-h-[48px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>
                {isAr ? "قمتُ وصليت — تسجيل الصلاة وإيقاف المنبه" : "Prayed — Log & Stop Alarm"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              stopAllAudio();
              onStartPreparation();
            }}
            className="w-full min-h-[46px] px-5 rounded-xl border border-emerald-700 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isAr ? "بدء الاستعداد والوضوء" : "Start Preparation & Wudu"}</span>
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                stopChimeRef.current?.();
                stopChimeRef.current = null;
                enterPostAdhanPhase();
              }}
              className="min-h-[44px] px-4 rounded-xl border border-emerald-900 text-stone-300 hover:bg-emerald-950 text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {isAr
                  ? `تنبيه بعد ${Math.max(1, Math.round((alarmIntervalSec || 60) / 60))} د`
                  : `Remind in ${Math.max(1, Math.round((alarmIntervalSec || 60) / 60))}m`}
              </span>
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="min-h-[44px] px-4 rounded-xl border border-emerald-900 text-stone-300 hover:bg-emerald-950 text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              <BellOff className="w-3.5 h-3.5" />
              <span>{isAr ? "إيقاف المنبه" : "Stop Alarm"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
