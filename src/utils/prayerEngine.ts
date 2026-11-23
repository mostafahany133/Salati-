import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  Qibla,
  SunnahTimes,
} from "adhan";
import {
  CalcMethodId,
  ComputedPrayerSlot,
  Locale,
  PrayerId,
  SalatiSettings,
  TimeSlotId,
} from "../types/salati";
import { CITY_PRESETS } from "../data/salatiContent";

function getCalculationParams(methodId: CalcMethodId, madhab: "shafi" | "hanafi") {
  let params;
  switch (methodId) {
    case "UmmAlQura":
      params = CalculationMethod.UmmAlQura();
      break;
    case "MuslimWorldLeague":
      params = CalculationMethod.MuslimWorldLeague();
      break;
    case "Egyptian":
      params = CalculationMethod.Egyptian();
      break;
    case "NorthAmerica":
      params = CalculationMethod.NorthAmerica();
      break;
    case "Karachi":
      params = CalculationMethod.Karachi();
      break;
    case "Kuwait":
      params = CalculationMethod.Kuwait();
      break;
    case "Qatar":
      params = CalculationMethod.Qatar();
      break;
    case "Dubai":
      params = CalculationMethod.Dubai();
      break;
    case "Turkey":
      params = CalculationMethod.Turkey();
      break;
    case "Singapore":
      params = CalculationMethod.Singapore();
      break;
    default:
      params = CalculationMethod.MuslimWorldLeague();
  }
  params.madhab = madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  return params;
}

export function resolveActiveLocation(settings: SalatiSettings) {
  if (settings.customCoords) {
    return {
      lat: settings.customCoords.lat,
      lng: settings.customCoords.lng,
      nameAr: settings.customCoords.labelAr,
      nameEn: settings.customCoords.labelEn,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  const city = CITY_PRESETS.find((c) => c.id === settings.cityId) || CITY_PRESETS[0];
  return {
    lat: city.lat,
    lng: city.lng,
    nameAr: `${city.nameAr}، ${city.countryAr}`,
    nameEn: `${city.nameEn}, ${city.countryEn}`,
    timezone: city.timezone,
  };
}

export function computeDailyPrayers(
  now: Date,
  settings: SalatiSettings
): {
  slots: ComputedPrayerSlot[];
  nextPrayer: ComputedPrayerSlot;
  countdownLabel: string;
  qiblaDegrees: number;
  sunnahTimes: {
    duhaStart: string;
    middleOfTheNight: string;
    lastThirdOfTheNight: string;
  };
} {
  const loc = resolveActiveLocation(settings);
  const coords = new Coordinates(loc.lat, loc.lng);
  const params = getCalculationParams(settings.calcMethod, settings.madhab);
  const pt = new PrayerTimes(coords, now, params);
  const st = new SunnahTimes(pt);

  const applyOffset = (d: Date, id: TimeSlotId) => {
    if (id === "sunrise") return d;
    const min = settings.prayerRules[id]?.manualOffsetMinutes || 0;
    return new Date(d.getTime() + min * 60000);
  };

  const rawSlots: { id: TimeSlotId; nameAr: string; nameEn: string; time: Date; isObligatory: boolean }[] = [
    { id: "fajr", nameAr: "الفجر", nameEn: "Fajr", time: applyOffset(pt.fajr, "fajr"), isObligatory: true },
    { id: "sunrise", nameAr: "الشروق", nameEn: "Sunrise", time: pt.sunrise, isObligatory: false },
    { id: "dhuhr", nameAr: "الظهر", nameEn: "Dhuhr", time: applyOffset(pt.dhuhr, "dhuhr"), isObligatory: true },
    { id: "asr", nameAr: "العصر", nameEn: "Asr", time: applyOffset(pt.asr, "asr"), isObligatory: true },
    { id: "maghrib", nameAr: "المغرب", nameEn: "Maghrib", time: applyOffset(pt.maghrib, "maghrib"), isObligatory: true },
    { id: "isha", nameAr: "العشاء", nameEn: "Isha", time: applyOffset(pt.isha, "isha"), isObligatory: true },
  ];

  // Determine next obligatory or sunrise slot
  let nextIdx = rawSlots.findIndex((s) => s.time.getTime() > now.getTime() && s.isObligatory);
  let targetTimeForCountdown: Date;

  if (nextIdx === -1) {
    // Next prayer is tomorrow's Fajr
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowPt = new PrayerTimes(coords, tomorrow, params);
    const tomorrowFajr = applyOffset(tomorrowPt.fajr, "fajr");
    nextIdx = 0;
    targetTimeForCountdown = tomorrowFajr;
  } else {
    targetTimeForCountdown = rawSlots[nextIdx].time;
  }

  const fmt = new Intl.DateTimeFormat(settings.locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: loc.timezone,
  });

  const slots: ComputedPrayerSlot[] = rawSlots.map((s, idx) => ({
    ...s,
    formattedTime: fmt.format(s.time),
    isNext: idx === nextIdx,
  }));

  const diffMs = Math.max(0, targetTimeForCountdown.getTime() - now.getTime());
  const totalSec = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const duhaDate = new Date(pt.sunrise.getTime() + 15 * 60000);

  return {
    slots,
    nextPrayer: slots[nextIdx],
    countdownLabel: `${pad(hrs)}:${pad(mins)}:${pad(secs)}`,
    qiblaDegrees: Number(Qibla(coords).toFixed(1)),
    sunnahTimes: {
      duhaStart: fmt.format(duhaDate),
      middleOfTheNight: fmt.format(st.middleOfTheNight),
      lastThirdOfTheNight: fmt.format(st.lastThirdOfTheNight),
    },
  };
}

export function formatDualCalendar(now: Date, locale: Locale, hijriOffsetDays: number) {
  const adjustedDate = new Date(now.getTime() + hijriOffsetDays * 86400000);
  const gregorian = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  let hijri = "";
  try {
    hijri = new Intl.DateTimeFormat(
      locale === "ar" ? "ar-SA-u-ca-islamic-umalqura-nu-latn" : "en-US-u-ca-islamic-umalqura",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    ).format(adjustedDate);
  } catch {
    hijri = "";
  }

  return { gregorian, hijri };
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const OBLIGATORY_PRAYERS: { id: PrayerId; ar: string; en: string }[] = [
  { id: "fajr", ar: "الفجر", en: "Fajr" },
  { id: "dhuhr", ar: "الظهر", en: "Dhuhr" },
  { id: "asr", ar: "العصر", en: "Asr" },
  { id: "maghrib", ar: "المغرب", en: "Maghrib" },
  { id: "isha", ar: "العشاء", en: "Isha" },
];
