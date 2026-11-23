import React, { useState } from "react";
import {
  CheckCircle2,
  Droplets,
  Sparkles,
  Camera,
  Trash2,
  SkipForward,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import { ComputedPrayerSlot, DayPrayerLog, Locale, PrayerId } from "../types/salati";
import { SALATI_IMAGES, WUDU_STEPS } from "../data/salatiContent";
import { toDateKey } from "../utils/prayerEngine";

interface PreparationJourneyProps {
  now: Date;
  locale: Locale;
  nextPrayer: ComputedPrayerSlot;
  beginnerMode: boolean;
  onToggleBeginnerMode: () => void;
  logs: Record<string, DayPrayerLog>;
  onLogPrayer: (dateKey: string, prayerId: PrayerId) => void;
  onSaveMatPhoto: (dateKey: string, dataUrl: string | undefined) => void;
  onExitToToday: () => void;
}

export const PreparationJourney: React.FC<PreparationJourneyProps> = ({
  now,
  locale,
  nextPrayer,
  beginnerMode,
  onToggleBeginnerMode,
  logs,
  onLogPrayer,
  onSaveMatPhoto,
  onExitToToday,
}) => {
  const isAr = locale === "ar";
  const todayKey = toDateKey(now);
  const [stage, setStage] = useState<number>(1);
  const [completedWuduSteps, setCompletedWuduSteps] = useState<number[]>([]);
  const currentMatPhoto = logs[todayKey]?.matPhotoDataUrl;

  const targetPrayerId: PrayerId = nextPrayer.isObligatory ? (nextPrayer.id as PrayerId) : "fajr";
  const alreadyLogged = logs[todayKey]?.prayers?.[targetPrayerId] || false;

  const stages = [
    { id: 1, ar: "1. التوقف والنية", en: "1. Pause & Intention" },
    { id: 2, ar: "2. الوضوء والطهارة", en: "2. Wudu & Purity" },
    { id: 3, ar: "3. تهيئة المكان", en: "3. Prepare Space" },
    { id: 4, ar: "4. سجادة الصلاة", en: "4. Prayer Mat" },
    { id: 5, ar: "5. تسجيل الصلاة", en: "5. Log Completion" },
  ];

  const handleToggleWuduStep = (stepNum: number) => {
    setCompletedWuduSteps((prev) =>
      prev.includes(stepNum) ? prev.filter((s) => s !== stepNum) : [...prev, stepNum]
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onSaveMatPhoto(todayKey, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Header & Stage Progress */}
      <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-amber-300">
              {isAr ? "رحلة الاستعداد لصلاة" : "Preparation Journey for"}{" "}
              {isAr ? nextPrayer.nameAr : nextPrayer.nameEn} · {nextPrayer.formattedTime}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {isAr ? "من التنبيه إلى السكينة بين يدي الله" : "From Gentle Alert to Mindful Prayer"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStage(1);
                setCompletedWuduSteps([]);
              }}
              className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 dark:border-emerald-900 text-xs font-medium text-slate-600 dark:text-stone-300 hover:bg-slate-50 dark:hover:bg-emerald-950 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? "إعادة البدء" : "Restart"}</span>
            </button>
            <button
              type="button"
              onClick={onExitToToday}
              className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 dark:border-emerald-900 text-xs font-medium text-slate-600 dark:text-stone-300 hover:bg-slate-50 dark:hover:bg-emerald-950"
            >
              {isAr ? "إيقاف الرحلة" : "Exit Journey"}
            </button>
          </div>
        </div>

        {/* Clickable Stage Stepper */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {stages.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStage(s.id)}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-start transition-colors border ${
                stage === s.id
                  ? "bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-600 dark:border-emerald-600"
                  : stage > s.id
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
                  : "bg-slate-50 dark:bg-[#081614] text-slate-600 dark:text-stone-400 border-slate-200 dark:border-emerald-900/50"
              }`}
            >
              {isAr ? s.ar : s.en}
            </button>
          ))}
        </div>
      </div>

      {/* Stage 1: Intention */}
      {stage === 1 && (
        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isAr ? "استحضار النية وفصل النفس عن المشاغل" : "Pause Daily Tasks & Renew Intention"}
            </h2>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-stone-300 max-w-2xl">
            {isAr
              ? "ضع ما في يدك جانباً لدقائق قليلة. تذكّر أن الصلاة صلةٌ ومناجاةٌ تمنح القلب سكينةً لا عجلة فيها. خذ نفساً عميقاً وانوِ الوضوء والصلاة خالصة لوجه الله."
              : "Set aside ongoing tasks for a few minutes. Remember that prayer is a tranquil conversation with Allah—step away from urgency and breathe calmly."}
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStage(2)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-sm font-semibold"
            >
              {isAr ? "الانتقال إلى الوضوء" : "Proceed to Wudu"}
            </button>
            <button
              type="button"
              onClick={() => setStage(stage + 1)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-emerald-900 text-sm text-slate-600 dark:text-stone-300 inline-flex items-center gap-1.5"
            >
              <SkipForward className="w-4 h-4" />
              <span>{isAr ? "تخطي المرحلة" : "Skip Stage"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Wudu Interactive Educational Guide */}
      {stage === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B]">
            <img
              src={SALATI_IMAGES.wuduSanctuary}
              alt={isAr ? "مكان هادئ للوضوء" : "Tranquil ablution fountain"}
              referrerPolicy="no-referrer"
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {isAr ? "الوضع التعليمي للمبتدئين" : "Beginner Learning Mode"}
                </span>
                <button
                  type="button"
                  onClick={onToggleBeginnerMode}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold ${
                    beginnerMode
                      ? "bg-emerald-700 text-white dark:bg-emerald-600"
                      : "border border-slate-300 dark:border-emerald-800 text-slate-600 dark:text-stone-300"
                  }`}
                >
                  {beginnerMode ? (isAr ? "مفعّل" : "On") : isAr ? "إيقاف" : "Off"}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-stone-400 leading-relaxed">
                {isAr
                  ? "اضغط على كل خطوة لتعليمها أثناء الوضوء مع عرض الإرشادات التوضيحية وأذكار الوضوء الموثقة."
                  : "Tap each step as you complete it, with practical guidance and verified Wudu supplications."}
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStage(3)}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-sm font-semibold"
                >
                  {isAr ? "أتممت الوضوء" : "Wudu Complete"}
                </button>
                <button
                  type="button"
                  onClick={() => setStage(3)}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-emerald-900 text-xs text-slate-600 dark:text-stone-300"
                >
                  {isAr ? "تخطي" : "Skip"}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] divide-y divide-slate-100 dark:divide-emerald-900/40">
            {WUDU_STEPS.map((w) => {
              const checked = completedWuduSteps.includes(w.step);
              return (
                <button
                  key={w.step}
                  type="button"
                  onClick={() => handleToggleWuduStep(w.step)}
                  className="w-full text-start p-5 hover:bg-slate-50/70 dark:hover:bg-emerald-950/30 transition-colors flex items-start gap-4"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono-num text-sm font-bold ${
                      checked
                        ? "bg-emerald-700 text-white dark:bg-emerald-500"
                        : "bg-slate-100 dark:bg-emerald-950 text-slate-700 dark:text-stone-300"
                    }`}
                  >
                    {checked ? <CheckCircle2 className="w-4 h-4" /> : w.step}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {isAr ? w.titleAr : w.titleEn}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed">
                      {isAr ? w.detailAr : w.detailEn}
                    </p>
                    {beginnerMode && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300/90">
                        {isAr ? w.beginnerTipAr : w.beginnerTipEn}
                      </p>
                    )}
                    {w.dhikrAr && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-[#071614] border border-slate-200 dark:border-emerald-900/60">
                        <p className="font-quran text-base text-slate-900 dark:text-amber-200">
                          {w.dhikrAr}
                        </p>
                        {w.dhikrSource && (
                          <p className="text-[11px] text-slate-500 dark:text-stone-400 mt-1">
                            {w.dhikrSource}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage 3: Prepare Prayer Space */}
      {stage === 3 && (
        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 sm:p-8 space-y-5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {isAr ? "تجهيز مكان الصلاة والسترة والهدوء" : "Prepare Your Prayer Space & Quiet"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-emerald-900/60">
              <p className="font-semibold text-slate-900 dark:text-white">
                {isAr ? "طهارة المكان والثوب" : "Clean Space & Attire"}
              </p>
              <p className="text-xs text-slate-600 dark:text-stone-300 mt-1.5 leading-relaxed">
                {isAr
                  ? "تأكد من نظافة الموضع وارتداء ملابس ساترة مريحة تساعد على الخشوع."
                  : "Ensure a clean floor spot and modest, comfortable clothing."}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-emerald-900/60">
              <p className="font-semibold text-slate-900 dark:text-white">
                {isAr ? "التوجه نحو القبلة" : "Face the Qibla"}
              </p>
              <p className="text-xs text-slate-600 dark:text-stone-300 mt-1.5 leading-relaxed">
                {isAr
                  ? "استقبل جهة القبلة وضع سترة يسيرة أمامك إن كنت تصلي منفرداً."
                  : "Orient your mat toward the Qibla and reduce visual distractions ahead."}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-emerald-900/60">
              <p className="font-semibold text-slate-900 dark:text-white">
                {isAr ? "كتم التنبيهات المشتتة" : "Silence Distractions"}
              </p>
              <p className="text-xs text-slate-600 dark:text-stone-300 mt-1.5 leading-relaxed">
                {isAr
                  ? "فعّل الوضع الصامت في هاتفك لبضع دقائق لتصلي بقلب حاضر."
                  : "Pause phone notifications for a few minutes to protect focus."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStage(4)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-sm font-semibold"
            >
              {isAr ? "الانتقال إلى السجادة" : "Step Onto Prayer Mat"}
            </button>
            <button
              type="button"
              onClick={() => setStage(4)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-emerald-900 text-sm text-slate-600 dark:text-stone-300"
            >
              {isAr ? "تخطي" : "Skip"}
            </button>
          </div>
        </div>
      )}

      {/* Stage 4: Prayer Mat & Optional Local-Only Photo Keepsake */}
      {stage === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/60 bg-emerald-950">
            <img
              src={currentMatPhoto || SALATI_IMAGES.prayerMat}
              alt={isAr ? "سجادة الصلاة" : "Prayer mat"}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover min-h-[240px]"
            />
          </div>
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isAr ? "الوصول إلى سجادة الصلاة" : "Arriving at the Prayer Mat"}
              </h2>
              <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed">
                {isAr
                  ? "أنت الآن مهيّأ للوقوف بين يدي الله. صلِّ بطمأنينة وتأنٍّ في الركوع والسجود."
                  : "You are ready to stand in prayer. Take unhurried stillness in every bowing and prostration."}
              </p>

              {/* Strictly Optional Local Photo Keepsake (Section 5.6 Guardrails) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border border-slate-200 dark:border-emerald-900/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {isAr ? "توثيق شخصي اختياري للسجادة (محلي فقط)" : "Optional Local Prayer Space Note"}
                  </span>
                  {currentMatPhoto && (
                    <button
                      type="button"
                      onClick={() => onSaveMatPhoto(todayKey, undefined)}
                      className="text-xs text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isAr ? "حذف الصورة" : "Delete Photo"}</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-stone-400 leading-relaxed">
                  {isAr
                    ? "ميزة اختيارية بالكامل ولا تُعد شرطاً لتسجيل الصلاة. تبقى الصورة على جهازك فقط ولا تُرفع للخادم ولا يدّعي النظام التحقق من الصلاة عبرها."
                    : "Completely optional and never required to log prayer. Stored locally on your device only—never uploaded or used to verify worship."}
                </p>
                <label className="inline-flex items-center gap-2 min-h-[38px] px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-emerald-800 bg-white dark:bg-[#081A17] text-xs font-medium text-slate-700 dark:text-stone-200 cursor-pointer hover:bg-slate-50">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isAr ? "اختيار صورة من الجهاز" : "Choose Local Photo"}</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStage(5)}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-sm font-semibold"
              >
                {isAr ? "أتممت الصلاة — المتابعة للتسجيل" : "Completed Prayer — Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 5: Manual Completion Log */}
      {stage === 5 && (
        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300">
            <BookOpen className="w-5 h-5" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isAr ? "تقبّل الله طاعتك" : "May Your Prayer Be Accepted"}
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-stone-300 max-w-2xl leading-relaxed">
            {isAr
              ? "يمكنك تسجيل إتمام الصلاة الآن في سجلك الشخصي، أو العودة للرئيسية في أي وقت. تذكّر أذكار بعد الصلاة في قسم الخدمات الإسلامية."
              : "Record this prayer in your personal log if you wish, or return to Today anytime. Post-prayer Adhkar await in Islamic Services."}
          </p>
          <div className="flex flex-wrap gap-3">
            {!alreadyLogged && (
              <button
                type="button"
                onClick={() => {
                  onLogPrayer(todayKey, targetPrayerId);
                  onExitToToday();
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-sm font-semibold"
              >
                {isAr
                  ? `تسجيل صلاة ${nextPrayer.isObligatory ? nextPrayer.nameAr : "الفجر"} الآن`
                  : `Log ${nextPrayer.isObligatory ? nextPrayer.nameEn : "Fajr"} Now`}
              </button>
            )}
            <button
              type="button"
              onClick={onExitToToday}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-emerald-900 text-sm font-medium text-slate-700 dark:text-stone-200"
            >
              {isAr ? "العودة للشاشة الرئيسية" : "Return to Today"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
