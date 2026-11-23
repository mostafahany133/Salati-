import React, { useState } from "react";
import {
  Bell,
  BookOpen,
  Compass,
  Volume2,
  SlidersHorizontal,
  Check,
  Sparkles,
  Calendar,
  MapPin,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Clock,
  Play,
  Pause,
} from "lucide-react";
import {
  AnnouncementItem,
  ComputedPrayerSlot,
  DayPrayerLog,
  Locale,
  PrayerId,
  PrayerNotificationRule,
  SalatiSettings,
} from "../types/salati";
import {
  ADHAN_SOUNDS,
  DAILY_ENCOURAGEMENTS,
  SALATI_IMAGES,
} from "../data/salatiContent";
import { OBLIGATORY_PRAYERS, toDateKey } from "../utils/prayerEngine";
import { playAdhanPreview } from "../utils/audioAndCrypto";

interface TodayDashboardProps {
  now: Date;
  locale: Locale;
  settings: SalatiSettings;
  cityLabel: string;
  gregorianDate: string;
  hijriDate: string;
  slots: ComputedPrayerSlot[];
  nextPrayer: ComputedPrayerSlot;
  countdownLabel: string;
  qiblaDegrees: number;
  logs: Record<string, DayPrayerLog>;
  announcements: AnnouncementItem[];
  onTogglePrayerLog: (dateKey: string, prayerId: PrayerId) => void;
  onUpdatePrayerRule: (prayerId: PrayerId, patch: Partial<PrayerNotificationRule>) => void;
  onStartJourney: () => void;
  onNavigateService: (subTab: "quran" | "adhkar" | "qibla") => void;
  onOpenAlarmTest: (slot: ComputedPrayerSlot) => void;
  onOpenSettings: () => void;
  isQuranPlaying: boolean;
  activeQuranSurahName: string;
  activeReciterName: string;
  onStartQuranRecitation: () => void;
  sunnahTimes?: {
    duhaStart: string;
    middleOfTheNight: string;
    lastThirdOfTheNight: string;
  };
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  now,
  locale,
  settings,
  cityLabel,
  gregorianDate,
  hijriDate,
  slots,
  nextPrayer,
  countdownLabel,
  qiblaDegrees,
  logs,
  announcements,
  onTogglePrayerLog,
  onUpdatePrayerRule,
  onStartJourney,
  onNavigateService,
  onOpenAlarmTest,
  onOpenSettings,
  isQuranPlaying,
  activeQuranSurahName,
  activeReciterName,
  onStartQuranRecitation,
  sunnahTimes,
}) => {
  const isAr = locale === "ar";
  const todayKey = toDateKey(now);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [editingRuleId, setEditingRuleId] = useState<PrayerId | null>(null);
  const [chartSpan, setChartSpan] = useState<7 | 30>(7);

  const todayLog = logs[todayKey]?.prayers || {
    fajr: false,
    dhuhr: false,
    asr: false,
    maghrib: false,
    isha: false,
  };
  const selectedDayLog = logs[selectedDateKey]?.prayers || {
    fajr: false,
    dhuhr: false,
    asr: false,
    maghrib: false,
    isha: false,
  };

  const todayLoggedCount = OBLIGATORY_PRAYERS.filter((p) => todayLog[p.id]).length;

  // Compute continuity streak from self-recorded entries (never judging unlogged days)
  const computeStreak = (): number => {
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = toDateKey(d);
      const dayEntry = logs[key]?.prayers;
      const count = dayEntry ? OBLIGATORY_PRAYERS.filter((p) => dayEntry[p.id]).length : 0;
      if (count > 0) {
        streak += 1;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };
  const streakDays = computeStreak();

  // Build 7 or 30 day series
  const historyBars = Array.from({ length: chartSpan }, (_, idx) => {
    const offset = chartSpan - 1 - idx;
    const d = new Date(now.getTime() - offset * 86400000);
    const key = toDateKey(d);
    const dayEntry = logs[key]?.prayers;
    const count = dayEntry ? OBLIGATORY_PRAYERS.filter((p) => dayEntry[p.id]).length : 0;
    const dayShort = new Intl.DateTimeFormat(isAr ? "ar-SA-u-nu-latn" : "en-US", {
      weekday: "narrow",
    }).format(d);
    return { key, count, dayShort, dayNum: d.getDate() };
  });

  const activeAnnouncement = announcements.find((a) => a.active);
  const encouragementIdx = now.getDate() % DAILY_ENCOURAGEMENTS.length;
  const encouragement = DAILY_ENCOURAGEMENTS[encouragementIdx];

  return (
    <div className="space-y-8">
      {/* HERO SPLIT: Dominant Countdown Sanctuary + Architectural Visual */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 sm:p-8 shadow-sm">
          <div className="space-y-5">
            {/* Clean unboxed metadata row with typographic separators (no pills) */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-stone-400">
              <div className="flex flex-wrap items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-amber-400/90 shrink-0" />
                <span className="tabular-nums">{hijriDate}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{gregorianDate}</span>
              </div>
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-500 rounded min-h-[32px] whitespace-nowrap shrink-0"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{cityLabel}</span>
              </button>
            </div>

            <div className="pt-2 space-y-2">
              <p className="text-sm font-medium text-emerald-700 dark:text-amber-300/90">
                {isAr ? "الصلاة القادمة" : "Upcoming Prayer"}
              </p>
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-stone-50">
                  {isAr ? nextPrayer.nameAr : nextPrayer.nameEn}
                </h1>
                <span className="text-2xl sm:text-3xl font-semibold text-emerald-700 dark:text-emerald-300 font-mono-num">
                  {nextPrayer.formattedTime}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-emerald-900/50 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-stone-400 mb-1">
                  {isAr ? "الوقت المتبقي للأذان" : "Time Remaining Until Adhan"}
                </p>
                <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white font-mono-num">
                  {countdownLabel}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenAlarmTest(nextPrayer)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-emerald-800/80 text-sm font-medium text-slate-700 dark:text-stone-200 hover:bg-slate-50 dark:hover:bg-emerald-950/60 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{isAr ? "معاينة المنبه" : "Test Alarm"}</span>
                </button>
                <button
                  type="button"
                  onClick={onStartJourney}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>{isAr ? "ابدأ الاستعداد للصلاة" : "Begin Prayer Preparation"}</span>
                  {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {settings.showDailyEncouragement && (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-emerald-900/50">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-stone-300 font-quran">
                {isAr ? encouragement.ar : encouragement.en}
              </p>
            </div>
          )}
        </div>

        {/* Visual Architectural Sanctuary Frame */}
        <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/60 bg-emerald-950 min-h-[260px]">
          <img
            src={SALATI_IMAGES.heroMosque}
            alt={isAr ? "رواق معماري إسلامي هادئ" : "Serene Islamic architectural sanctuary"}
            referrerPolicy="no-referrer"
            className="w-full h-full lg:h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#051210]/90 via-[#051210]/30 to-transparent flex flex-col justify-end p-6">
            <p className="text-xs text-amber-300/90 font-medium">
              {isAr ? "مبدأ صلاتي" : "Salati Guiding Principle"}
            </p>
            <p className="text-sm sm:text-base text-stone-100 mt-1 leading-relaxed">
              {isAr
                ? "رفيق هادئ يُعينك على الصلاة وينظّم يومك حول أوقاتها، دون مراقبة أو أحكام."
                : "A calm daily companion helping structure your day around prayer times—without judgment or surveillance."}
            </p>
          </div>
        </div>
      </section>

      {/* 4-COLUMN SUMMARY & SHORTCUT STRIP */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#0A1E1B] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
            <span>{isAr ? "تسجيلات اليوم الشخصية" : "Today's Self-Logged"}</span>
            <span className="font-mono-num text-emerald-700 dark:text-emerald-300 font-semibold">
              {todayLoggedCount} / {settings.dailyGoalPrayers}
            </span>
          </div>
          <div className="mt-3">
            <div className="h-2 rounded-full bg-slate-100 dark:bg-emerald-950 overflow-hidden">
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-400 transition-all duration-300"
                style={{
                  width: `${Math.min(100, (todayLoggedCount / Math.max(1, settings.dailyGoalPrayers)) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-stone-400">
              {isAr ? "بناءً على ما دونته يدوياً" : "Based strictly on your manual entries"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#0A1E1B] p-5 flex flex-col justify-between">
          <span className="text-xs text-slate-500 dark:text-stone-400">
            {isAr ? "سلسلة الاستمرارية" : "Continuity Streak"}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono-num">
              {streakDays}
            </span>
            <span className="text-sm text-slate-600 dark:text-stone-300">
              {isAr ? "أيام متواصلة" : "days active"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
            {isAr ? "بدون مقارنة مع الآخرين" : "Private to you · no public leaderboards"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateService("qibla")}
          className="text-start rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#0A1E1B] p-5 hover:border-emerald-600/60 transition-colors flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-stone-400">
            <span>{isAr ? "اتجاه القبلة" : "Qibla Azimuth"}</span>
            <Compass className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono-num">
            {qiblaDegrees}°
          </div>
          <span className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            {isAr ? "فتح البوصلة التفاعلية" : "Open interactive compass"}
          </span>
        </button>

        <div className="rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#0A1E1B] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-stone-400">
            <span className="truncate">{isAr ? `القرآن · ${activeReciterName}` : `Quran · ${activeReciterName}`}</span>
            <button
              type="button"
              onClick={() => onNavigateService("quran")}
              className="text-emerald-700 dark:text-emerald-300 hover:underline whitespace-nowrap shrink-0"
            >
              {isAr ? "المصحف" : "Read"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onStartQuranRecitation}
              className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                isQuranPlaying
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white"
              }`}
            >
              {isQuranPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="truncate">
                {isQuranPlaying
                  ? isAr
                    ? "إيقاف"
                    : "Pause"
                  : isAr
                  ? "بدء القرآن"
                  : "Play Quran"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateService("adhkar")}
              className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 dark:border-emerald-900/70 hover:bg-slate-50 dark:hover:bg-emerald-950/60 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{isAr ? "الأذكار" : "Adhkar"}</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-stone-400 truncate">
            {activeQuranSurahName}
          </p>
        </div>
      </section>

      {/* FIVE DAILY PRAYERS + ADHAN CUSTOMIZATION + GENTLE LOGGING */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-emerald-900/50">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isAr ? "مواقيت الصلاة والأذان والتسجيل" : "Daily Prayer Schedule & Gentle Log"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">
                {isAr
                  ? "اضغط لتسجيل الصلاة بعد أدائها، أو خصّص تنبيه كل صلاة على حدة"
                  : "Record prayers manually after performing them, or customize per-prayer Adhan alerts"}
              </p>
            </div>
            <input
              type="date"
              value={selectedDateKey}
              max={todayKey}
              onChange={(e) => e.target.value && setSelectedDateKey(e.target.value)}
              aria-label={isAr ? "اختيار تاريخ التسجيل" : "Select logging date"}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-emerald-950/60 text-xs text-slate-800 dark:text-stone-200 font-mono-num"
            />
          </div>

          <div className="divide-y divide-slate-100 dark:divide-emerald-900/40">
            {slots.map((slot) => {
              const isPrayer = slot.isObligatory;
              const prayerId = slot.id as PrayerId;
              const isLogged = isPrayer ? selectedDayLog[prayerId] : false;
              const rule = isPrayer ? settings.prayerRules[prayerId] : null;
              const isEditing = isPrayer && editingRuleId === prayerId;

              return (
                <div key={slot.id} className="py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2 h-8 rounded-full shrink-0 ${
                          slot.isNext
                            ? "bg-amber-500"
                            : isLogged
                            ? "bg-emerald-600 dark:bg-emerald-400"
                            : "bg-slate-200 dark:bg-emerald-900"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-stone-100">
                            {isAr ? slot.nameAr : slot.nameEn}
                          </span>
                          {slot.isNext && (
                            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                              · {isAr ? "القادمة" : "Next"}
                            </span>
                          )}
                          {!isPrayer && (
                            <span className="text-xs text-slate-500 dark:text-stone-400">
                              · {isAr ? "وقت إشراق" : "Solar Marker"}
                            </span>
                          )}
                        </div>
                        {rule && (
                          <p className="text-xs text-slate-500 dark:text-stone-400 truncate">
                            {rule.enabled
                              ? isAr
                                ? `أذان مفعّل · قبل الوقت بـ ${rule.preAlertMinutes} د${rule.repeatEvery5Min ? " · تكرار كل 5 د" : ""}`
                                : `Adhan active · ${rule.preAlertMinutes}m pre-alert${rule.repeatEvery5Min ? " · 5m repeat" : ""}`
                              : isAr
                              ? "التنبيه متوقف لهذه الصلاة"
                              : "Alert paused for this prayer"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-base font-semibold text-slate-900 dark:text-stone-100 font-mono-num px-2">
                        {slot.formattedTime}
                      </span>

                      {isPrayer && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingRuleId(isEditing ? null : prayerId)}
                            aria-label={isAr ? `إعدادات أذان ${slot.nameAr}` : `${slot.nameEn} alert settings`}
                            className={`min-h-[40px] min-w-[40px] rounded-lg border flex items-center justify-center transition-colors ${
                              isEditing
                                ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                                : "border-slate-200 dark:border-emerald-900/70 text-slate-500 dark:text-stone-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onTogglePrayerLog(selectedDateKey, prayerId)}
                            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              isLogged
                                ? "bg-emerald-700 text-white dark:bg-emerald-600"
                                : "border border-slate-200 dark:border-emerald-800/80 text-slate-700 dark:text-stone-200 hover:bg-slate-50 dark:hover:bg-emerald-950/70"
                            }`}
                          >
                            <Check className={`w-3.5 h-3.5 ${isLogged ? "opacity-100" : "opacity-40"}`} />
                            <span>
                              {isLogged
                                ? isAr
                                  ? "تم التسجيل"
                                  : "Logged"
                                : isAr
                                ? "تسجيل الصلاة"
                                : "Log Prayer"}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Per-Prayer Notification & Adhan Customization Panel */}
                  {isEditing && rule && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border border-slate-200 dark:border-emerald-900/70 space-y-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-stone-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) => onUpdatePrayerRule(prayerId, { enabled: e.target.checked })}
                            className="w-4 h-4 accent-emerald-600"
                          />
                          <span>{isAr ? "تفعيل الأذان والتنبيهات" : "Enable Adhan & alerts"}</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => playAdhanPreview(rule.sound)}
                          className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-700/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium inline-flex items-center gap-1.5 hover:bg-emerald-700/20"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{isAr ? "معاينة الصوت" : "Preview Sound"}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="space-y-1 block">
                          <span className="text-slate-500 dark:text-stone-400">
                            {isAr ? "صوت الأذان" : "Adhan Sound"}
                          </span>
                          <select
                            value={rule.sound}
                            onChange={(e) =>
                              onUpdatePrayerRule(prayerId, {
                                sound: e.target.value as PrayerNotificationRule["sound"],
                              })
                            }
                            className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#081A17] text-slate-900 dark:text-stone-100"
                          >
                            {ADHAN_SOUNDS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {isAr ? s.ar : s.en}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-1 block">
                          <span className="text-slate-500 dark:text-stone-400">
                            {isAr ? "تنبيه قبل الوقت (دقائق)" : "Pre-Alert (minutes)"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={60}
                            value={rule.preAlertMinutes}
                            onChange={(e) =>
                              onUpdatePrayerRule(prayerId, {
                                preAlertMinutes: Math.max(0, Math.min(60, Number(e.target.value) || 0)),
                              })
                            }
                            className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#081A17] text-slate-900 dark:text-stone-100 font-mono-num"
                          />
                        </label>

                        <label className="space-y-1 block">
                          <span className="text-slate-500 dark:text-stone-400">
                            {isAr ? "تعديل يدوي (دقائق)" : "Manual Offset (min)"}
                          </span>
                          <input
                            type="number"
                            min={-30}
                            max={30}
                            value={rule.manualOffsetMinutes}
                            onChange={(e) =>
                              onUpdatePrayerRule(prayerId, {
                                manualOffsetMinutes: Math.max(-30, Math.min(30, Number(e.target.value) || 0)),
                              })
                            }
                            className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#081A17] text-slate-900 dark:text-stone-100 font-mono-num"
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <label className="inline-flex items-center gap-2 text-slate-700 dark:text-stone-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.repeatEvery5Min}
                            onChange={(e) =>
                              onUpdatePrayerRule(prayerId, { repeatEvery5Min: e.target.checked })
                            }
                            className="w-4 h-4 accent-emerald-600"
                          />
                          <span>
                            {isAr
                              ? "تكرار لطيف كل 5 دقائق حتى الإيقاف أو التسجيل"
                              : "Repeat gently every 5m until stopped or logged"}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sunnahTimes && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-emerald-900/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#071614] border border-slate-200/80 dark:border-emerald-900/50 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600 dark:text-stone-300">
                  {isAr ? "بداية الضحى" : "Duha Begins"}
                </span>
                <span className="text-sm font-semibold font-mono-num text-emerald-700 dark:text-emerald-300">
                  {sunnahTimes.duhaStart}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#071614] border border-slate-200/80 dark:border-emerald-900/50 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600 dark:text-stone-300">
                  {isAr ? "منتصف الليل الشرعي" : "Islamic Midnight"}
                </span>
                <span className="text-sm font-semibold font-mono-num text-slate-900 dark:text-stone-100">
                  {sunnahTimes.middleOfTheNight}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#071614] border border-amber-500/30 flex items-center justify-between gap-2">
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  {isAr ? "الثلث الأخير (التهجد)" : "Last Third (Tahajjud)"}
                </span>
                <span className="text-sm font-semibold font-mono-num text-amber-700 dark:text-amber-300">
                  {sunnahTimes.lastThirdOfTheNight}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* WEEKLY / MONTHLY PERSONAL STATISTICS + BACKGROUND RELIABILITY NOTE */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {isAr ? "إحصائيات السجل الشخصي" : "Self-Recorded Commitment"}
              </h2>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-emerald-950/70">
                <button
                  type="button"
                  onClick={() => setChartSpan(7)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    chartSpan === 7
                      ? "bg-white dark:bg-emerald-800 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-stone-400"
                  }`}
                >
                  {isAr ? "7 أيام" : "7D"}
                </button>
                <button
                  type="button"
                  onClick={() => setChartSpan(30)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    chartSpan === 30
                      ? "bg-white dark:bg-emerald-800 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-stone-400"
                  }`}
                >
                  {isAr ? "30 يوماً" : "30D"}
                </button>
              </div>
            </div>

            <div className="mt-5 h-36 flex items-end gap-1.5">
              {historyBars.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setSelectedDateKey(b.key)}
                  title={`${b.key}: ${b.count}/5`}
                  className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group"
                >
                  <div className="w-full bg-slate-100 dark:bg-emerald-950/80 rounded-t-md h-24 flex items-end overflow-hidden">
                    <div
                      className={`w-full transition-all duration-300 rounded-t-md ${
                        b.key === selectedDateKey
                          ? "bg-amber-500"
                          : "bg-emerald-600 dark:bg-emerald-500/85 group-hover:bg-emerald-500"
                      }`}
                      style={{ height: `${(b.count / 5) * 100}%` }}
                    />
                  </div>
                  {chartSpan === 7 && (
                    <span className="text-[11px] text-slate-500 dark:text-stone-400 font-mono-num">
                      {b.dayShort}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-slate-500 dark:text-stone-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {isAr
                  ? "عدم تسجيل صلاة لا يعني عدم أدائها؛ لا تُسجل أي صلاة تلقائياً كفائتة، وهذه الأرقام مرجع شخصي لك وحدك."
                  : "Unlogged prayers are never automatically marked missed. All statistics remain strictly private on your device."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{isAr ? "موثوقية التنبيهات في الخلفية" : "Background Alert Reliability"}</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-stone-300">
              {isAr
                ? "قد تؤثر أوضاع توفير الطاقة أو عدم الإزعاج في النظام على تشغيل صوت المنبه؛ لذا يوفر التطبيق إشعارات بديلة وإعادة جدولة تلقائية عند تغير الموقع أو المنطقة الزمنية."
                : "System Focus modes or battery-saving restrictions can affect background audio. Salati pairs alerts with fallback reminders and automatic timezone rescheduling."}
            </p>
          </div>
        </div>
      </section>

      {/* NON-INTRUSIVE ADMIN ANNOUNCEMENT / ETHICAL SPONSORSHIP */}
      {activeAnnouncement && (
        <section className="rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-slate-50/70 dark:bg-[#091A17] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
              <span>
                {activeAnnouncement.type === "sponsorship"
                  ? isAr
                    ? "رعاية وقفية هادئة"
                    : "Ethical Sponsorship"
                  : isAr
                  ? "تنويه عام"
                  : "Community Notice"}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeAnnouncement.scheduleWindow}</span>
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-stone-100">
              {isAr ? activeAnnouncement.titleAr : activeAnnouncement.titleEn}
            </p>
            <p className="text-xs text-slate-600 dark:text-stone-400">
              {isAr ? activeAnnouncement.bodyAr : activeAnnouncement.bodyEn}
            </p>
          </div>
        </section>
      )}
    </div>
  );
};
