export type Locale = "ar" | "en";
export type ThemeMode = "dark" | "light";
export type NavSection = "today" | "journey" | "services" | "assistant" | "admin";

export type PrayerId = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export type TimeSlotId = PrayerId | "sunrise";

export type CalcMethodId =
  | "UmmAlQura"
  | "MuslimWorldLeague"
  | "Egyptian"
  | "NorthAmerica"
  | "Karachi"
  | "Kuwait"
  | "Qatar"
  | "Dubai"
  | "Turkey"
  | "Singapore";

export type AdhanSoundId = "makkah_chime" | "madinah_dawn" | "soft_fajr" | "gentle_takbir";

export interface CityPreset {
  id: string;
  nameAr: string;
  nameEn: string;
  countryAr: string;
  countryEn: string;
  lat: number;
  lng: number;
  timezone: string;
  defaultMethod: CalcMethodId;
}

export interface PrayerNotificationRule {
  enabled: boolean;
  sound: AdhanSoundId;
  preAlertMinutes: number;
  repeatEvery5Min: boolean;
  gentleFollowupMinutes: number;
  manualOffsetMinutes: number;
}

export interface SalatiSettings {
  locale: Locale;
  theme: ThemeMode;
  cityId: string;
  customCoords?: { lat: number; lng: number; labelAr: string; labelEn: string };
  calcMethod: CalcMethodId;
  madhab: "shafi" | "hanafi";
  hijriOffsetDays: number;
  dailyGoalPrayers: number;
  showDailyEncouragement: boolean;
  aiSuggestionsEnabled: boolean;
  beginnerWuduMode: boolean;
  lastReadSurahId: string;
  lastReadSurahNumber: number;
  selectedReciterId: string;
  selectedMuezzinId: string;
  autoPlayAdhanAtPrayerTime: boolean;
  postAdhanAlarmIntervalSec: number;
  lastAudioId: string;
  favoriteIds: string[];
  bookmarkedAyahKeys: string[];
  offlineAudioIds: string[];
  lastBackupAt?: string;
  prayerRules: Record<PrayerId, PrayerNotificationRule>;
}

export interface QuranSurahMeta {
  number: number;
  nameAr: string;
  nameEn: string;
  englishMeaning: string;
  numberOfAyahs: number;
  revelationType: "Meccan" | "Medinan" | string;
}

export interface QuranSurahDetail {
  number: number;
  nameAr: string;
  nameEn: string;
  englishMeaning: string;
  revelationType: string;
  numberOfAyahs: number;
  tafsirSourceAr: string;
  tafsirSourceEn: string;
  ayahs: {
    num: number;
    ar: string;
    en: string;
    tafsirAr: string;
    tafsirEn: string;
  }[];
}

export interface QuranReciter {
  id: string;
  nameAr: string;
  nameEn: string;
  styleAr: string;
  styleEn: string;
  originAr: string;
  originEn: string;
  audioBases: string[];
}

export interface MuezzinVoice {
  id: string;
  nameAr: string;
  nameEn: string;
  locationAr: string;
  locationEn: string;
  durationLabel: string;
}

export interface DayPrayerLog {
  dateKey: string; // YYYY-MM-DD
  prayers: Record<PrayerId, boolean>;
  note?: string;
  matPhotoDataUrl?: string; // Stored strictly locally, optional personal keepsake
}

export interface ComputedPrayerSlot {
  id: TimeSlotId;
  nameAr: string;
  nameEn: string;
  time: Date;
  formattedTime: string;
  isObligatory: boolean;
  isNext: boolean;
}

export interface AdminContentItem {
  id: string;
  kind: "adhkar" | "hadith" | "article" | "audio";
  category: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  source: string;
  gradeOrRights: string;
  repeatCount?: number;
  durationLabel?: string;
  published: boolean;
  updatedAt: string;
}

export interface TranslationRow {
  key: string;
  ar: string;
  en: string;
  reviewed: boolean;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: string;
  appVersion: string;
  locale: string;
  status: "open" | "in_review" | "resolved";
  reply?: string;
  createdAt: string;
}

export interface AnnouncementItem {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type: "notice" | "sponsorship";
  active: boolean;
  scheduleWindow: string;
}

export interface AuditEntry {
  id: string;
  role: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface AssistantReply {
  answer: string;
  sources: string[];
  uncertaintyNote: string;
  scholarNote: string;
}

export interface MosquePlace {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
  distanceKm: number;
  address: string;
}
