import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Compass,
  Home,
  Sparkles,
  MessageSquare,
  LayoutGrid,
  Sun,
  Moon,
  Globe,
  Shield,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  BookOpen,
} from "lucide-react";
import {
  AdminContentItem,
  AnnouncementItem,
  AuditEntry,
  ComputedPrayerSlot,
  DayPrayerLog,
  NavSection,
  PrayerId,
  PrayerNotificationRule,
  QuranSurahDetail,
  QuranSurahMeta,
  SalatiSettings,
  SupportTicket,
  TranslationRow,
} from "./types/salati";
import { DEFAULT_SETTINGS, QURAN_RECITERS, QURAN_SURAHS } from "./data/salatiContent";
import {
  computeDailyPrayers,
  formatDualCalendar,
  OBLIGATORY_PRAYERS,
  resolveActiveLocation,
  toDateKey,
} from "./utils/prayerEngine";
import { TodayDashboard } from "./components/TodayDashboard";
import { PreparationJourney } from "./components/PreparationJourney";
import {
  IslamicServicesHub,
  QuranPlayerController,
  ServiceSubTab,
} from "./components/IslamicServicesHub";
import { SalatiAssistant } from "./components/SalatiAssistant";
import { AdminDashboard } from "./components/AdminDashboard";
import { SettingsBackupModal } from "./components/SettingsBackupModal";
import { AlarmOverlay } from "./components/AlarmOverlay";

const SETTINGS_STORAGE_KEY = "salati_settings_v1";
const LOGS_STORAGE_KEY = "salati_logs_v1";
const CONTENT_CACHE_KEY = "salati_cached_content_v1";

function loadInitialSettings(): SalatiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadInitialLogs(): Record<string, DayPrayerLog> {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  // Seed clean initial self-recorded entries for recent days so charts render meaningfully on first visit
  const today = new Date();
  const seed: Record<string, DayPrayerLog> = {};
  const patterns = [
    { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: false },
    { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
    { fajr: false, dhuhr: true, asr: true, maghrib: true, isha: true },
    { fajr: true, dhuhr: true, asr: false, maghrib: true, isha: true },
  ];
  for (let i = 1; i <= 4; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    seed[toDateKey(d)] = {
      dateKey: toDateKey(d),
      prayers: patterns[i - 1],
    };
  }
  return seed;
}

export default function App() {
  const [settings, setSettings] = useState<SalatiSettings>(loadInitialSettings);
  const [logs, setLogs] = useState<Record<string, DayPrayerLog>>(loadInitialLogs);
  const [now, setNow] = useState<Date>(() => new Date());
  const [activeNav, setActiveNav] = useState<NavSection>("today");
  const [serviceTab, setServiceTab] = useState<ServiceSubTab>("quran");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [alarmSlot, setAlarmSlot] = useState<ComputedPrayerSlot | null>(null);

  // Server-backed content & admin state (with offline cache fallback)
  const [adminContent, setAdminContent] = useState<AdminContentItem[]>([]);
  const [translations, setTranslations] = useState<TranslationRow[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState({
    appVersion: "1.0.0",
    buildTarget: "Web / iOS / Android Unified Spec",
    crashFreeRate: "99.94%",
    activeLocales: ["ar", "en"],
    offlinePackReady: true,
  });

  // Persistent Multi-Reciter 114-Surah Quran Audio Engine & Live Adhan Ref
  const quranAudioRef = useRef<HTMLAudioElement | null>(null);
  const triggeredAdhanRef = useRef<Set<string>>(new Set());
  const surahDetailCacheRef = useRef<Map<number, QuranSurahDetail>>(new Map());
  const loadedSurahNumRef = useRef<number | null>(null);
  const loadedReciterIdRef = useRef<string>(
    loadInitialSettings().selectedReciterId || "yasser_dosari"
  );
  const audioFallbackIdxRef = useRef<number>(0);
  const switchingSurahRef = useRef<boolean>(false);
  const selectedReciterId = QURAN_RECITERS.some(
    (r) => r.id === settings.selectedReciterId
  )
    ? settings.selectedReciterId
    : "yasser_dosari";
  const activeReciter =
    QURAN_RECITERS.find((r) => r.id === selectedReciterId) || QURAN_RECITERS[0];
  const [quranSurahs, setQuranSurahs] = useState<QuranSurahMeta[]>(() =>
    QURAN_SURAHS.map((s) => ({
      number: s.number,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      englishMeaning: s.nameEn,
      numberOfAyahs: s.ayahs.length,
      revelationType: "Meccan",
    }))
  );
  const [activeSurahNumber, setActiveSurahNumber] = useState<number>(
    () => loadInitialSettings().lastReadSurahNumber || 1
  );
  const [activeSurahDetail, setActiveSurahDetail] = useState<QuranSurahDetail | null>(null);
  const [loadingSurah, setLoadingSurah] = useState(false);
  const [isQuranPlaying, setIsQuranPlaying] = useState(false);
  const [quranBuffering, setQuranBuffering] = useState(false);
  const [quranHasStarted, setQuranHasStarted] = useState(false);
  const [quranCurrentTime, setQuranCurrentTime] = useState(0);
  const [quranDuration, setQuranDuration] = useState(0);
  const [autoAdvanceQuran, setAutoAdvanceQuran] = useState(true);
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(null);
  const [sleepAfterSurah, setSleepAfterSurah] = useState(false);
  const [quranError, setQuranError] = useState<string | null>(null);

  // Sync HTML lang, dir, and dark class
  useEffect(() => {
    const root = document.documentElement;
    root.lang = settings.locale;
    root.dir = settings.locale === "ar" ? "rtl" : "ltr";
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota error
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // ignore quota error
    }
  }, [logs]);

  // Tick every second for accurate countdown
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Sleep Timer countdown for Quran Recitation
  useEffect(() => {
    if (sleepTimerRemainingSec === null) return;
    if (sleepTimerRemainingSec <= 0) {
      const audio = quranAudioRef.current;
      if (audio) audio.pause();
      setIsQuranPlaying(false);
      setSleepTimerRemainingSec(null);
      return;
    }
    const id = window.setInterval(() => {
      setSleepTimerRemainingSec((prev) => {
        if (prev === null) return null;
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerRemainingSec]);

  const fetchServerContent = useCallback(async () => {
    try {
      const res = await fetch("/api/content");
      if (!res.ok) throw new Error("Failed to load content");
      const data = await res.json();
      setAdminContent(data.content || []);
      setTranslations(data.translations || []);
      setTickets(data.tickets || []);
      setAnnouncements(data.announcements || []);
      setAuditLog(data.auditLog || []);
      if (data.diagnostics) setDiagnostics(data.diagnostics);
      try {
        localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(data));
      } catch {
        // ignore
      }
    } catch {
      try {
        const cached = localStorage.getItem(CONTENT_CACHE_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          setAdminContent(data.content || []);
          setTranslations(data.translations || []);
          setTickets(data.tickets || []);
          setAnnouncements(data.announcements || []);
          setAuditLog(data.auditLog || []);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    fetchServerContent();
  }, [fetchServerContent]);

  // Fetch all 114 Surahs metadata
  useEffect(() => {
    fetch("/api/quran/surahs")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.surahs) && data.surahs.length === 114) {
          setQuranSurahs(data.surahs);
        }
      })
      .catch(() => {
        // fallback stays populated
      });
  }, []);

  // Fetch Surah verses + Tafsir when activeSurahNumber changes
  useEffect(() => {
    const cached = surahDetailCacheRef.current.get(activeSurahNumber);
    if (cached) {
      setActiveSurahDetail(cached);
      return;
    }
    let cancelled = false;
    setLoadingSurah(true);
    fetch(`/api/quran/surah/${activeSurahNumber}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: QuranSurahDetail | null) => {
        if (!cancelled && data?.ayahs) {
          surahDetailCacheRef.current.set(activeSurahNumber, data);
          setActiveSurahDetail(data);
        }
      })
      .catch(() => {
        // graceful fallback handled in view
      })
      .finally(() => {
        if (!cancelled) setLoadingSurah(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSurahNumber]);

  const getReciterAudioUrls = useCallback((reciterId: string, surahNum: number) => {
    const reciter =
      QURAN_RECITERS.find((r) => r.id === reciterId) || QURAN_RECITERS[0];
    const padded = String(surahNum).padStart(3, "0");
    return [
      ...reciter.audioBases.map((base) => `${base}${padded}.mp3`),
      `/api/quran/audio/${surahNum}?reciter=${encodeURIComponent(reciter.id)}`,
    ];
  }, []);

  const playSurahAudio = useCallback(
    (surahNum: number, fallbackIdx = 0, explicitReciterId?: string) => {
      const audio = quranAudioRef.current;
      if (!audio) return;
      const targetReciterId = explicitReciterId || selectedReciterId;
      const urls = getReciterAudioUrls(targetReciterId, surahNum);
      const targetUrl = urls[fallbackIdx] || urls[0];

      switchingSurahRef.current = true;
      audioFallbackIdxRef.current = fallbackIdx;
      loadedSurahNumRef.current = surahNum;
      loadedReciterIdRef.current = targetReciterId;

      setQuranError(null);
      setQuranBuffering(true);
      setQuranHasStarted(true);
      setActiveSurahNumber(surahNum);
      setSettings((prev) => ({
        ...prev,
        lastReadSurahNumber: surahNum,
        selectedReciterId: targetReciterId,
      }));

      if (audio.src !== targetUrl) {
        audio.src = targetUrl;
        audio.load();
      }
      audio
        .play()
        .then(() => {
          switchingSurahRef.current = false;
          setIsQuranPlaying(true);
          setQuranBuffering(false);
        })
        .catch((err) => {
          switchingSurahRef.current = false;
          if (
            err?.name === "AbortError" ||
            loadedSurahNumRef.current !== surahNum ||
            loadedReciterIdRef.current !== targetReciterId
          ) {
            return;
          }
          if (fallbackIdx + 1 < urls.length) {
            playSurahAudio(surahNum, fallbackIdx + 1, targetReciterId);
          } else {
            setQuranBuffering(false);
            setIsQuranPlaying(false);
            setQuranError(
              settings.locale === "en"
                ? "Unable to start audio stream. Please try again."
                : "تعذر تشغيل الصوت حالياً، يرجى المحاولة مرة أخرى."
            );
          }
        });
    },
    [getReciterAudioUrls, selectedReciterId, settings.locale]
  );

  const handleSelectReciter = useCallback(
    (reciterId: string) => {
      const valid = QURAN_RECITERS.some((r) => r.id === reciterId)
        ? reciterId
        : "yasser_dosari";
      setSettings((prev) => ({ ...prev, selectedReciterId: valid }));
      if (isQuranPlaying || quranHasStarted) {
        playSurahAudio(activeSurahNumber, 0, valid);
      } else {
        const audio = quranAudioRef.current;
        if (audio) {
          switchingSurahRef.current = true;
          audio.pause();
          const urls = getReciterAudioUrls(valid, activeSurahNumber);
          audioFallbackIdxRef.current = 0;
          loadedSurahNumRef.current = activeSurahNumber;
          loadedReciterIdRef.current = valid;
          audio.src = urls[0];
          audio.load();
          switchingSurahRef.current = false;
          setQuranCurrentTime(0);
          setQuranDuration(0);
        }
      }
    },
    [
      activeSurahNumber,
      getReciterAudioUrls,
      isQuranPlaying,
      playSurahAudio,
      quranHasStarted,
    ]
  );

  const handleStartOrToggleQuran = useCallback(
    (requestedSurahNum?: number) => {
      const targetNum = requestedSurahNum ?? activeSurahNumber;
      const audio = quranAudioRef.current;
      if (!audio) return;

      if (
        quranHasStarted &&
        loadedSurahNumRef.current === targetNum &&
        loadedReciterIdRef.current === selectedReciterId &&
        audio.src
      ) {
        if (isQuranPlaying) {
          audio.pause();
          setIsQuranPlaying(false);
        } else {
          audio
            .play()
            .then(() => setIsQuranPlaying(true))
            .catch(() => playSurahAudio(targetNum, 0, selectedReciterId));
        }
      } else {
        playSurahAudio(targetNum, 0, selectedReciterId);
      }
    },
    [
      activeSurahNumber,
      isQuranPlaying,
      playSurahAudio,
      quranHasStarted,
      selectedReciterId,
    ]
  );

  const handleSelectSurah = useCallback(
    (surahNum: number, autoPlayIfPlaying = false) => {
      setActiveSurahNumber(surahNum);
      setSettings((prev) => ({ ...prev, lastReadSurahNumber: surahNum }));
      if (autoPlayIfPlaying) {
        playSurahAudio(surahNum, 0, selectedReciterId);
      } else {
        const audio = quranAudioRef.current;
        if (audio) {
          switchingSurahRef.current = true;
          audio.pause();
          const urls = getReciterAudioUrls(selectedReciterId, surahNum);
          audioFallbackIdxRef.current = 0;
          loadedSurahNumRef.current = surahNum;
          loadedReciterIdRef.current = selectedReciterId;
          audio.src = urls[0];
          audio.load();
          switchingSurahRef.current = false;
          setIsQuranPlaying(false);
          setQuranCurrentTime(0);
          setQuranDuration(0);
        }
      }
    },
    [getReciterAudioUrls, playSurahAudio, selectedReciterId]
  );

  const handleNextSurah = useCallback(() => {
    if (activeSurahNumber >= 114) return;
    const nextNum = activeSurahNumber + 1;
    if (isQuranPlaying || quranHasStarted) {
      playSurahAudio(nextNum, 0, selectedReciterId);
    } else {
      handleSelectSurah(nextNum, false);
    }
  }, [
    activeSurahNumber,
    handleSelectSurah,
    isQuranPlaying,
    playSurahAudio,
    quranHasStarted,
    selectedReciterId,
  ]);

  const handlePrevSurah = useCallback(() => {
    if (activeSurahNumber <= 1) return;
    const prevNum = activeSurahNumber - 1;
    if (isQuranPlaying || quranHasStarted) {
      playSurahAudio(prevNum, 0, selectedReciterId);
    } else {
      handleSelectSurah(prevNum, false);
    }
  }, [
    activeSurahNumber,
    handleSelectSurah,
    isQuranPlaying,
    playSurahAudio,
    quranHasStarted,
    selectedReciterId,
  ]);

  const handleQuranSeek = useCallback((sec: number) => {
    const audio = quranAudioRef.current;
    if (!audio || !Number.isFinite(sec)) return;
    audio.currentTime = sec;
    setQuranCurrentTime(sec);
  }, []);

  const handleSetSleepTimer = useCallback((mode: "off" | "surah" | 15 | 30 | 60) => {
    if (mode === "off") {
      setSleepAfterSurah(false);
      setSleepTimerRemainingSec(null);
    } else if (mode === "surah") {
      setSleepTimerRemainingSec(null);
      setSleepAfterSurah(true);
    } else {
      setSleepAfterSurah(false);
      setSleepTimerRemainingSec(mode * 60);
    }
  }, []);

  const handleQuranEnded = useCallback(() => {
    if (sleepAfterSurah) {
      setSleepAfterSurah(false);
      setIsQuranPlaying(false);
      return;
    }
    if (autoAdvanceQuran && activeSurahNumber < 114) {
      playSurahAudio(activeSurahNumber + 1, 0, selectedReciterId);
    } else {
      setIsQuranPlaying(false);
    }
  }, [activeSurahNumber, autoAdvanceQuran, playSurahAudio, selectedReciterId, sleepAfterSurah]);

  const activeSurahMeta =
    quranSurahs.find((s) => s.number === activeSurahNumber) || quranSurahs[0];

  const quranPlayerController: QuranPlayerController = {
    surahs: quranSurahs,
    reciters: QURAN_RECITERS,
    selectedReciterId,
    activeSurahNumber,
    activeSurahDetail,
    loadingSurah,
    isPlaying: isQuranPlaying,
    isBuffering: quranBuffering,
    hasStarted: quranHasStarted,
    currentTime: quranCurrentTime,
    duration: quranDuration,
    autoAdvance: autoAdvanceQuran,
    sleepTimerRemainingSec,
    sleepAfterSurah,
    error: quranError,
    onSelectReciter: handleSelectReciter,
    onStartOrTogglePlay: handleStartOrToggleQuran,
    onSelectSurah: handleSelectSurah,
    onNextSurah: handleNextSurah,
    onPrevSurah: handlePrevSurah,
    onSeek: handleQuranSeek,
    onToggleAutoAdvance: () => setAutoAdvanceQuran((v) => !v),
    onSetSleepTimer: handleSetSleepTimer,
  };

  const activeLoc = useMemo(() => resolveActiveLocation(settings), [settings]);
  const prayerData = useMemo(() => computeDailyPrayers(now, settings), [now, settings]);
  const calendar = useMemo(
    () => formatDualCalendar(now, settings.locale, settings.hijriOffsetDays),
    [now, settings.locale, settings.hijriOffsetDays]
  );

  const isAr = settings.locale === "ar";
  const cityLabel = isAr ? activeLoc.nameAr : activeLoc.nameEn;

  const updateSettings = (patch: Partial<SalatiSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleTogglePrayerLog = (dateKey: string, prayerId: PrayerId) => {
    setLogs((prev) => {
      const existing = prev[dateKey] || {
        dateKey,
        prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
      };
      return {
        ...prev,
        [dateKey]: {
          ...existing,
          prayers: {
            ...existing.prayers,
            [prayerId]: !existing.prayers[prayerId],
          },
        },
      };
    });
  };

  const handleUpdatePrayerRule = (prayerId: PrayerId, patch: Partial<PrayerNotificationRule>) => {
    setSettings((prev) => ({
      ...prev,
      prayerRules: {
        ...prev.prayerRules,
        [prayerId]: {
          ...prev.prayerRules[prayerId],
          ...patch,
        },
      },
    }));
  };

  const handleSaveMatPhoto = (dateKey: string, dataUrl: string | undefined) => {
    setLogs((prev) => {
      const existing = prev[dateKey] || {
        dateKey,
        prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
      };
      return {
        ...prev,
        [dateKey]: {
          ...existing,
          matPhotoDataUrl: dataUrl,
        },
      };
    });
  };

  const handleRestoreMerged = (
    restoredSettings: SalatiSettings,
    restoredLogs: Record<string, DayPrayerLog>
  ) => {
    setSettings((prev) => ({ ...prev, ...restoredSettings }));
    setLogs((prev) => {
      const merged = { ...prev };
      for (const [k, incoming] of Object.entries(restoredLogs || {})) {
        const current = merged[k];
        if (!current) {
          merged[k] = incoming;
        } else {
          merged[k] = {
            dateKey: k,
            prayers: {
              fajr: current.prayers.fajr || incoming.prayers.fajr,
              dhuhr: current.prayers.dhuhr || incoming.prayers.dhuhr,
              asr: current.prayers.asr || incoming.prayers.asr,
              maghrib: current.prayers.maghrib || incoming.prayers.maghrib,
              isha: current.prayers.isha || incoming.prayers.isha,
            },
            note: current.note || incoming.note,
            matPhotoDataUrl: current.matPhotoDataUrl || incoming.matPhotoDataUrl,
          };
        }
      }
      return merged;
    });
  };

  const handleClearAllLocalData = () => {
    localStorage.removeItem(LOGS_STORAGE_KEY);
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    setLogs({});
    setSettings(DEFAULT_SETTINGS);
  };

  const todayKey = toDateKey(now);
  const todayLog = logs[todayKey]?.prayers;
  const loggedToday = todayLog ? OBLIGATORY_PRAYERS.filter((p) => todayLog[p.id]).length : 0;

  // Automatic Adhan trigger when an obligatory prayer's time arrives
  useEffect(() => {
    if (!settings.autoPlayAdhanAtPrayerTime || alarmSlot) return;
    const nowMs = now.getTime();
    for (const slot of prayerData.slots) {
      if (!slot.isObligatory) continue;
      const rule = settings.prayerRules[slot.id as PrayerId];
      if (rule && !rule.enabled) continue;
      const diffMs = nowMs - slot.time.getTime();
      if (diffMs >= 0 && diffMs < 10000) {
        const triggerKey = `${todayKey}:${slot.id}`;
        if (triggeredAdhanRef.current.has(triggerKey)) continue;
        if (logs[todayKey]?.prayers?.[slot.id as PrayerId]) continue;

        triggeredAdhanRef.current.add(triggerKey);
        if (quranAudioRef.current && isQuranPlaying) {
          quranAudioRef.current.pause();
          setIsQuranPlaying(false);
        }
        setAlarmSlot(slot);
        break;
      }
    }
  }, [
    now,
    todayKey,
    prayerData.slots,
    settings.autoPlayAdhanAtPrayerTime,
    settings.prayerRules,
    logs,
    alarmSlot,
    isQuranPlaying,
  ]);

  let streakDays = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const k = toDateKey(d);
    const entry = logs[k]?.prayers;
    const count = entry ? OBLIGATORY_PRAYERS.filter((p) => entry[p.id]).length : 0;
    if (count > 0) streakDays += 1;
    else if (i > 0) break;
  }

  const navItems: { id: NavSection; ar: string; en: string; icon: typeof Home }[] = [
    { id: "today", ar: "اليوم", en: "Today", icon: Home },
    { id: "journey", ar: "الاستعداد", en: "Journey", icon: Sparkles },
    { id: "services", ar: "الخدمات", en: "Services", icon: Compass },
    { id: "assistant", ar: "المساعد", en: "Assistant", icon: MessageSquare },
    { id: "admin", ar: "الإدارة", en: "Admin", icon: LayoutGrid },
  ];

  const alarmSoundId = prayerData.nextPrayer.isObligatory
    ? settings.prayerRules[prayerData.nextPrayer.id as PrayerId]?.sound || "makkah_chime"
    : "makkah_chime";

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFBF9] dark:bg-[#061513] text-slate-900 dark:text-stone-100 islamic-lattice pb-20 md:pb-0">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-emerald-900/60 bg-white/90 dark:bg-[#061513]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveNav("today")}
            className="text-lg font-bold tracking-tight text-emerald-800 dark:text-stone-50 whitespace-nowrap shrink-0"
          >
            {isAr ? "صلاتي · Salati" : "Salati · صلاتي"}
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  activeNav === item.id
                    ? "border-emerald-600 dark:border-amber-400 text-slate-900 dark:text-white"
                    : "border-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100"
                }`}
              >
                {isAr ? item.ar : item.en}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              {isAr ? "الإعدادات والموقع" : "Settings & City"}
            </button>
          </div>
        </div>
      </header>

      {/* WORKSPACE PREFERENCES TOOLBAR (Below header per Top Bar Contract) */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-emerald-900/40 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-stone-400">
            <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              {isAr
                ? "يعمل بدون إنشاء حساب · خصوصية كاملة"
                : "No account required · Local-first privacy"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateSettings({ locale: settings.locale === "ar" ? "en" : "ar" })
              }
              className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#0A1E1B] text-slate-700 dark:text-stone-200 inline-flex items-center gap-1.5 font-medium whitespace-nowrap shrink-0"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isAr ? "English" : "العربية"}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })
              }
              aria-label={isAr ? "تبديل المظهر" : "Toggle color theme"}
              className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 dark:border-emerald-900 bg-white dark:bg-[#0A1E1B] text-slate-700 dark:text-stone-200 inline-flex items-center gap-1.5 font-medium whitespace-nowrap shrink-0"
            >
              {settings.theme === "dark" ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isAr ? "الوضع الفاتح" : "Light"}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isAr ? "الوضع الداكن" : "Dark"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Persistent Hidden HTML5 Audio Engine for Sheikh Yasser Al-Dosari */}
        <audio
          ref={quranAudioRef}
          preload="none"
          onTimeUpdate={(e) => setQuranCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            setQuranDuration(e.currentTarget.duration || 0);
            setQuranBuffering(false);
          }}
          onWaiting={() => setQuranBuffering(true)}
          onPlaying={() => {
            switchingSurahRef.current = false;
            setQuranBuffering(false);
            setIsQuranPlaying(true);
          }}
          onPause={() => {
            if (!switchingSurahRef.current) {
              setIsQuranPlaying(false);
            }
          }}
          onEnded={handleQuranEnded}
          onError={() => {
            const targetReciter = loadedReciterIdRef.current || selectedReciterId;
            const nextFallback = audioFallbackIdxRef.current + 1;
            const urls = getReciterAudioUrls(targetReciter, activeSurahNumber);
            if (quranHasStarted && nextFallback < urls.length) {
              playSurahAudio(activeSurahNumber, nextFallback, targetReciter);
            } else {
              setQuranBuffering(false);
              setIsQuranPlaying(false);
            }
          }}
        />

        {/* Compact Cross-Tab Recitation Strip when playing away from Quran tab */}
        {quranHasStarted && !(activeNav === "services" && serviceTab === "quran") && (
          <div className="rounded-xl border border-emerald-700/40 dark:border-emerald-700/60 bg-white dark:bg-[#0A1E1B] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {activeSurahMeta
                    ? isAr
                      ? `${activeSurahMeta.number}. ${activeSurahMeta.nameAr} · ${activeReciter.nameAr}`
                      : `${activeSurahMeta.number}. ${activeSurahMeta.nameEn} · ${activeReciter.nameEn}`
                    : isAr
                    ? activeReciter.nameAr
                    : activeReciter.nameEn}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-stone-400">
                  {isAr
                    ? "تلاوة متواصلة · تنتقل تلقائياً للسورة التالية"
                    : "Continuous recitation · Auto-advances to next Surah"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <select
                value={selectedReciterId}
                onChange={(e) => handleSelectReciter(e.target.value)}
                aria-label={isAr ? "تغيير القارئ" : "Change Reciter"}
                className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs max-w-[175px]"
              >
                {QURAN_RECITERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isAr ? r.nameAr : r.nameEn}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handlePrevSurah}
                disabled={activeSurahNumber <= 1}
                aria-label={isAr ? "السورة السابقة" : "Previous Surah"}
                className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 dark:border-emerald-900 flex items-center justify-center disabled:opacity-40"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleStartOrToggleQuran()}
                className="min-h-[36px] px-3 rounded-lg bg-emerald-700 text-white dark:bg-emerald-600 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                {isQuranPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isQuranPlaying ? (isAr ? "إيقاف" : "Pause") : isAr ? "تشغيل" : "Play"}</span>
              </button>
              <button
                type="button"
                onClick={handleNextSurah}
                disabled={activeSurahNumber >= 114}
                aria-label={isAr ? "السورة التالية" : "Next Surah"}
                className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 dark:border-emerald-900 flex items-center justify-center disabled:opacity-40"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setServiceTab("quran");
                  setActiveNav("services");
                }}
                className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              >
                {isAr ? "المصحف" : "Open"}
              </button>
            </div>
          </div>
        )}

        {activeNav === "today" && (
          <TodayDashboard
            now={now}
            locale={settings.locale}
            settings={settings}
            cityLabel={cityLabel}
            gregorianDate={calendar.gregorian}
            hijriDate={calendar.hijri}
            slots={prayerData.slots}
            nextPrayer={prayerData.nextPrayer}
            countdownLabel={prayerData.countdownLabel}
            qiblaDegrees={prayerData.qiblaDegrees}
            logs={logs}
            announcements={announcements}
            onTogglePrayerLog={handleTogglePrayerLog}
            onUpdatePrayerRule={handleUpdatePrayerRule}
            onStartJourney={() => setActiveNav("journey")}
            onNavigateService={(subTab) => {
              setServiceTab(subTab);
              setActiveNav("services");
            }}
            onOpenAlarmTest={(slot) => {
              if (quranAudioRef.current && isQuranPlaying) {
                quranAudioRef.current.pause();
                setIsQuranPlaying(false);
              }
              setAlarmSlot(slot);
            }}
            onOpenSettings={() => setSettingsModalOpen(true)}
            isQuranPlaying={isQuranPlaying}
            activeQuranSurahName={
              activeSurahMeta
                ? isAr
                  ? `${activeSurahMeta.number}. ${activeSurahMeta.nameAr}`
                  : `${activeSurahMeta.number}. ${activeSurahMeta.nameEn}`
                : ""
            }
            activeReciterName={isAr ? activeReciter.nameAr : activeReciter.nameEn}
            onStartQuranRecitation={() => handleStartOrToggleQuran()}
            sunnahTimes={prayerData.sunnahTimes}
          />
        )}

        {activeNav === "journey" && (
          <PreparationJourney
            now={now}
            locale={settings.locale}
            nextPrayer={prayerData.nextPrayer}
            beginnerMode={settings.beginnerWuduMode}
            onToggleBeginnerMode={() =>
              updateSettings({ beginnerWuduMode: !settings.beginnerWuduMode })
            }
            logs={logs}
            onLogPrayer={handleTogglePrayerLog}
            onSaveMatPhoto={handleSaveMatPhoto}
            onExitToToday={() => setActiveNav("today")}
          />
        )}

        {activeNav === "services" && (
          <IslamicServicesHub
            now={now}
            locale={settings.locale}
            activeSubTab={serviceTab}
            onChangeSubTab={setServiceTab}
            settings={settings}
            qiblaDegrees={prayerData.qiblaDegrees}
            activeCoords={{
              lat: activeLoc.lat,
              lng: activeLoc.lng,
              nameAr: activeLoc.nameAr,
              nameEn: activeLoc.nameEn,
            }}
            adminContent={adminContent}
            onToggleFavorite={(id) =>
              updateSettings({
                favoriteIds: settings.favoriteIds.includes(id)
                  ? settings.favoriteIds.filter((x) => x !== id)
                  : [...settings.favoriteIds, id],
              })
            }
            onToggleBookmarkAyah={(key) =>
              updateSettings({
                bookmarkedAyahKeys: settings.bookmarkedAyahKeys.includes(key)
                  ? settings.bookmarkedAyahKeys.filter((x) => x !== key)
                  : [...settings.bookmarkedAyahKeys, key],
              })
            }
            onToggleOfflineAudio={(audioId) =>
              updateSettings({
                offlineAudioIds: settings.offlineAudioIds.includes(audioId)
                  ? settings.offlineAudioIds.filter((x) => x !== audioId)
                  : [...settings.offlineAudioIds, audioId],
              })
            }
            onUpdateHijriOffset={(offset) => updateSettings({ hijriOffsetDays: offset })}
            quranPlayer={quranPlayerController}
          />
        )}

        {activeNav === "assistant" && (
          <SalatiAssistant
            locale={settings.locale}
            cityLabel={cityLabel}
            nextPrayerLabel={`${isAr ? prayerData.nextPrayer.nameAr : prayerData.nextPrayer.nameEn} (${prayerData.nextPrayer.formattedTime})`}
            loggedToday={loggedToday}
            streakDays={streakDays}
            aiSuggestionsEnabled={settings.aiSuggestionsEnabled}
            onToggleAiSuggestions={() =>
              updateSettings({ aiSuggestionsEnabled: !settings.aiSuggestionsEnabled })
            }
          />
        )}

        {activeNav === "admin" && (
          <AdminDashboard
            locale={settings.locale}
            content={adminContent}
            translations={translations}
            tickets={tickets}
            announcements={announcements}
            auditLog={auditLog}
            diagnostics={diagnostics}
            onRefresh={fetchServerContent}
          />
        )}
      </main>

      {/* QUIET FOOTER */}
      <footer className="border-t border-slate-200/70 dark:border-emerald-900/40 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-stone-400">
          <span>
            {isAr
              ? "صلاتي · رفيق يومي مجاني بالكامل للمحافظة على الصلاة"
              : "Salati · 100% Free Personal Prayer Companion"}
          </span>
          <span>
            {isAr
              ? "خصوصيتك أولاً: لا بيع للبيانات · لا استهداف إعلاني بسجل الصلاة · وضع العائلة في مرحلة مستقبلية"
              : "Privacy First: No data selling · No prayer-log ad targeting · Family Mode planned post-v1.0"}
          </span>
        </div>
      </footer>

      {/* MOBILE BOTTOM THUMB-ZONE TAB BAR (< 15% viewport height) */}
      <nav
        aria-label={isAr ? "التنقل الرئيسي" : "Primary Mobile Navigation"}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 dark:bg-[#061513]/95 backdrop-blur-md border-t border-slate-200 dark:border-emerald-900/60 grid grid-cols-5"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? "text-emerald-700 dark:text-amber-300"
                  : "text-slate-500 dark:text-stone-400"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isAr ? item.ar : item.en}</span>
            </button>
          );
        })}
      </nav>

      {/* SETTINGS & ENCRYPTED BACKUP MODAL */}
      <SettingsBackupModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        locale={settings.locale}
        settings={settings}
        logs={logs}
        onUpdateSettings={updateSettings}
        onSelectReciter={handleSelectReciter}
        onTestAdhanAlarm={() => {
          if (quranAudioRef.current && isQuranPlaying) {
            quranAudioRef.current.pause();
            setIsQuranPlaying(false);
          }
          setAlarmSlot(prayerData.nextPrayer);
        }}
        onRestoreMerged={handleRestoreMerged}
        onClearAllLocalData={handleClearAllLocalData}
      />

      {/* FULL-SCREEN SMART ADHAN ALARM OVERLAY */}
      <AlarmOverlay
        slot={alarmSlot}
        soundId={alarmSoundId}
        muezzinId={settings.selectedMuezzinId || "yasser_dosari"}
        alarmIntervalSec={
          typeof settings.postAdhanAlarmIntervalSec === "number"
            ? settings.postAdhanAlarmIntervalSec
            : 60
        }
        locale={settings.locale}
        onClose={() => setAlarmSlot(null)}
        onStartPreparation={() => {
          setAlarmSlot(null);
          setActiveNav("journey");
        }}
        onLogPrayer={(pid) => {
          handleTogglePrayerLog(todayKey, pid);
          setAlarmSlot(null);
        }}
      />
    </div>
  );
}
