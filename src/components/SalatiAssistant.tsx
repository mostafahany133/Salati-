import React, { useState } from "react";
import { Send, ShieldCheck, BookOpen, AlertCircle, Scale } from "lucide-react";
import { AssistantReply, Locale } from "../types/salati";

interface SalatiAssistantProps {
  locale: Locale;
  cityLabel: string;
  nextPrayerLabel: string;
  loggedToday: number;
  streakDays: number;
  aiSuggestionsEnabled: boolean;
  onToggleAiSuggestions: () => void;
}

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  mode: "personal" | "islamic";
  text: string;
  reply?: AssistantReply;
}

export const SalatiAssistant: React.FC<SalatiAssistantProps> = ({
  locale,
  cityLabel,
  nextPrayerLabel,
  loggedToday,
  streakDays,
  aiSuggestionsEnabled,
  onToggleAiSuggestions,
}) => {
  const isAr = locale === "ar";
  const [mode, setMode] = useState<"personal" | "islamic">("personal");
  const [shareLocalContext, setShareLocalContext] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const starterPrompts =
    mode === "personal"
      ? isAr
        ? [
            "اقترح لي جدولاً هادئاً ينظم عملي حول أوقات الصلاة اليوم",
            "كيف أتهيأ لصلاة الفجر دون توتر أو قسوة على النفس؟",
            "أفضل وقت للاستعداد والوضوء قبل العصر والمغرب",
          ]
        : [
            "Suggest a calm daily schedule organized around today's prayer times",
            "How can I prepare gently for Fajr without burnout?",
            "Best 10-minute pre-prayer routine before Dhuhr or Asr",
          ]
      : isAr
      ? [
          "ما شروط صحة الوضوء باختصار مع المصدر؟",
          "ما حكم الجمع عند السفر مع اختلاف المذاهب بإيجاز؟",
          "أذكار ما بعد الصلاة الثابتة في الصحيحين",
        ]
      : [
          "What are the essential pillars of Wudu with authentic sources?",
          "Brief scholarly overview of combining prayers during travel",
          "Authentic post-prayer Adhkar from Sahih collections",
        ];

  const handleSubmit = async (promptText?: string) => {
    const text = (promptText ?? query).trim();
    if (!text || loading) return;

    setError(null);
    setLoading(true);
    if (!promptText) setQuery("");

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      mode,
      text,
    };
    setTurns((prev) => [...prev, userTurn]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          query: text,
          lang: locale,
          prayerContext:
            mode === "personal" && shareLocalContext
              ? {
                  city: cityLabel,
                  nextPrayer: nextPrayerLabel,
                  loggedToday,
                  streakDays,
                }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Assistant request failed");
      }
      const assistantTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        mode,
        text: data.answer,
        reply: data as AssistantReply,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err: any) {
      setError(err.message || (isAr ? "حدث خطأ غير متوقع." : "Unexpected error occurred."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Sidebar: Mode & Ethical Privacy Guardrails */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isAr ? "المساعد الذكي في صلاتي" : "Salati Ethical Assistant"}
          </h1>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-emerald-950/70">
            <button
              type="button"
              onClick={() => setMode("personal")}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === "personal"
                  ? "bg-white dark:bg-emerald-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-stone-400"
              }`}
            >
              {isAr ? "المساعد الشخصي" : "Personal Routine"}
            </button>
            <button
              type="button"
              onClick={() => setMode("islamic")}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === "islamic"
                  ? "bg-white dark:bg-emerald-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-stone-400"
              }`}
            >
              {isAr ? "المساعد الإسلامي" : "Islamic Reference"}
            </button>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-stone-300">
            {mode === "personal"
              ? isAr
                ? "يساعدك على تنظيم يومك حول مواقيت الصلاة واقتراح أوقات استعداد لطيفة دون إصدار أي حكم على عبادتك."
                : "Suggests practical daily routines around prayer times and gentle prep windows—never judging your worship."
              : isAr
              ? "يجيب اعتماداً على مصادر إسلامية معتمدة مع إظهار المرجع، وتوضيح مواطن الاختلاف أو عدم اليقين وتوجيه المسائل الدقيقة لأهل العلم."
              : "Answers strictly from established Islamic sources with explicit citations, uncertainty disclosure, and scholar guidance."}
          </p>

          <div className="pt-3 border-t border-slate-100 dark:border-emerald-900/40 space-y-3 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 dark:text-stone-200">
              <input
                type="checkbox"
                checked={aiSuggestionsEnabled}
                onChange={onToggleAiSuggestions}
                className="w-4 h-4 mt-0.5 accent-emerald-600"
              />
              <span>
                {isAr
                  ? "تفعيل الاقتراحات الذكية (يمكن تعطيلها والاعتماد على الوظائف الأساسية دون إنترنت)"
                  : "Enable AI suggestions (core prayer tools remain 100% available offline)"}
              </span>
            </label>

            {mode === "personal" && (
              <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 dark:text-stone-200">
                <input
                  type="checkbox"
                  checked={shareLocalContext}
                  onChange={(e) => setShareLocalContext(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-emerald-600"
                />
                <span>
                  {isAr
                    ? "موافقة صريحة: إرفاق ملخص سجل اليوم والمدينة الحالية مؤقتاً لتخصيص النصيحة"
                    : "Explicit consent: include today's logged count and active city for tailored scheduling"}
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-5 space-y-2 text-xs text-slate-500 dark:text-stone-400">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-stone-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{isAr ? "ضوابط الذكاء الاصطناعي" : "AI Integrity Guardrails"}</span>
          </div>
          <ul className="space-y-1.5 leading-relaxed">
            <li>• {isAr ? "لا يدّعي معرفة أداء المستخدم للصلاة." : "Never claims to verify whether you prayed."}</li>
            <li>• {isAr ? "لا يختلق أحاديث أو آيات أو أحكاماً فقهية." : "Never fabricates Hadith, verses, or rulings."}</li>
            <li>• {isAr ? "تُحفظ خصوصيتك ولا تُرسل بيانات شخصية إلا بموافقتك." : "No personal data sent without explicit opt-in."}</li>
          </ul>
        </div>
      </div>

      {/* Main Chat & Grounded Citations Area */}
      <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 flex flex-col min-h-[520px] justify-between space-y-5">
        {!aiSuggestionsEnabled ? (
          <div className="my-auto text-center space-y-3 py-12">
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {isAr ? "الاقتراحات الذكية متوقفة باختيارك" : "AI Suggestions Are Paused"}
            </p>
            <p className="text-xs text-slate-500 dark:text-stone-400 max-w-md mx-auto">
              {isAr
                ? "جميع خدمات صلاتي الأساسية من مواقيت وأذان وقرآن وأذكار تعمل بكفاءة كاملة دون الاعتماد على الذكاء الاصطناعي."
                : "All core Salati prayer times, Adhan alerts, Quran, and Adhkar work completely without AI."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[480px] pe-1">
              {turns.length === 0 && (
                <div className="space-y-4 py-6">
                  <p className="text-sm text-slate-600 dark:text-stone-300">
                    {isAr
                      ? "اختر سؤالاً مقترحاً أو اكتب استفسارك بأسلوب هادئ:"
                      : "Choose a starter prompt or type your question below:"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {starterPrompts.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleSubmit(p)}
                        className="text-start min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] hover:border-emerald-600 text-xs text-slate-700 dark:text-stone-200 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((turn) => (
                <div
                  key={turn.id}
                  className={`p-4 rounded-xl border ${
                    turn.role === "user"
                      ? "bg-emerald-700/10 dark:bg-emerald-900/30 border-emerald-600/25 ms-8"
                      : "bg-slate-50 dark:bg-[#071614] border-slate-200 dark:border-emerald-900/60 me-4 space-y-3"
                  }`}
                >
                  <p className="text-xs font-semibold text-emerald-700 dark:text-amber-300 mb-1">
                    {turn.role === "user"
                      ? isAr
                        ? "أنت"
                        : "You"
                      : turn.mode === "personal"
                      ? isAr
                        ? "المساعد الشخصي"
                        : "Personal Companion"
                      : isAr
                      ? "المساعد الإسلامي"
                      : "Islamic Reference"}
                  </p>
                  <p className="text-sm text-slate-800 dark:text-stone-100 leading-relaxed whitespace-pre-line">
                    {turn.text}
                  </p>

                  {turn.reply && (
                    <div className="pt-3 border-t border-slate-200/80 dark:border-emerald-900/50 space-y-2.5 text-xs">
                      {turn.reply.sources?.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" />
                            {isAr ? "المصادر والمراجع:" : "Referenced Sources:"}
                          </span>
                          <ul className="space-y-0.5 text-slate-600 dark:text-stone-300">
                            {turn.reply.sources.map((src, i) => (
                              <li key={i}>• {src}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {turn.reply.uncertaintyNote && (
                        <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{turn.reply.uncertaintyNote}</span>
                        </div>
                      )}

                      {turn.reply.scholarNote && (
                        <div className="flex items-start gap-2 text-slate-500 dark:text-stone-400">
                          <Scale className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{turn.reply.scholarNote}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-slate-50 dark:bg-[#071614] text-xs text-slate-500 dark:text-stone-400">
                  {isAr ? "جارٍ مراجعة المصادر وصياغة الإجابة..." : "Reviewing verified references..."}
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-emerald-900/50"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  mode === "personal"
                    ? isAr
                      ? "اسأل عن تنظيم وقتك حول الصلاة..."
                      : "Ask about organizing your day around prayer..."
                    : isAr
                    ? "اسأل سؤالاً دينياً موثقاً بالمصدر..."
                    : "Ask a religious question with verified sources..."
                }
                className="flex-1 min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-sm text-slate-900 dark:text-stone-100"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>{isAr ? "إرسال" : "Send"}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
