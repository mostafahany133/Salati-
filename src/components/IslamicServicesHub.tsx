import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Sparkles,
  ScrollText,
  Compass,
  Calendar,
  MapPin,
  Headphones,
  Search,
  Bookmark,
  Star,
  RotateCcw,
  Volume2,
  Download,
  ExternalLink,
  AlertTriangle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Mic2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  VolumeX,
  Type,
  Plus,
} from "lucide-react";
import {
  AdminContentItem,
  Locale,
  MosquePlace,
  QuranReciter,
  QuranSurahDetail,
  QuranSurahMeta,
  SalatiSettings,
} from "../types/salati";
import {
  HIJRI_OCCASIONS,
  QURAN_SURAHS,
  SALATI_IMAGES,
} from "../data/salatiContent";
import { playAdhanPreview, playSoftTasbihClick } from "../utils/audioAndCrypto";

export type ServiceSubTab =
  | "quran"
  | "adhkar"
  | "hadith"
  | "qibla"
  | "hijri"
  | "mosques"
  | "audio";

export interface QuranPlayerController {
  surahs: QuranSurahMeta[];
  reciters: QuranReciter[];
  selectedReciterId: string;
  activeSurahNumber: number;
  activeSurahDetail: QuranSurahDetail | null;
  loadingSurah: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  hasStarted: boolean;
  currentTime: number;
  duration: number;
  autoAdvance: boolean;
  sleepTimerRemainingSec: number | null;
  sleepAfterSurah: boolean;
  error: string | null;
  onSelectReciter: (reciterId: string) => void;
  onStartOrTogglePlay: (surahNumber?: number) => void;
  onSelectSurah: (surahNumber: number, autoPlayIfPlaying?: boolean) => void;
  onNextSurah: () => void;
  onPrevSurah: () => void;
  onSeek: (timeSeconds: number) => void;
  onToggleAutoAdvance: () => void;
  onSetSleepTimer: (mode: "off" | "surah" | 15 | 30 | 60) => void;
}

interface IslamicServicesHubProps {
  now: Date;
  locale: Locale;
  activeSubTab: ServiceSubTab;
  onChangeSubTab: (t: ServiceSubTab) => void;
  settings: SalatiSettings;
  qiblaDegrees: number;
  activeCoords: { lat: number; lng: number; nameAr: string; nameEn: string };
  adminContent: AdminContentItem[];
  onToggleFavorite: (id: string) => void;
  onToggleBookmarkAyah: (key: string) => void;
  onToggleOfflineAudio: (audioId: string) => void;
  onUpdateHijriOffset: (offset: number) => void;
  quranPlayer: QuranPlayerController;
}

function formatAudioSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const IslamicServicesHub: React.FC<IslamicServicesHubProps> = ({
  now,
  locale,
  activeSubTab,
  onChangeSubTab,
  settings,
  qiblaDegrees,
  activeCoords,
  adminContent,
  onToggleFavorite,
  onToggleBookmarkAyah,
  onToggleOfflineAudio,
  onUpdateHijriOffset,
  quranPlayer,
}) => {
  const isAr = locale === "ar";
  const [searchQuery, setSearchQuery] = useState("");
  const [surahFilterQuery, setSurahFilterQuery] = useState("");
  const [reciterSearchQuery, setReciterSearchQuery] = useState("");
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const [showTafsir, setShowTafsir] = useState(true);
  const [quranFontSize, setQuranFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");

  // Adhkar & Digital Tasbih state
  const [dhikrFilter, setDhikrFilter] = useState<"all" | "morning" | "evening" | "prayer" | "duas" | "favorites">("all");
  const [dhikrCounts, setDhikrCounts] = useState<Record<string, number>>({});
  const [tasbihPresetIdx, setTasbihPresetIdx] = useState(0);
  const [tasbihCount, setTasbihCount] = useState(0);
  const [tasbihTarget, setTasbihTarget] = useState<number>(33);
  const [tasbihSound, setTasbihSound] = useState(true);
  const [tasbihLifetime, setTasbihLifetime] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("salati_tasbih_lifetime_v1")) || 0;
    } catch {
      return 0;
    }
  });

  const TASBIH_PRESETS = [
    {
      id: "post_prayer_1",
      ar: "سبحان الله",
      en: "SubhanAllah (Glory be to Allah)",
      defaultTarget: 33,
      cycleNext: true,
    },
    {
      id: "post_prayer_2",
      ar: "الحمد لله",
      en: "Alhamdulillah (Praise be to Allah)",
      defaultTarget: 33,
      cycleNext: true,
    },
    {
      id: "post_prayer_3",
      ar: "الله أكبر",
      en: "Allahu Akbar (Allah is Greatest)",
      defaultTarget: 34,
      cycleNext: false,
    },
    {
      id: "istighfar",
      ar: "أستغفر الله العظيم وأتوب إليه",
      en: "Astaghfirullah al-Azim (I seek Allah's forgiveness)",
      defaultTarget: 100,
      cycleNext: false,
    },
    {
      id: "salawat",
      ar: "اللهم صلِّ وسلم على نبينا محمد ﷺ",
      en: "Allahumma salli 'ala Muhammad ﷺ",
      defaultTarget: 100,
      cycleNext: false,
    },
    {
      id: "baqiyat",
      ar: "سبحان الله وبحمده، سبحان الله العظيم",
      en: "SubhanAllahi wa bihamdihi, SubhanAllahil-Azim",
      defaultTarget: 100,
      cycleNext: false,
    },
    {
      id: "tahlil",
      ar: "لا إله إلا الله وحده لا شريك له",
      en: "La ilaha illAllahu wahdahu la sharika lah",
      defaultTarget: 100,
      cycleNext: false,
    },
  ];

  const activeTasbih = TASBIH_PRESETS[tasbihPresetIdx] || TASBIH_PRESETS[0];

  const handleTasbihTap = () => {
    const next = tasbihCount + 1;
    const hitTarget = tasbihTarget > 0 && next >= tasbihTarget;
    if (tasbihSound) {
      playSoftTasbihClick(hitTarget);
    }
    const newLifetime = tasbihLifetime + 1;
    setTasbihLifetime(newLifetime);
    try {
      localStorage.setItem("salati_tasbih_lifetime_v1", String(newLifetime));
    } catch {
      // ignore
    }

    if (hitTarget && activeTasbih.cycleNext && tasbihPresetIdx < 2) {
      const nextIdx = tasbihPresetIdx + 1;
      setTasbihPresetIdx(nextIdx);
      setTasbihCount(0);
      setTasbihTarget(TASBIH_PRESETS[nextIdx].defaultTarget);
    } else if (tasbihTarget > 0 && next > tasbihTarget) {
      setTasbihCount(1);
    } else {
      setTasbihCount(next);
    }
  };

  // Qibla state
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [manualHeading, setManualHeading] = useState<number>(0);
  const [sensorStatus, setSensorStatus] = useState<"idle" | "listening" | "unsupported">("idle");

  // Nearby mosques state
  const [mosques, setMosques] = useState<MosquePlace[]>([]);
  const [mosqueLoading, setMosqueLoading] = useState(false);
  const [mosqueMessage, setMosqueMessage] = useState<string>("");

  // Audio player state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  useEffect(() => {
    if (activeSubTab !== "qibla") return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const webkitHeading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof webkitHeading === "number") {
        setDeviceHeading(Math.round(webkitHeading));
        setSensorStatus("listening");
      } else if (typeof e.alpha === "number") {
        setDeviceHeading(Math.round((360 - e.alpha) % 360));
        setSensorStatus("listening");
      }
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [activeSubTab]);

  const requestCompassSensor = async () => {
    const devOrient = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (devOrient && typeof devOrient.requestPermission === "function") {
      try {
        const res = await devOrient.requestPermission();
        setSensorStatus(res === "granted" ? "listening" : "unsupported");
      } catch {
        setSensorStatus("unsupported");
      }
    } else if ("DeviceOrientationEvent" in window) {
      setSensorStatus("listening");
    } else {
      setSensorStatus("unsupported");
    }
  };

  const findNearbyMosques = async (useBrowserGps: boolean) => {
    setMosqueLoading(true);
    setMosqueMessage("");
    let lat = activeCoords.lat;
    let lng = activeCoords.lng;

    if (useBrowserGps && "geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        setMosqueMessage(
          isAr
            ? "لم يُمنح إذن الموقع الدقيق؛ يتم البحث حول المدينة المختارة."
            : "GPS permission declined; searching around your selected city."
        );
      }
    }

    try {
      const res = await fetch(`/api/mosques?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (Array.isArray(data.mosques) && data.mosques.length > 0) {
        setMosques(data.mosques);
      } else {
        setMosques([]);
        setMosqueMessage(
          isAr
            ? "لا تتوفر نتائج فورية في الوضع غير المتصل أو النطاق المختار؛ يمكنك فتح الخريطة مباشرة."
            : "No live results returned in offline or local mode; you can open external Maps directly."
        );
      }
    } catch {
      setMosqueMessage(
        isAr ? "تعذر البحث حالياً، تأكد من الاتصال بالشبكة." : "Unable to search mosques right now."
      );
    } finally {
      setMosqueLoading(false);
    }
  };

  const tabs: { id: ServiceSubTab; ar: string; en: string; icon: React.ReactNode }[] = [
    { id: "quran", ar: "القرآن والتفسير", en: "Quran & Tafsir", icon: <BookOpen className="w-4 h-4" /> },
    { id: "adhkar", ar: "الأذكار والأدعية", en: "Adhkar & Duas", icon: <Sparkles className="w-4 h-4" /> },
    { id: "hadith", ar: "الحديث النبوي", en: "Hadith", icon: <ScrollText className="w-4 h-4" /> },
    { id: "qibla", ar: "القبلة", en: "Qibla", icon: <Compass className="w-4 h-4" /> },
    { id: "hijri", ar: "التقويم الهجري", en: "Hijri Calendar", icon: <Calendar className="w-4 h-4" /> },
    { id: "mosques", ar: "المساجد القريبة", en: "Mosques", icon: <MapPin className="w-4 h-4" /> },
    { id: "audio", ar: "المكتبة الصوتية", en: "Audio Library", icon: <Headphones className="w-4 h-4" /> },
  ];

  const publishedContent = adminContent.filter((c) => c.published);
  const adhkarItems = publishedContent.filter((c) => c.kind === "adhkar");
  const hadithItems = publishedContent.filter((c) => c.kind === "hadith");
  const audioItems = publishedContent.filter((c) => c.kind === "audio");

  const fallbackDetail: QuranSurahDetail = (() => {
    const local = QURAN_SURAHS[0];
    return {
      number: 1,
      nameAr: local.nameAr,
      nameEn: local.nameEn,
      englishMeaning: "The Opening",
      revelationType: "Meccan",
      numberOfAyahs: local.ayahs.length,
      tafsirSourceAr: local.tafsirSourceAr,
      tafsirSourceEn: local.tafsirSourceEn,
      ayahs: local.ayahs.map((a) => ({
        num: a.num,
        ar: a.ar,
        en: a.en,
        tafsirAr: a.tafsirAr,
        tafsirEn: a.tafsirEn,
      })),
    };
  })();

  const activeSurah = quranPlayer.activeSurahDetail || fallbackDetail;
  const activeMeta =
    quranPlayer.surahs.find((s) => s.number === quranPlayer.activeSurahNumber) ||
    quranPlayer.surahs[0];
  const activeReciter =
    quranPlayer.reciters.find((r) => r.id === quranPlayer.selectedReciterId) ||
    quranPlayer.reciters[0];

  const filteredReciters = quranPlayer.reciters.filter((r) => {
    const q = reciterSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      r.nameAr.includes(reciterSearchQuery.trim()) ||
      r.nameEn.toLowerCase().includes(q) ||
      r.styleAr.includes(reciterSearchQuery.trim()) ||
      r.styleEn.toLowerCase().includes(q) ||
      r.originAr.includes(reciterSearchQuery.trim()) ||
      r.originEn.toLowerCase().includes(q)
    );
  });

  const filteredSurahList = quranPlayer.surahs.filter((s) => {
    const q = surahFilterQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(s.number) === q ||
      s.nameAr.includes(surahFilterQuery.trim()) ||
      s.nameEn.toLowerCase().includes(q) ||
      s.englishMeaning.toLowerCase().includes(q)
    );
  });

  const filteredAdhkar = adhkarItems.filter((item) => {
    const matchesCat =
      dhikrFilter === "all"
        ? true
        : dhikrFilter === "favorites"
        ? settings.favoriteIds.includes(item.id)
        : item.category === dhikrFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.titleAr.includes(searchQuery) ||
      item.titleEn.toLowerCase().includes(q) ||
      item.bodyAr.includes(searchQuery);
    return matchesCat && matchesQuery;
  });

  const filteredHadith = hadithItems.filter((h) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      !q ||
      h.titleAr.includes(searchQuery) ||
      h.titleEn.toLowerCase().includes(q) ||
      h.bodyAr.includes(searchQuery) ||
      h.source.includes(searchQuery)
    );
  });

  const effectiveHeading = deviceHeading ?? manualHeading;
  const relativeQiblaRotation = (qiblaDegrees - effectiveHeading + 360) % 360;

  return (
    <div className="space-y-6">
      {/* Sub-navigation Segmented Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeSubTab(tab.id)}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === tab.id
                ? "bg-emerald-700 text-white dark:bg-emerald-600"
                : "text-slate-600 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-emerald-950/60"
            }`}
          >
            {tab.icon}
            <span>{isAr ? tab.ar : tab.en}</span>
          </button>
        ))}
      </div>

      {/* 6.1 QURAN & TAFSIR — FULL 114 SURAHS + SHEIKH YASSER AL-DOSARI */}
      {activeSubTab === "quran" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 114-Surah Mushaf Index */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] overflow-hidden">
            <img
              src={SALATI_IMAGES.quranMushaf}
              alt={isAr ? "المصحف الشريف" : "Illuminated Quran"}
              referrerPolicy="no-referrer"
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="p-4 space-y-3 border-t border-slate-100 dark:border-emerald-900/40">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
                <span>
                  {isAr
                    ? `فهرس المصحف (${quranPlayer.surahs.length} سورة)`
                    : `Mushaf Index (${quranPlayer.surahs.length} Surahs)`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTafsir(!showTafsir)}
                  className="text-emerald-700 dark:text-emerald-300 font-medium hover:underline"
                >
                  {showTafsir
                    ? isAr
                      ? "إخفاء التفسير"
                      : "Hide Tafsir"
                    : isAr
                    ? "عرض التفسير"
                    : "Show Tafsir"}
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-3 start-3" />
                <input
                  type="text"
                  value={surahFilterQuery}
                  onChange={(e) => setSurahFilterQuery(e.target.value)}
                  placeholder={isAr ? "ابحث باسم السورة أو رقمها..." : "Filter by Surah name or #..."}
                  className="w-full min-h-[38px] ps-9 pe-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
                />
              </div>

              <div className="space-y-1 max-h-[460px] overflow-y-auto pe-1">
                {filteredSurahList.map((s) => {
                  const isCurrent = quranPlayer.activeSurahNumber === s.number;
                  const isThisPlaying = isCurrent && quranPlayer.isPlaying;
                  return (
                    <div
                      key={s.number}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors ${
                        isCurrent
                          ? "bg-emerald-700 text-white dark:bg-emerald-600"
                          : "hover:bg-slate-50 dark:hover:bg-emerald-950/60 text-slate-800 dark:text-stone-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => quranPlayer.onSelectSurah(s.number, quranPlayer.isPlaying)}
                        className="flex-1 text-start flex items-center gap-2.5 min-w-0 py-0.5"
                      >
                        <span className="font-mono-num text-xs opacity-80 w-7 shrink-0">
                          {String(s.number).padStart(3, "0")}
                        </span>
                        <span className="font-semibold truncate">
                          {isAr ? s.nameAr : `${s.nameEn} · ${s.nameAr}`}
                        </span>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] opacity-80 font-mono-num">
                          {s.numberOfAyahs} {isAr ? "آية" : "v"}
                        </span>
                        <button
                          type="button"
                          onClick={() => quranPlayer.onStartOrTogglePlay(s.number)}
                          aria-label={
                            isThisPlaying
                              ? isAr
                                ? `إيقاف ${s.nameAr}`
                                : `Pause ${s.nameEn}`
                              : isAr
                              ? `تشغيل ${s.nameAr}`
                              : `Play ${s.nameEn}`
                          }
                          className={`min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center transition-colors ${
                            isCurrent
                              ? "bg-white/20 hover:bg-white/30 text-white"
                              : "border border-slate-200 dark:border-emerald-900 hover:bg-emerald-700 hover:text-white dark:hover:bg-emerald-600"
                          }`}
                        >
                          {isThisPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Reciter Switcher + Continuous Player + Surah Reader */}
          <div className="lg:col-span-8 space-y-5">
            {/* Continuous Recitation Player */}
            <div className="rounded-2xl border border-emerald-700/40 dark:border-emerald-700/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {isAr
                      ? `تلاوة متواصلة · القارئ ${activeReciter.nameAr}`
                      : `Continuous Mushaf Recitation · ${activeReciter.nameEn}`}
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-quran mt-1">
                    {activeMeta
                      ? isAr
                        ? `${activeMeta.number}. ${activeMeta.nameAr}`
                        : `${activeMeta.number}. ${activeMeta.nameEn} · ${activeMeta.nameAr}`
                      : isAr
                      ? activeSurah.nameAr
                      : activeSurah.nameEn}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">
                    {isAr
                      ? `${activeSurah.numberOfAyahs} آية · التلاوة تنتقل تلقائياً للسورة التالية بالترتيب`
                      : `${activeSurah.numberOfAyahs} Ayahs · Auto-advances to the next Surah in Mushaf order`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={quranPlayer.onPrevSurah}
                    disabled={quranPlayer.activeSurahNumber <= 1}
                    aria-label={isAr ? "السورة السابقة" : "Previous Surah"}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-emerald-900 flex items-center justify-center text-slate-700 dark:text-stone-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-emerald-950"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => quranPlayer.onStartOrTogglePlay(quranPlayer.activeSurahNumber)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    {quranPlayer.isPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>{isAr ? "إيقاف مؤقت" : "Pause"}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>
                          {quranPlayer.hasStarted
                            ? isAr
                              ? "متابعة التلاوة"
                              : "Resume"
                            : isAr
                            ? "بدء القرآن"
                            : "Start Quran"}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={quranPlayer.onNextSurah}
                    disabled={quranPlayer.activeSurahNumber >= 114}
                    aria-label={isAr ? "السورة التالية" : "Next Surah"}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-emerald-900 flex items-center justify-center text-slate-700 dark:text-stone-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-emerald-950"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Reciter Switcher Bar */}
              <div className="pt-3 border-t border-slate-100 dark:border-emerald-900/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mic2 className="w-4 h-4 text-emerald-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-800 dark:text-stone-100 block truncate">
                        {isAr ? activeReciter.nameAr : activeReciter.nameEn}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-stone-400 block truncate">
                        {isAr
                          ? `${activeReciter.styleAr} · ${activeReciter.originAr}`
                          : `${activeReciter.styleEn} · ${activeReciter.originEn}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={quranPlayer.selectedReciterId}
                      onChange={(e) => quranPlayer.onSelectReciter(e.target.value)}
                      aria-label={isAr ? "اختر القارئ" : "Select Quran Reciter"}
                      className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs font-medium text-slate-800 dark:text-stone-100 max-w-[230px]"
                    >
                      {quranPlayer.reciters.map((r) => (
                        <option key={r.id} value={r.id}>
                          {isAr ? r.nameAr : r.nameEn}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowReciterPicker((v) => !v)}
                      className="min-h-[38px] px-3 rounded-lg border border-emerald-700/40 dark:border-emerald-700 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>
                        {isAr
                          ? `كل الشيوخ (${quranPlayer.reciters.length})`
                          : `All Qaris (${quranPlayer.reciters.length})`}
                      </span>
                      {showReciterPicker ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {showReciterPicker && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#071614] border border-slate-200 dark:border-emerald-900/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600 dark:text-stone-300">
                        {isAr
                          ? "أشهر القرّاء وأعذب الأصوات في العالم الإسلامي (مصحف كامل 114 سورة)"
                          : "Most Listened & Melodious Quran Reciters (Full 114-Surah Mushaf)"}
                      </span>
                      <div className="relative min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 start-2.5" />
                        <input
                          type="text"
                          value={reciterSearchQuery}
                          onChange={(e) => setReciterSearchQuery(e.target.value)}
                          placeholder={isAr ? "ابحث باسم الشيخ..." : "Search reciter..."}
                          className="w-full min-h-[34px] ps-8 pe-2.5 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#0A1E1B] text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pe-1">
                      {filteredReciters.map((reciter) => {
                        const isSelected = reciter.id === quranPlayer.selectedReciterId;
                        return (
                          <button
                            key={reciter.id}
                            type="button"
                            onClick={() => {
                              quranPlayer.onSelectReciter(reciter.id);
                              setShowReciterPicker(false);
                            }}
                            className={`text-start p-3 rounded-xl border transition-colors flex items-start justify-between gap-2 ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-700 text-white dark:bg-emerald-600"
                                : "border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] text-slate-800 dark:text-stone-100 hover:border-emerald-500/60"
                            }`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <span className="text-xs sm:text-sm font-semibold block truncate">
                                {isAr ? reciter.nameAr : reciter.nameEn}
                              </span>
                              <span
                                className={`text-[11px] block truncate ${
                                  isSelected
                                    ? "text-emerald-50"
                                    : "text-slate-500 dark:text-stone-400"
                                }`}
                              >
                                {isAr
                                  ? `${reciter.styleAr} · ${reciter.originAr}`
                                  : `${reciter.styleEn} · ${reciter.originEn}`}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 shrink-0 mt-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Scrubber & Time */}
              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={quranPlayer.duration || 100}
                  value={Math.min(quranPlayer.currentTime, quranPlayer.duration || 100)}
                  onChange={(e) => quranPlayer.onSeek(Number(e.target.value))}
                  aria-label={isAr ? "موضع التلاوة" : "Recitation progress"}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-stone-400">
                  <span className="font-mono-num">
                    {formatAudioSeconds(quranPlayer.currentTime)} / {formatAudioSeconds(quranPlayer.duration)}
                    {quranPlayer.isBuffering ? (isAr ? " · جارٍ التحميل..." : " · Loading...") : ""}
                  </span>

                  <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={quranPlayer.autoAdvance}
                      onChange={quranPlayer.onToggleAutoAdvance}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span>
                      {isAr
                        ? "تشغيل السورة التالية تلقائياً عند الانتهاء"
                        : "Auto-play next Surah when finished"}
                    </span>
                  </label>
                </div>

                {/* Sleep Timer Bar */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-stone-300 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>
                      {quranPlayer.sleepAfterSurah
                        ? isAr
                          ? "مؤقت النوم: سيتوقف عند نهاية السورة"
                          : "Sleep timer: Stops after Surah"
                        : quranPlayer.sleepTimerRemainingSec !== null
                        ? isAr
                          ? `مؤقت النوم: يتوقف بعد ${formatAudioSeconds(quranPlayer.sleepTimerRemainingSec)}`
                          : `Sleep timer: Stops in ${formatAudioSeconds(quranPlayer.sleepTimerRemainingSec)}`
                        : isAr
                        ? "مؤقت النوم التلقائي للتلاوة:"
                        : "Recitation Sleep Timer:"}
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: "off", ar: "إيقاف", en: "Off" },
                        { id: 15, ar: "15 د", en: "15m" },
                        { id: 30, ar: "30 د", en: "30m" },
                        { id: 60, ar: "60 د", en: "60m" },
                        { id: "surah", ar: "نهاية السورة", en: "End of Surah" },
                      ] as const
                    ).map((opt) => {
                      const isActive =
                        (opt.id === "off" && !quranPlayer.sleepAfterSurah && quranPlayer.sleepTimerRemainingSec === null) ||
                        (opt.id === "surah" && quranPlayer.sleepAfterSurah);
                      return (
                        <button
                          key={String(opt.id)}
                          type="button"
                          onClick={() => quranPlayer.onSetSleepTimer(opt.id)}
                          className={`min-h-[30px] px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                            isActive
                              ? "border-emerald-600 bg-emerald-700 text-white dark:bg-emerald-600"
                              : "border-slate-200 dark:border-emerald-900 text-slate-600 dark:text-stone-300 hover:bg-slate-50 dark:hover:bg-emerald-950/60"
                          }`}
                        >
                          {isAr ? opt.ar : opt.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {quranPlayer.error && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{quranPlayer.error}</p>
              )}
            </div>

            {/* Ayah & Tafsir Reader */}
            <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-emerald-900/40">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-quran">
                    {isAr ? activeSurah.nameAr : activeSurah.nameEn}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                    {activeSurah.revelationType} · {isAr ? activeSurah.tafsirSourceAr : activeSurah.tafsirSourceEn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Quran Font Size Controls */}
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]">
                    <Type className="w-3.5 h-3.5 text-slate-400 mx-1" />
                    {(
                      [
                        { id: "sm", label: "ص", labelEn: "S" },
                        { id: "md", label: "ع", labelEn: "M" },
                        { id: "lg", label: "ك", labelEn: "L" },
                        { id: "xl", label: "ك+", labelEn: "XL" },
                      ] as const
                    ).map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setQuranFontSize(sz.id)}
                        className={`min-h-[28px] px-2 rounded text-[11px] font-semibold transition-colors ${
                          quranFontSize === sz.id
                            ? "bg-emerald-700 text-white dark:bg-emerald-600"
                            : "text-slate-600 dark:text-stone-300 hover:bg-slate-200/70 dark:hover:bg-emerald-950"
                        }`}
                      >
                        {isAr ? sz.label : sz.labelEn}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isAr ? "ابحث في الآيات..." : "Search ayahs..."}
                      className="w-full min-h-[40px] ps-9 pe-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs text-slate-800 dark:text-stone-100"
                    />
                  </div>
                </div>
              </div>

              {/* Saved Bookmarks Quick Jump Strip */}
              {settings.bookmarkedAyahKeys.some((k) => /^\d+:\d+$/.test(k)) && (
                <div className="flex flex-wrap items-center gap-2 text-xs pb-2 border-b border-slate-100 dark:border-emerald-900/40">
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{isAr ? "علاماتك المرجعية:" : "Bookmarked Ayahs:"}</span>
                  </span>
                  {settings.bookmarkedAyahKeys
                    .filter((k) => /^\d+:\d+$/.test(k))
                    .slice(0, 8)
                    .map((key) => {
                      const [sNumStr, aNumStr] = key.split(":");
                      const sNum = Number(sNumStr);
                      const sMeta = quranPlayer.surahs.find((s) => s.number === sNum);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => quranPlayer.onSelectSurah(sNum, quranPlayer.isPlaying)}
                          className="min-h-[30px] px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 font-medium hover:bg-amber-500/20"
                        >
                          {sMeta ? (isAr ? `${sMeta.nameAr} (${aNumStr})` : `${sMeta.nameEn} ${aNumStr}`) : key}
                        </button>
                      );
                    })}
                </div>
              )}

              {quranPlayer.loadingSurah ? (
                <div className="py-10 text-center text-sm text-slate-500 dark:text-stone-400">
                  {isAr ? "جارٍ تحميل آيات السورة والتفسير..." : "Loading Surah verses & Tafsir..."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-emerald-900/40">
                  {activeSurah.ayahs
                    .filter((a) => {
                      const q = searchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        a.ar.includes(searchQuery) ||
                        a.en.toLowerCase().includes(q) ||
                        a.tafsirAr.includes(searchQuery) ||
                        (a.tafsirEn || "").toLowerCase().includes(q)
                      );
                    })
                    .map((ayah) => {
                      const bKey = `${activeSurah.number}:${ayah.num}`;
                      const bookmarked = settings.bookmarkedAyahKeys.includes(bKey);
                      const tafsirText = isAr
                        ? ayah.tafsirAr
                        : ayah.tafsirEn || ayah.en;
                      const tafsirHeading = isAr
                        ? activeSurah.tafsirSourceAr
                        : activeSurah.tafsirSourceEn;
                      const fontCls =
                        quranFontSize === "sm"
                          ? "text-xl sm:text-2xl leading-[2]"
                          : quranFontSize === "lg"
                          ? "text-3xl sm:text-4xl leading-[2.25]"
                          : quranFontSize === "xl"
                          ? "text-4xl sm:text-5xl leading-[2.3]"
                          : "text-2xl sm:text-3xl leading-[2.15]";
                      return (
                        <div key={ayah.num} className="py-5 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <p
                              className={`font-quran ${fontCls} text-slate-900 dark:text-stone-50 text-right flex-1`}
                              dir="rtl"
                            >
                              {ayah.ar}{" "}
                              <span className="text-base text-amber-600 dark:text-amber-400 font-mono-num">
                                ﴿{ayah.num}﴾
                              </span>
                            </p>
                            <button
                              type="button"
                              onClick={() => onToggleBookmarkAyah(bKey)}
                              aria-label={isAr ? "حفظ علامة مرجعية" : "Bookmark ayah"}
                              className={`min-h-[38px] min-w-[38px] rounded-lg border flex items-center justify-center shrink-0 ${
                                bookmarked
                                  ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                                  : "border-slate-200 dark:border-emerald-900 text-slate-400 hover:text-slate-700"
                              }`}
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </div>
                          {ayah.en && (
                            <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed" dir="ltr">
                              {ayah.en}
                            </p>
                          )}
                          {showTafsir && tafsirText && (
                            <div
                              dir={isAr ? "rtl" : "ltr"}
                              className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#071614] border border-slate-200 dark:border-emerald-900/50 text-xs space-y-1.5"
                            >
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300 block">
                                {tafsirHeading}
                              </span>
                              <p className="text-slate-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                                {tafsirText}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6.2 ADHKAR & DUAS + INTERACTIVE DIGITAL TASBIH */}
      {activeSubTab === "adhkar" && (
        <div className="space-y-6">
          {/* Interactive Digital Tasbih */}
          <div className="rounded-2xl border border-emerald-700/40 dark:border-emerald-700/60 bg-white dark:bg-[#0A1E1B] p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      {isAr ? "السبحة الإلكترونية الشخصية" : "Personal Digital Tasbih"}
                    </p>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-quran mt-1">
                      {isAr ? activeTasbih.ar : activeTasbih.en}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTasbihSound((v) => !v)}
                      aria-label={isAr ? "تبديل صوت التسبيح" : "Toggle Tasbih click sound"}
                      className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 text-xs inline-flex items-center gap-1.5 text-slate-600 dark:text-stone-300"
                    >
                      {tasbihSound ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5" />}
                      <span>{tasbihSound ? (isAr ? "صوت ناعم" : "Sound On") : isAr ? "صامت" : "Muted"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasbihCount(0)}
                      aria-label={isAr ? "تصفير الدورة الحالية" : "Reset current cycle"}
                      className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 text-xs inline-flex items-center gap-1.5 text-slate-600 dark:text-stone-300 hover:bg-slate-50 dark:hover:bg-emerald-950"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isAr ? "تصفير" : "Reset"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {TASBIH_PRESETS.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setTasbihPresetIdx(idx);
                        setTasbihCount(0);
                        setTasbihTarget(p.defaultTarget);
                      }}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        tasbihPresetIdx === idx
                          ? "border-emerald-600 bg-emerald-700 text-white dark:bg-emerald-600"
                          : "border-slate-200 dark:border-emerald-900 text-slate-600 dark:text-stone-300 hover:bg-slate-50 dark:hover:bg-emerald-950/60"
                      }`}
                    >
                      {isAr ? p.ar : p.en}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-emerald-900/40 text-xs text-slate-500 dark:text-stone-400">
                  <div className="flex items-center gap-1.5">
                    <span>{isAr ? "الهدف:" : "Target:"}</span>
                    {[33, 99, 100, 0].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTasbihTarget(t)}
                        className={`min-h-[30px] px-2.5 rounded-lg border font-mono-num ${
                          tasbihTarget === t
                            ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold"
                            : "border-slate-200 dark:border-emerald-900"
                        }`}
                      >
                        {t === 0 ? "∞" : t}
                      </button>
                    ))}
                  </div>
                  <span className="font-mono-num">
                    {isAr ? `إجمالي تسبيحك المحفوظ: ${tasbihLifetime}` : `Lifetime saved dhikr: ${tasbihLifetime}`}
                  </span>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleTasbihTap}
                  className="w-40 h-40 rounded-full border-4 border-emerald-600/30 dark:border-amber-400/30 bg-emerald-700 hover:bg-emerald-800 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-lg flex flex-col items-center justify-center gap-1 transition-transform select-none"
                >
                  <span className="text-4xl font-bold font-mono-num">{tasbihCount}</span>
                  <span className="text-xs opacity-90 font-mono-num">
                    {tasbihTarget > 0 ? `/ ${tasbihTarget}` : isAr ? "مفتوح" : "Open"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-200 mt-1">
                    <Plus className="w-3 h-3" />
                    <span>{isAr ? "اضغط للتسبيح" : "Tap to Count"}</span>
                  </span>
                </button>
                {tasbihPresetIdx < 2 && (
                  <p className="text-[11px] text-slate-500 dark:text-stone-400 text-center">
                    {isAr
                      ? "تنتقل السبحة تلقائياً: سبحان الله 33 ← الحمد لله 33 ← الله أكبر 34"
                      : "Auto-cycles post-prayer Tasbih: 33 → 33 → 34"}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", ar: "الكل", en: "All" },
                  { id: "morning", ar: "الصباح", en: "Morning" },
                  { id: "evening", ar: "المساء", en: "Evening" },
                  { id: "prayer", ar: "بعد الصلاة", en: "After Prayer" },
                  { id: "duas", ar: "أدعية", en: "Duas" },
                  { id: "favorites", ar: "المفضلة", en: "Favorites" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDhikrFilter(f.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    dhikrFilter === f.id
                      ? "bg-emerald-700 text-white dark:bg-emerald-600"
                      : "border border-slate-200 dark:border-emerald-900 text-slate-600 dark:text-stone-300"
                  }`}
                >
                  {isAr ? f.ar : f.en}
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "بحث في الأذكار..." : "Search Adhkar..."}
                className="w-full min-h-[40px] ps-9 pe-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#0A1E1B] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAdhkar.map((item) => {
              const target = item.repeatCount || 1;
              const current = dhikrCounts[item.id] || 0;
              const isFav = settings.favoriteIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {isAr ? item.titleAr : item.titleEn}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">
                          {item.source} · {item.gradeOrRights}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(item.id)}
                        aria-label={isAr ? "إضافة للمفضلة" : "Toggle favorite"}
                        className={`min-h-[36px] min-w-[36px] rounded-lg border flex items-center justify-center ${
                          isFav
                            ? "border-amber-500 bg-amber-500/10 text-amber-500"
                            : "border-slate-200 dark:border-emerald-900 text-slate-400"
                        }`}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-quran text-lg leading-loose text-slate-900 dark:text-stone-100" dir="rtl">
                      {item.bodyAr}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-stone-400 leading-relaxed" dir="ltr">
                      {item.bodyEn}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-emerald-900/40 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDhikrCounts((prev) => ({
                          ...prev,
                          [item.id]: current >= target ? target : current + 1,
                        }))
                      }
                      className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold font-mono-num transition-colors ${
                        current >= target
                          ? "bg-emerald-700 text-white dark:bg-emerald-600"
                          : "bg-slate-100 dark:bg-emerald-950 text-slate-800 dark:text-emerald-200 hover:bg-emerald-700/15"
                      }`}
                    >
                      {isAr ? `تكرار: ${current} / ${target}` : `Count: ${current} / ${target}`}
                    </button>
                    {current > 0 && (
                      <button
                        type="button"
                        onClick={() => setDhikrCounts((prev) => ({ ...prev, [item.id]: 0 }))}
                        aria-label={isAr ? "تصفير العداد" : "Reset counter"}
                        className="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6.3 HADITH COLLECTION */}
      {activeSubTab === "hadith" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-stone-400">
              {isAr
                ? "تُعرض الأحاديث الموثقة مع المصدر ودرجة الصحة فقط دون نشر روايات غير محققة."
                : "Only authenticated narrations with explicit collection sources and scholarly grades are published."}
            </p>
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "ابحث في الأحاديث والمصادر..." : "Search Hadith & sources..."}
                className="w-full min-h-[40px] ps-9 pe-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#0A1E1B] text-xs"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredHadith.map((h) => (
              <article
                key={h.id}
                className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {isAr ? h.titleAr : h.titleEn}
                  </h3>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {h.source} · {h.gradeOrRights}
                  </span>
                </div>
                <p className="font-quran text-lg leading-loose text-slate-900 dark:text-stone-100" dir="rtl">
                  {h.bodyAr}
                </p>
                <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed" dir="ltr">
                  {h.bodyEn}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* 6.4 QIBLA INTERACTIVE COMPASS */}
      {activeSubTab === "qibla" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-8 flex flex-col items-center justify-center">
            <div className="relative w-64 h-64 rounded-full border-2 border-slate-200 dark:border-emerald-800/80 flex items-center justify-center bg-slate-50 dark:bg-[#071614]">
              <span className="absolute top-3 text-xs font-mono-num text-slate-500">N 0°</span>
              <span className="absolute bottom-3 text-xs font-mono-num text-slate-500">S 180°</span>
              <span className="absolute end-3 text-xs font-mono-num text-slate-500">E</span>
              <span className="absolute start-3 text-xs font-mono-num text-slate-500">W</span>

              <div
                className="w-44 h-44 flex items-center justify-center transition-transform duration-300"
                style={{ transform: `rotate(${relativeQiblaRotation}deg)` }}
              >
                <div className="relative flex flex-col items-center">
                  <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[46px] border-b-emerald-600 dark:border-b-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-slate-900 dark:bg-white -mt-1" />
                  <div className="w-1.5 h-12 bg-slate-300 dark:bg-emerald-800 rounded-b" />
                </div>
              </div>
            </div>

            <div className="mt-6 text-center space-y-1">
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono-num">
                {qiblaDegrees}° {isAr ? "من الشمال" : "from True North"}
              </p>
              <p className="text-xs text-slate-500 dark:text-stone-400">
                {isAr ? activeCoords.nameAr : activeCoords.nameEn}
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isAr ? "بوصلة القبلة ومعايرة المستشعرات" : "Qibla Compass & Sensor Calibration"}
            </h2>
            <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed">
              {isAr
                ? "تم حساب زاوية القبلة بدقة فلكية لموقعك المختار. على الهواتف، فعّل مستشعر الاتجاه وحرّك الجهاز على شكل رقم (8) بعيداً عن المعادن للمعايرة."
                : "Computed via great-circle bearings for your active coordinates. On mobile devices, enable compass orientation and move your phone in a figure-8 away from magnetic interference."}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={requestCompassSensor}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-xs font-semibold"
              >
                {sensorStatus === "listening"
                  ? isAr
                    ? "مستشعر البوصلة نشط"
                    : "Compass Sensor Active"
                  : isAr
                  ? "تفعيل مستشعر الجهاز"
                  : "Enable Device Compass"}
              </button>
              <span className="text-xs text-slate-500 dark:text-stone-400 font-mono-num">
                {deviceHeading !== null
                  ? `${isAr ? "اتجاه الجهاز:" : "Device Heading:"} ${deviceHeading}°`
                  : isAr
                  ? "وضع المعاينة اليدوية لسطح المكتب"
                  : "Desktop manual heading preview"}
              </span>
            </div>

            <label className="block space-y-1.5 pt-2">
              <span className="text-xs text-slate-500 dark:text-stone-400">
                {isAr ? `معاينة اتجاه الجهاز يدوياً (${manualHeading}°)` : `Manual Orientation Preview (${manualHeading}°)`}
              </span>
              <input
                type="range"
                min={0}
                max={359}
                value={manualHeading}
                onChange={(e) => {
                  setDeviceHeading(null);
                  setManualHeading(Number(e.target.value));
                }}
                className="w-full accent-emerald-600"
              />
            </label>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {isAr
                  ? "تنبيه الدقة: إذا لاحظت اهتزازاً في المؤشر أو ضعفاً في قراءة المستشعر، أعد معايرة البوصلة أو استعن بمعالم المسجد القريب."
                  : "Sensor accuracy notice: If readings drift near metal or indoor wiring, recalibrate in a figure-8 or verify against local landmarks."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6.5 HIJRI CALENDAR */}
      {activeSubTab === "hijri" && (
        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-emerald-900/40">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isAr ? "التقويم الهجري والمناسبات الإسلامية" : "Hijri Calendar & Islamic Milestones"}
              </h2>
              <p className="text-sm text-emerald-700 dark:text-amber-300 mt-1 font-mono-num">
                {new Intl.DateTimeFormat(
                  isAr ? "ar-SA-u-ca-islamic-umalqura-nu-latn" : "en-US-u-ca-islamic-umalqura",
                  { day: "numeric", month: "long", year: "numeric" }
                ).format(new Date(now.getTime() + settings.hijriOffsetDays * 86400000))}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-stone-400">
                {isAr ? "تعديل رؤية الهلال:" : "Moon-Sighting Offset:"}
              </span>
              {[-2, -1, 0, 1, 2].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onUpdateHijriOffset(d)}
                  className={`min-h-[36px] min-w-[36px] px-2 rounded-lg text-xs font-mono-num font-semibold border ${
                    settings.hijriOffsetDays === d
                      ? "bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-600"
                      : "border-slate-200 dark:border-emerald-900 text-slate-600 dark:text-stone-300"
                  }`}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {HIJRI_OCCASIONS.map((occ) => (
              <div
                key={`${occ.month}-${occ.day}`}
                className="p-4 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-slate-50/70 dark:bg-[#071614]"
              >
                <span className="text-xs font-mono-num text-amber-700 dark:text-amber-300 font-semibold">
                  {occ.day} / {occ.month} {isAr ? "هـ" : "H"}
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                  {isAr ? occ.ar : occ.en}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6.6 NEARBY MOSQUES */}
      {activeSubTab === "mosques" && (
        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isAr ? "البحث عن المساجد القريبة" : "Nearby Mosques Finder"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                {isAr
                  ? "لا نطلب إذن الموقع إلا عند ضغطك على البحث التفاعلي."
                  : "Location permission is only requested when you explicitly click Search Near Me."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={mosqueLoading}
                onClick={() => findNearbyMosques(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-emerald-800 text-xs font-semibold text-slate-700 dark:text-stone-200"
              >
                {isAr
                  ? `بحث حول ${activeCoords.nameAr}`
                  : `Search Near ${activeCoords.nameEn}`}
              </button>
              <button
                type="button"
                disabled={mosqueLoading}
                onClick={() => findNearbyMosques(true)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-xs font-semibold"
              >
                {mosqueLoading
                  ? isAr
                    ? "جارٍ البحث..."
                    : "Searching..."
                  : isAr
                  ? "استخدام موقعي الحالي"
                  : "Use My Current GPS"}
              </button>
            </div>
          </div>

          {mosqueMessage && (
            <p className="text-xs text-amber-700 dark:text-amber-300">{mosqueMessage}</p>
          )}

          {mosques.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-emerald-900/40">
              {mosques.map((m) => (
                <div key={m.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {isAr ? m.nameAr : m.nameEn}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-stone-400 font-mono-num">
                      {m.distanceKm} km {m.address ? `· ${m.address}` : ""}
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/60"
                  >
                    <span>{isAr ? "فتح الاتجاهات" : "Directions"}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#071614] border border-slate-200 dark:border-emerald-900/50 text-center space-y-2">
              <p className="text-sm text-slate-600 dark:text-stone-300">
                {isAr
                  ? "اضغط أحد أزرار البحث أعلاه لاستكشاف أقرب المساجد على خريطة OpenStreetMap."
                  : "Select one of the search options above to list mosques near your location."}
              </p>
              <a
                href={`https://www.google.com/maps/search/mosque/@${activeCoords.lat},${activeCoords.lng},14z`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
              >
                <span>{isAr ? "عرض المساجد في الخرائط مباشرة" : "Open Mosques in External Maps"}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* 6.7 AUDIO LIBRARY */}
      {activeSubTab === "audio" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {audioItems.map((track) => {
            const isOffline = settings.offlineAudioIds.includes(track.id);
            const isPlaying = playingAudioId === track.id;
            return (
              <div
                key={track.id}
                className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {isAr ? track.titleAr : track.titleEn}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                      {track.source} · {track.durationLabel || "04:00"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleOfflineAudio(track.id)}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border ${
                      isOffline
                        ? "border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-200 dark:border-emerald-900 text-slate-600 dark:text-stone-300"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isOffline ? (isAr ? "متاح دون نت" : "Saved Offline") : isAr ? "تنزيل" : "Download"}</span>
                  </button>
                </div>

                <p className="text-sm text-slate-600 dark:text-stone-300 leading-relaxed">
                  {isAr ? track.bodyAr : track.bodyEn}
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500 dark:text-stone-400">
                    {track.gradeOrRights}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlaying) {
                        setPlayingAudioId(null);
                      } else {
                        setPlayingAudioId(track.id);
                        playAdhanPreview("madinah_dawn");
                      }
                    }}
                    className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>
                      {isPlaying
                        ? isAr
                          ? "إيقاف"
                          : "Stop"
                        : isAr
                        ? "استماع هادئ"
                        : "Play Calm Audio"}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
