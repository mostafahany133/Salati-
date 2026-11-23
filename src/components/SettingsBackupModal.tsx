import React, { useEffect, useRef, useState } from "react";
import {
  X,
  MapPin,
  Lock,
  Download,
  Upload,
  Trash2,
  LifeBuoy,
  Volume2,
  Square,
  BellRing,
  BookOpen,
  Play,
} from "lucide-react";
import {
  CalcMethodId,
  DayPrayerLog,
  Locale,
  SalatiSettings,
} from "../types/salati";
import {
  ADHAN_MUEZZINS,
  CALC_METHODS,
  CITY_PRESETS,
  QURAN_RECITERS,
} from "../data/salatiContent";
import {
  decryptSalatiBackup,
  EncryptedBackupEnvelope,
  encryptSalatiBackup,
} from "../utils/audioAndCrypto";

interface SettingsBackupModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  settings: SalatiSettings;
  logs: Record<string, DayPrayerLog>;
  onUpdateSettings: (patch: Partial<SalatiSettings>) => void;
  onSelectReciter: (reciterId: string) => void;
  onTestAdhanAlarm: () => void;
  onRestoreMerged: (restoredSettings: SalatiSettings, restoredLogs: Record<string, DayPrayerLog>) => void;
  onClearAllLocalData: () => void;
}

export const SettingsBackupModal: React.FC<SettingsBackupModalProps> = ({
  open,
  onClose,
  locale,
  settings,
  logs,
  onUpdateSettings,
  onSelectReciter,
  onTestAdhanAlarm,
  onRestoreMerged,
  onClearAllLocalData,
}) => {
  const isAr = locale === "ar";
  const [passphrase, setPassphrase] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [feedback, setFeedback] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const selectedMuezzinId = settings.selectedMuezzinId || "yasser_dosari";
  const selectedReciterId = settings.selectedReciterId || "yasser_dosari";
  const autoPlayAdhan = settings.autoPlayAdhanAtPrayerTime !== false;
  const alarmIntervalSec =
    typeof settings.postAdhanAlarmIntervalSec === "number"
      ? settings.postAdhanAlarmIntervalSec
      : 60;

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setPreviewPlaying(false);
  };

  useEffect(() => {
    if (!open) {
      stopPreviewAudio();
    }
  }, [open]);

  if (!open) return null;

  const activeMuezzin =
    ADHAN_MUEZZINS.find((m) => m.id === selectedMuezzinId) || ADHAN_MUEZZINS[0];

  const handleToggleMuezzinPreview = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (previewPlaying) {
      stopPreviewAudio();
      return;
    }
    audio.src = `/api/adhan/audio/${encodeURIComponent(selectedMuezzinId)}`;
    audio.load();
    audio
      .play()
      .then(() => setPreviewPlaying(true))
      .catch(() => {
        setFeedback(
          isAr
            ? "تعذر تشغيل المعاينة الآن، حاول مرة أخرى."
            : "Unable to preview Adhan audio right now."
        );
      });
  };

  const handleUseBrowserGps = () => {
    if (!("geolocation" in navigator)) {
      setFeedback(isAr ? "المتصفح لا يدعم تحديد الموقع." : "Geolocation not supported.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onUpdateSettings({
          customCoords: {
            lat: Number(pos.coords.latitude.toFixed(4)),
            lng: Number(pos.coords.longitude.toFixed(4)),
            labelAr: isAr ? "موقعي الحالي (GPS)" : "Current GPS",
            labelEn: "Current GPS Location",
          },
        });
        setGpsLoading(false);
        setFeedback(isAr ? "تم تحديث المواقيت حسب موقعك الحالي." : "Updated prayer times to your current location.");
      },
      () => {
        setGpsLoading(false);
        setFeedback(isAr ? "تعذر الوصول للموقع؛ يمكنك اختيار المدينة يدوياً." : "Location permission declined; select a city manually.");
      },
      { timeout: 6000 }
    );
  };

  const handleExportBackup = async () => {
    if (passphrase.trim().length < 4) {
      setFeedback(isAr ? "أدخل كلمة مرور (4 أحرف على الأقل) لتشفير النسخة." : "Enter a passphrase (4+ chars) to encrypt the backup.");
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      const envelope = await encryptSalatiBackup(
        {
          settings: { ...settings, lastBackupAt: nowIso },
          logs,
          exportedAt: nowIso,
        },
        passphrase
      );
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salati-backup-${nowIso.slice(0, 10)}.salati.json`;
      a.click();
      URL.revokeObjectURL(url);
      onUpdateSettings({ lastBackupAt: nowIso });
      setFeedback(isAr ? "تم تنزيل النسخة الاحتياطية المشفرة AES-256 بنجاح." : "Encrypted AES-256 backup downloaded.");
    } catch {
      setFeedback(isAr ? "تعذر تشفير النسخة الاحتياطية." : "Failed to encrypt backup.");
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!restorePassphrase.trim()) {
      setFeedback(isAr ? "أدخل كلمة مرور فك التشفير أولاً." : "Enter your decryption passphrase first.");
      return;
    }
    try {
      const text = await file.text();
      const envelope = JSON.parse(text) as EncryptedBackupEnvelope;
      const payload = await decryptSalatiBackup(envelope, restorePassphrase);
      onRestoreMerged(payload.settings, payload.logs);
      setFeedback(isAr ? "تمت استعادة البيانات ودمج السجلات دون تكرار." : "Backup decrypted and safely merged without duplicates.");
    } catch {
      setFeedback(isAr ? "كلمة المرور غير صحيحة أو الملف غير صالح." : "Invalid passphrase or corrupted backup file.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <audio
        ref={previewAudioRef}
        preload="none"
        onEnded={() => setPreviewPlaying(false)}
        onError={() => setPreviewPlaying(false)}
      />

      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-emerald-900/70 bg-white dark:bg-[#0A1E1B] p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-emerald-900/50 pb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isAr ? "قائمة الإعدادات · الشيوخ والأذان والموقع" : "Settings · Reciters, Adhan & Location"}
          </h2>
          <button
            type="button"
            onClick={() => {
              stopPreviewAudio();
              onClose();
            }}
            aria-label={isAr ? "إغلاق" : "Close"}
            className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-emerald-900 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {feedback && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
            {feedback}
          </div>
        )}

        {/* 1. Muezzin (Adhan Sheikh), Quran Reciter & Post-Adhan 1-Min Repeating Alarm */}
        <section className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-[#071614] border border-emerald-700/30 dark:border-emerald-800/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{isAr ? "إعدادات المؤذن وقارئ القرآن والمنبه" : "Adhan Muezzin, Quran Reciter & Alarm"}</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                stopPreviewAudio();
                onClose();
                onTestAdhanAlarm();
              }}
              className="min-h-[34px] px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isAr ? "تجربة الأذان + منبه الدقيقة" : "Test Adhan + 1m Alarm"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Select Muezzin */}
            <div className="space-y-1.5">
              <label className="block space-y-1">
                <span className="text-slate-600 dark:text-stone-300 font-medium">
                  {isAr ? "الشيخ المؤذن (صوت الأذان عند دخول الوقت)" : "Muezzin (Adhan Sheikh Voice)"}
                </span>
                <select
                  value={selectedMuezzinId}
                  onChange={(e) => {
                    stopPreviewAudio();
                    onUpdateSettings({ selectedMuezzinId: e.target.value });
                  }}
                  className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#0A1E1B] text-slate-900 dark:text-stone-100 font-medium"
                >
                  {ADHAN_MUEZZINS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {isAr ? `${m.nameAr} (${m.locationAr})` : `${m.nameEn} (${m.locationEn})`}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-stone-400 truncate">
                  {isAr ? activeMuezzin.locationAr : activeMuezzin.locationEn} · {activeMuezzin.durationLabel}
                </span>
                <button
                  type="button"
                  onClick={handleToggleMuezzinPreview}
                  className={`min-h-[30px] px-2.5 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 ${
                    previewPlaying
                      ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "border-emerald-600/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  }`}
                >
                  {previewPlaying ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  <span>
                    {previewPlaying
                      ? isAr
                        ? "إيقاف المعاينة"
                        : "Stop"
                      : isAr
                      ? "سماع صوت الأذان"
                      : "Preview Adhan"}
                  </span>
                </button>
              </div>
            </div>

            {/* Select Quran Reciter */}
            <div className="space-y-1.5">
              <label className="block space-y-1">
                <span className="text-slate-600 dark:text-stone-300 font-medium flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{isAr ? "الشيخ القارئ (لتلاوة القرآن الكريم)" : "Quran Reciter (Full 114 Surahs)"}</span>
                </span>
                <select
                  value={selectedReciterId}
                  onChange={(e) => onSelectReciter(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#0A1E1B] text-slate-900 dark:text-stone-100 font-medium"
                >
                  {QURAN_RECITERS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {isAr ? `${r.nameAr} · ${r.originAr}` : `${r.nameEn} · ${r.originEn}`}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-stone-400 block">
                {isAr
                  ? "يتغير قارئ المصحف فوراً في كامل الموقع عند الاختيار."
                  : "Updates Quran recitation across the entire app immediately."}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70 dark:border-emerald-900/50 text-xs items-center">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-800 dark:text-stone-200 font-medium">
              <input
                type="checkbox"
                checked={autoPlayAdhan}
                onChange={(e) =>
                  onUpdateSettings({ autoPlayAdhanAtPrayerTime: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-600"
              />
              <span>
                {isAr
                  ? "إطلاق الأذان تلقائياً عند دخول وقت كل صلاة"
                  : "Auto-trigger Adhan when prayer time enters"}
              </span>
            </label>

            <label className="block space-y-1">
              <span className="text-slate-600 dark:text-stone-300 font-medium">
                {isAr
                  ? "تكرار المنبه بعد انتهاء الأذان (للقيام للصلاة)"
                  : "Post-Adhan Wake-Up Alarm Interval"}
              </span>
              <select
                value={alarmIntervalSec}
                onChange={(e) =>
                  onUpdateSettings({ postAdhanAlarmIntervalSec: Number(e.target.value) })
                }
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#0A1E1B]"
              >
                <option value={60}>
                  {isAr ? "كل 1 دقيقة حتى القيام للصلاة (موصى به)" : "Every 1 minute until dismissed (Recommended)"}
                </option>
                <option value={120}>
                  {isAr ? "كل دقيقتين" : "Every 2 minutes"}
                </option>
                <option value={180}>
                  {isAr ? "كل 3 دقائق" : "Every 3 minutes"}
                </option>
                <option value={0}>
                  {isAr ? "أذان فقط بدون منبه متكرر" : "Adhan only (no repeating alarm)"}
                </option>
              </select>
            </label>
          </div>
        </section>

        {/* 2. Location & Astronomical Method */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isAr ? "المدينة وطريقة الحساب" : "Location & Calculation Method"}</span>
            </h3>
            <button
              type="button"
              onClick={handleUseBrowserGps}
              disabled={gpsLoading}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              {gpsLoading
                ? isAr
                  ? "جارٍ التحديد..."
                  : "Detecting..."
                : isAr
                ? "تحديد موقعي تلقائياً (GPS)"
                : "Use Current GPS"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="space-y-1 block">
              <span className="text-slate-500 dark:text-stone-400">{isAr ? "المدينة" : "City"}</span>
              <select
                value={settings.cityId}
                onChange={(e) => {
                  const chosen = CITY_PRESETS.find((c) => c.id === e.target.value);
                  onUpdateSettings({
                    cityId: e.target.value,
                    customCoords: undefined,
                    calcMethod: chosen?.defaultMethod || settings.calcMethod,
                  });
                }}
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
              >
                {CITY_PRESETS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isAr ? `${c.nameAr} (${c.countryAr})` : `${c.nameEn} (${c.countryEn})`}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="text-slate-500 dark:text-stone-400">{isAr ? "طريقة الحساب" : "Calculation Method"}</span>
              <select
                value={settings.calcMethod}
                onChange={(e) => onUpdateSettings({ calcMethod: e.target.value as CalcMethodId })}
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
              >
                {CALC_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {isAr ? m.ar : m.en}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="text-slate-500 dark:text-stone-400">{isAr ? "مذهب العصر" : "Asr Juristic"}</span>
              <select
                value={settings.madhab}
                onChange={(e) => onUpdateSettings({ madhab: e.target.value as "shafi" | "hanafi" })}
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
              >
                <option value="shafi">{isAr ? "الجمهور (شافعي/مالكي/حنبلي)" : "Standard (Shafi / Maliki / Hanbali)"}</option>
                <option value="hanafi">{isAr ? "الحنفي" : "Hanafi"}</option>
              </select>
            </label>
          </div>
        </section>

        {/* 3. Encrypted Local Backup & Restore (Section 8) */}
        <section className="pt-4 border-t border-slate-100 dark:border-emerald-900/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{isAr ? "النسخ الاحتياطي المشفر (بدون حساب)" : "Encrypted Backup & Privacy (No Account)"}</span>
            </h3>
            {settings.lastBackupAt && (
              <span className="text-xs text-slate-500 dark:text-stone-400 font-mono-num">
                {isAr ? "آخر نسخة:" : "Last backup:"}{" "}
                {new Date(settings.lastBackupAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-stone-400 leading-relaxed">
            {isAr
              ? "يُحفظ سجل صلواتك وتفضيلاتك محلياً على جهازك. يمكنك تصدير ملف مشفر بـ AES-256 لنقله أو حفظه في iCloud / Google Drive."
              : "Your prayer log and preferences stay strictly on your device. Export an AES-256 encrypted file to store safely in iCloud or Google Drive."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 space-y-2">
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={isAr ? "كلمة مرور التشفير..." : "Encryption passphrase..."}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
              />
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full min-h-[38px] rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isAr ? "تصدير نسخة مشفرة" : "Export Encrypted Backup"}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 space-y-2">
              <input
                type="password"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                placeholder={isAr ? "كلمة مرور الاستعادة..." : "Decryption passphrase..."}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
              />
              <label className="w-full min-h-[38px] rounded-lg border border-slate-300 dark:border-emerald-800 flex items-center justify-center gap-1.5 font-semibold text-slate-700 dark:text-stone-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-emerald-950/60">
                <Upload className="w-3.5 h-3.5" />
                <span>{isAr ? "استعادة من ملف مشفر" : "Restore Encrypted File"}</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                onClearAllLocalData();
                setFeedback(isAr ? "تم مسح جميع البيانات المحلية." : "All local data cleared.");
              }}
              className="text-xs text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isAr ? "حذف جميع السجلات المحلية من هذا الجهاز" : "Delete all local records from this device"}</span>
            </button>
          </div>
        </section>

        {/* 4. Support Form (Zero prayer-log leakage) */}
        <SupportTicketMiniForm locale={locale} />
      </div>
    </div>
  );
};

const SupportTicketMiniForm: React.FC<{ locale: Locale }> = ({ locale }) => {
  const isAr = locale === "ar";
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSent, setTicketSent] = useState(false);

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: ticketSubject,
        message: ticketMessage,
        category: "User Feedback",
        locale,
      }),
    });
    if (res.ok) {
      setTicketSubject("");
      setTicketMessage("");
      setTicketSent(true);
    }
  };

  return (
    <section className="pt-4 border-t border-slate-100 dark:border-emerald-900/50 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <LifeBuoy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span>{isAr ? "إرسال ملاحظة أو طلب دعم فني" : "Send Support Request"}</span>
      </h3>
      {ticketSent ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          {isAr
            ? "تم إرسال تذكرتك إلى لوحة الدعم دون مشاركة أي بيانات شخصية أو سجل صلاة."
            : "Your inquiry was sent to the Support Queue with zero personal prayer data attached."}
        </p>
      ) : (
        <form onSubmit={handleSendSupport} className="space-y-2 text-xs">
          <input
            type="text"
            value={ticketSubject}
            onChange={(e) => setTicketSubject(e.target.value)}
            placeholder={isAr ? "عنوان الملاحظة أو الاستفسار..." : "Subject..."}
            className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={ticketMessage}
              onChange={(e) => setTicketMessage(e.target.value)}
              placeholder={isAr ? "تفاصيل الاستفسار..." : "Message details..."}
              className="flex-1 min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
            />
            <button
              type="submit"
              className="min-h-[38px] px-4 rounded-lg bg-slate-900 dark:bg-emerald-700 text-white font-semibold"
            >
              {isAr ? "إرسال" : "Send"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
