import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, ".data");
const STORE_PATH = path.resolve(DATA_DIR, "salati-store.json");

interface AdminContentItem {
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

interface TranslationRow {
  key: string;
  ar: string;
  en: string;
  reviewed: boolean;
}

interface SupportTicket {
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

interface AnnouncementItem {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type: "notice" | "sponsorship";
  active: boolean;
  scheduleWindow: string;
}

interface AuditEntry {
  id: string;
  role: string;
  action: string;
  target: string;
  timestamp: string;
}

interface StoreState {
  content: AdminContentItem[];
  translations: TranslationRow[];
  tickets: SupportTicket[];
  announcements: AnnouncementItem[];
  auditLog: AuditEntry[];
}

const DEFAULT_STORE: StoreState = {
  content: [
    {
      id: "dhikr-morning-1",
      kind: "adhkar",
      category: "morning",
      titleAr: "سيد الاستغفار",
      titleEn: "Master Supplication for Forgiveness",
      bodyAr: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.",
      bodyEn: "O Allah, You are my Lord, none has the right to be worshipped except You. You created me and I am Your servant, and I abide to Your covenant and promise as best I can.",
      source: "صحيح البخاري (6306)",
      gradeOrRights: "صحيح — متاح للملكية العامة",
      repeatCount: 1,
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "dhikr-morning-2",
      kind: "adhkar",
      category: "morning",
      titleAr: "أصبحنا على فطرة الإسلام",
      titleEn: "Morning Upon the Natural Disposition of Islam",
      bodyAr: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.",
      bodyEn: "We have reached the morning and at this very time all sovereignty belongs to Allah, and all praise is for Allah. None has the right to be worshipped except Allah alone.",
      source: "صحيح مسلم (2723)",
      gradeOrRights: "صحيح — متاح للملكية العامة",
      repeatCount: 1,
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "dhikr-evening-1",
      kind: "adhkar",
      category: "evening",
      titleAr: "أمسينا وأمسى الملك لله",
      titleEn: "Evening Dominion Belongs to Allah",
      bodyAr: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.",
      bodyEn: "We have reached the evening and at this very time all sovereignty belongs to Allah, and all praise is for Allah.",
      source: "صحيح مسلم (2723)",
      gradeOrRights: "صحيح — متاح للملكية العامة",
      repeatCount: 1,
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "dhikr-evening-2",
      kind: "adhkar",
      category: "evening",
      titleAr: "حسبي الله لا إله إلا هو",
      titleEn: "Allah Is Sufficient For Me",
      bodyAr: "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.",
      bodyEn: "Allah is sufficient for me; there is no deity worthy of worship except Him. Upon Him I rely, and He is the Lord of the Mighty Throne.",
      source: "سنن أبي داود (5081) — موقوفاً ومرفوعاً بأسانيد حسنة",
      gradeOrRights: "حسن موقوفاً (ابن باز)",
      repeatCount: 7,
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "dhikr-prayer-1",
      kind: "adhkar",
      category: "prayer",
      titleAr: "الاستغفار والسلام بعد الصلاة",
      titleEn: "Seeking Forgiveness & Peace After Prayer",
      bodyAr: "أَسْتَغْفِرُ اللَّهَ (ثلاثًا) اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ.",
      bodyEn: "I seek the forgiveness of Allah (three times). O Allah, You are Peace and from You comes peace. Blessed are You, O Possessor of majesty and honor.",
      source: "صحيح مسلم (591)",
      gradeOrRights: "صحيح",
      repeatCount: 3,
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "dhikr-prayer-2",
      kind: "adhkar",
      category: "prayer",
      titleAr: "التسبيح والتحميد والتكبير",
      titleEn: "Tasbih, Tahmid & Takbir (33x)",
      bodyAr: "سُبْحَانَ اللَّهِ (٣٣) — الْحَمْدُ لِلَّهِ (٣٣) — اللَّهُ أَكْبَرُ (٣٣)، ثم تمام المائة: لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.",
      bodyEn: "Glory be to Allah (33), Praise be to Allah (33), Allah is the Greatest (33), completed with: None has the right to be worshipped except Allah alone...",
      source: "صحيح مسلم (597)",
      gradeOrRights: "صحيح",
      repeatCount: 33,
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "dhikr-dua-1",
      kind: "adhkar",
      category: "duas",
      titleAr: "دعاء الثبات على الصلاة",
      titleEn: "Supplication for Steadfastness in Prayer",
      bodyAr: "رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي ۚ رَبَّنَا وَتَقَبَّلْ دُعَاءِ.",
      bodyEn: "My Lord, make me an establisher of prayer, and [many] from my descendants. Our Lord, and accept my supplication.",
      source: "سورة إبراهيم — الآية 40",
      gradeOrRights: "قرآن كريم",
      repeatCount: 1,
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "hadith-1",
      kind: "hadith",
      category: "prayer",
      titleAr: "مثل الصلوات الخمس",
      titleEn: "The Parable of the Five Daily Prayers",
      bodyAr: "عن أبي هريرة رضي الله عنه قال: سمعت رسول الله ﷺ يقول: «أَرَأَيْتُمْ لَوْ أَنَّ نَهْرًا بِبَابِ أَحَدِكُمْ يَغْتَسِلُ فِيهِ كُلَّ يَوْمٍ خَمْسَ مَرَّاتٍ، هَلْ يَبْقَى مِنْ دَرَنِهِ شَيْءٌ؟» قالوا: لا يبقى من درنه شيء، قال: «فَذَلِكَ مَثَلُ الصَّلَوَاتِ الْخَمْسِ، يَمْحُو اللَّهُ بِهِنَّ الْخَطَايَا».",
      bodyEn: "Abu Hurairah reported that the Messenger of Allah (peace be upon him) said: 'If there were a river at the door of one of you in which he bathed five times a day, would any of his filth remain?' They replied, 'None of it would remain.' He said, 'That is the parable of the five prayers by which Allah erases sins.'",
      source: "متفق عليه: صحيح البخاري (528) وصحيح مسلم (667)",
      gradeOrRights: "صحيح (متفق عليه)",
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "hadith-2",
      kind: "hadith",
      category: "wudu",
      titleAr: "فضل إسباغ الوضوء",
      titleEn: "Virtue of Completing Wudu Thoroughly",
      bodyAr: "عن عثمان بن عفان رضي الله عنه قال: قال رسول الله ﷺ: «مَنْ تَوَضَّأَ فَأَحْسَنَ الْوُضُوءَ خَرَجَتْ خَطَايَاهُ مِنْ جَسَدِهِ حَتَّى تَخْرُجَ مِنْ تَحْتِ أَظْفَارِهِ».",
      bodyEn: "Uthman ibn Affan reported that the Messenger of Allah (peace be upon him) said: 'Whoever performs ablution and performs it well, his sins will depart from his body, even from beneath his fingernails.'",
      source: "صحيح مسلم (245)",
      gradeOrRights: "صحيح",
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "hadith-3",
      kind: "hadith",
      category: "character",
      titleAr: "أحب الأعمال إلى الله أدومها",
      titleEn: "Most Beloved Deeds Are Consistent",
      bodyAr: "عن عائشة رضي الله عنها أن النبي ﷺ قال: «أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ».",
      bodyEn: "Aishah (may Allah be pleased with her) reported that the Prophet (peace be upon him) said: 'The most beloved of deeds to Allah are those that are most consistent, even if they are small.'",
      source: "متفق عليه: صحيح البخاري (6464) وصحيح مسلم (783)",
      gradeOrRights: "صحيح (متفق عليه)",
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "article-1",
      kind: "article",
      category: "khushu",
      titleAr: "تهيئة القلب قبل دخول وقت الصلاة",
      titleEn: "Preparing the Heart Before Prayer Time Arrives",
      bodyAr: "تبدأ الطمأنينة في الصلاة قبل تكبيرة الإحرام بدقائق؛ حين يتوقف المسلم عن زحام المهام، ويستشعر نداء الأذان، ويتوضأ بسكينة وتدبر، ليقف بين يدي الله بقلب حاضر بعيد عن العجلة.",
      bodyEn: "Tranquility in prayer begins minutes before Takbir al-Ihram: pausing busy work, welcoming the Adhan calmly, and performing Wudu with mindfulness so one stands in prayer unhurried.",
      source: "هيئة التحرير التربوية — صلاتي",
      gradeOrRights: "محتوى أصلي — رخصة صلاتي المفتوحة",
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "audio-1",
      kind: "audio",
      category: "reflection",
      titleAr: "تأملات في معنى الحيّ على الفلاح",
      titleEn: "Reflections on 'Come to Success'",
      bodyAr: "مقطع صوتي هادئ يتناول كيف تُعيد الصلوات الخمس ترتيب إيقاع اليوم والتركيز النفسي للمسلم المعاصر.",
      bodyEn: "A calm reflection on how the five daily prayers restore rhythm, clarity, and inner steadiness to a modern schedule.",
      source: "مكتبة صلاتي الصوتية — سلسلة السكينة",
      gradeOrRights: "مرخّص للاستخدام المجاني غير التجاري (CC-BY-NC)",
      durationLabel: "04:20",
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
    {
      id: "audio-2",
      kind: "audio",
      category: "wudu",
      titleAr: "دليل السكينة أثناء الوضوء للمبتدئين",
      titleEn: "Mindful Wudu Guide for Beginners",
      bodyAr: "شرح ميسّر لسنن الوضوء وآداب الاقتصاد في الماء واستحضار النية خطوة بخطوة.",
      bodyEn: "An accessible walkthrough of Wudu steps, conserving water, and mindful intention step by step.",
      source: "مكتبة صلاتي الصوتية — فقه ميسّر",
      gradeOrRights: "مرخّص للاستخدام التعليمي المجاني (Salati Original)",
      durationLabel: "03:45",
      published: true,
      updatedAt: "2026-11-20T08:00:00Z",
    },
  ],
  translations: [
    { key: "app.tagline", ar: "رفيقك اليومي للمحافظة على الصلاة", en: "Your daily companion for mindful prayer", reviewed: true },
    { key: "journey.skip", ar: "تخطي المرحلة", en: "Skip Stage", reviewed: true },
    { key: "log.gentleNote", ar: "تعكس هذه الإحصائيات ما سجلته شخصياً فقط", en: "Stats reflect only your self-recorded entries", reviewed: true },
    { key: "privacy.noAccount", ar: "يعمل بدون إنشاء حساب — بياناتك تبقى على جهازك", en: "Works without an account — your data stays on your device", reviewed: true },
    { key: "admin.sponsorshipPolicy", ar: "رعاية هادئة بدون استهداف إعلاني لسجل الصلاة", en: "Respectful sponsorship without prayer-log targeting", reviewed: false },
  ],
  tickets: [
    {
      id: "TKT-104",
      subject: "اختلاف دقيقة في صلاة العصر بمدينة جدة",
      message: "هل يمكن إضافة خيار التعديل اليدوي بدقائق لكل صلاة على حدة؟",
      category: "مواقيت الصلاة",
      appVersion: "1.0.0",
      locale: "ar",
      status: "resolved",
      reply: "تم توفير خيار الإزاحة اليدوية بالدقائق من إعدادات المواقيت.",
      createdAt: "2026-11-19T14:20:00Z",
    },
    {
      id: "TKT-105",
      subject: "Qibla calibration guidance on older Android sensors",
      message: "Helpful figure-8 calibration prompt works nicely; could we keep manual compass degree visible?",
      category: "Qibla & Sensors",
      appVersion: "1.0.0",
      locale: "en",
      status: "in_review",
      createdAt: "2026-11-21T09:45:00Z",
    },
  ],
  announcements: [
    {
      id: "ANN-1",
      titleAr: "تذكير بصيام الأيام البيض",
      titleEn: "Gentle Reminder: White Days Fasting",
      bodyAr: "فرصة مباركة للاستعداد لصيام الأيام البيض في منتصف الشهر الهجري، تقبل الله طاعاتكم.",
      bodyEn: "A gentle reminder for the mid-month White Days (13th–15th Hijri). May your deeds be accepted.",
      type: "notice",
      active: true,
      scheduleWindow: "12–15 Hijri · Non-prayer hours only",
    },
    {
      id: "ANN-2",
      titleAr: "رعاية خيرية: مشروع سقيا المساجد",
      titleEn: "Ethical Sponsorship: Clean Water for Community Mosques",
      bodyAr: "تطبيق صلاتي مجاني بالكامل بدعم من مبادرات وقفية هادفة، دون أي تتبع أو استهداف لسجل عبادتك.",
      bodyEn: "Salati remains 100% free via transparent charitable endowments, with zero ad tracking of your prayer logs.",
      type: "sponsorship",
      active: true,
      scheduleWindow: "Footer / Services view only · Never during Adhan",
    },
  ],
  auditLog: [
    {
      id: "AUD-1",
      role: "مدير عام / General Manager",
      action: "اعتماد سياسة عدم تتبع سجل الصلاة للإعلانات",
      target: "Privacy & Sponsorship Policy v1.0",
      timestamp: "2026-11-20T07:30:00Z",
    },
    {
      id: "AUD-2",
      role: "محرر محتوى / Content Editor",
      action: "توثيق مصادر وتخريج أذكار الصباح والمساء",
      target: "Adhkar Repository (7 items)",
      timestamp: "2026-11-21T10:15:00Z",
    },
  ],
};

function loadStore(): StoreState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), "utf8");
      return structuredClone(DEFAULT_STORE);
    }
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw) as StoreState;
  } catch (err) {
    console.error("Failed to load store, using default:", err);
    return structuredClone(DEFAULT_STORE);
  }
}

function saveStore(state: StoreState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save store:", err);
  }
}

let store: StoreState = loadStore();

function appendAudit(role: string, action: string, target: string) {
  store.auditLog.unshift({
    id: `AUD-${Date.now()}`,
    role: role || "محرر محتوى / Content Editor",
    action,
    target,
    timestamp: new Date().toISOString(),
  });
  store.auditLog = store.auditLog.slice(0, 40);
  saveStore(store);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Content & Admin Read API
  app.get("/api/content", (_req, res) => {
    res.json({
      content: store.content,
      translations: store.translations,
      tickets: store.tickets,
      announcements: store.announcements,
      auditLog: store.auditLog,
      diagnostics: {
        appVersion: "1.0.0",
        buildTarget: "Web / iOS / Android Unified Spec",
        crashFreeRate: "99.94%",
        activeLocales: ["ar", "en"],
        offlinePackReady: true,
      },
    });
  });

  // Admin Content CRUD
  app.post("/api/admin/content", (req, res) => {
    const { item, role } = req.body;
    if (!item?.titleAr || !item?.bodyAr) {
      res.status(400).json({ error: "Missing required Arabic title or body." });
      return;
    }
    const created: AdminContentItem = {
      id: `${item.kind || "item"}-${Date.now()}`,
      kind: item.kind || "adhkar",
      category: item.category || "general",
      titleAr: String(item.titleAr),
      titleEn: String(item.titleEn || item.titleAr),
      bodyAr: String(item.bodyAr),
      bodyEn: String(item.bodyEn || item.bodyAr),
      source: String(item.source || "مصدر موثق"),
      gradeOrRights: String(item.gradeOrRights || "موثق"),
      repeatCount: item.repeatCount ? Number(item.repeatCount) : 1,
      durationLabel: item.durationLabel ? String(item.durationLabel) : undefined,
      published: item.published !== false,
      updatedAt: new Date().toISOString(),
    };
    store.content.unshift(created);
    appendAudit(role, `إضافة محتوى (${created.kind})`, created.titleAr);
    res.status(201).json({ item: created });
  });

  app.put("/api/admin/content/:id", (req, res) => {
    const { id } = req.params;
    const { patch, role } = req.body;
    const idx = store.content.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "Content item not found." });
      return;
    }
    store.content[idx] = {
      ...store.content[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    appendAudit(role, "تحديث محتوى", store.content[idx].titleAr);
    res.json({ item: store.content[idx] });
  });

  app.delete("/api/admin/content/:id", (req, res) => {
    const { id } = req.params;
    const role = (req.headers["x-admin-role"] as string) || "مدير عام / General Manager";
    const existing = store.content.find((c) => c.id === id);
    if (!existing) {
      res.status(404).json({ error: "Content item not found." });
      return;
    }
    store.content = store.content.filter((c) => c.id !== id);
    appendAudit(role, "حذف محتوى", existing.titleAr);
    res.json({ deleted: id });
  });

  // Admin Translations
  app.put("/api/admin/translations", (req, res) => {
    const { row, role } = req.body;
    if (!row?.key) {
      res.status(400).json({ error: "Translation key required." });
      return;
    }
    const idx = store.translations.findIndex((t) => t.key === row.key);
    if (idx >= 0) {
      store.translations[idx] = { ...store.translations[idx], ...row };
    } else {
      store.translations.push({
        key: row.key,
        ar: row.ar || "",
        en: row.en || "",
        reviewed: Boolean(row.reviewed),
      });
    }
    appendAudit(role, "تحديث/مراجعة ترجمة", row.key);
    res.json({ translations: store.translations });
  });

  // Support Tickets (Public submission without personal prayer log)
  app.post("/api/support", (req, res) => {
    const { subject, message, category, locale } = req.body;
    if (!subject || !message) {
      res.status(400).json({ error: "Subject and message are required." });
      return;
    }
    const ticket: SupportTicket = {
      id: `TKT-${Math.floor(100 + Math.random() * 900)}`,
      subject: String(subject).slice(0, 140),
      message: String(message).slice(0, 1200),
      category: String(category || "General"),
      appVersion: "1.0.0",
      locale: locale === "en" ? "en" : "ar",
      status: "open",
      createdAt: new Date().toISOString(),
    };
    store.tickets.unshift(ticket);
    saveStore(store);
    res.status(201).json({ ticket });
  });

  app.put("/api/admin/support/:id", (req, res) => {
    const { id } = req.params;
    const { status, reply, role } = req.body;
    const idx = store.tickets.findIndex((t) => t.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }
    store.tickets[idx] = {
      ...store.tickets[idx],
      status: status || store.tickets[idx].status,
      reply: reply !== undefined ? String(reply) : store.tickets[idx].reply,
    };
    appendAudit(role, "الرد على تذكرة دعم", `${id} (${store.tickets[idx].status})`);
    res.json({ ticket: store.tickets[idx] });
  });

  // Announcements & Non-Intrusive Sponsorships
  app.post("/api/admin/announcements", (req, res) => {
    const { announcement, role } = req.body;
    if (!announcement?.titleAr || !announcement?.bodyAr) {
      res.status(400).json({ error: "Title and body required." });
      return;
    }
    const item: AnnouncementItem = {
      id: `ANN-${Date.now()}`,
      titleAr: String(announcement.titleAr),
      titleEn: String(announcement.titleEn || announcement.titleAr),
      bodyAr: String(announcement.bodyAr),
      bodyEn: String(announcement.bodyEn || announcement.bodyAr),
      type: announcement.type === "sponsorship" ? "sponsorship" : "notice",
      active: announcement.active !== false,
      scheduleWindow: String(announcement.scheduleWindow || "Non-prayer hours only"),
    };
    store.announcements.unshift(item);
    appendAudit(role, "إضافة إعلان/رعاية", item.titleAr);
    res.status(201).json({ announcement: item });
  });

  app.put("/api/admin/announcements/:id", (req, res) => {
    const { id } = req.params;
    const { patch, role } = req.body;
    const idx = store.announcements.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "Announcement not found." });
      return;
    }
    store.announcements[idx] = { ...store.announcements[idx], ...patch };
    appendAudit(role, "تحديث إعلان/رعاية", store.announcements[idx].titleAr);
    res.json({ announcement: store.announcements[idx] });
  });

  // Nearby Mosques via OpenStreetMap Overpass API with curated graceful fallback
  app.get("/api/mosques", async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: "Valid lat and lng query parameters are required." });
      return;
    }
    try {
      const overpassQuery = `[out:json][timeout:8];(node["amenity"="place_of_worship"]["religion"="muslim"](around:4500,${lat},${lng});way["amenity"="place_of_worship"]["religion"="muslim"](around:4500,${lat},${lng}););out center 12;`;
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) {
        throw new Error(`Overpass returned ${response.status}`);
      }
      const data = await response.json();
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      const mosques = elements
        .map((el: any) => {
          const mLat = el.lat ?? el.center?.lat;
          const mLng = el.lon ?? el.center?.lon;
          if (!mLat || !mLng) return null;
          const name = el.tags?.["name:ar"] || el.tags?.name || el.tags?.["name:en"] || "مسجد محلي / Local Mosque";
          const nameEn = el.tags?.["name:en"] || el.tags?.name || "Local Mosque";
          const distKm = haversineKm(lat, lng, mLat, mLng);
          return {
            id: String(el.id),
            nameAr: name,
            nameEn,
            lat: mLat,
            lng: mLng,
            distanceKm: Number(distKm.toFixed(2)),
            address: el.tags?.["addr:street"] || "",
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
        .slice(0, 10);

      res.json({ mosques, source: "openstreetmap" });
    } catch {
      res.json({
        mosques: [],
        source: "offline-fallback",
      });
    }
  });

  // Quran Full 114-Surah Metadata & Text + Sheikh Yasser Al-Dosari Streaming Proxy
  let cachedSurahList: any[] | null = null;
  const cachedSurahDetails = new Map<number, any>();

  app.get("/api/quran/surahs", async (_req, res) => {
    if (cachedSurahList) {
      res.json({ surahs: cachedSurahList });
      return;
    }
    try {
      const resp = await fetch("https://api.alquran.cloud/v1/surah", {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) throw new Error("Failed to fetch surah list");
      const json = await resp.json();
      if (Array.isArray(json?.data)) {
        cachedSurahList = json.data.map((s: any) => ({
          number: s.number,
          nameAr: s.name,
          nameEn: s.englishName,
          englishMeaning: s.englishNameTranslation,
          numberOfAyahs: s.numberOfAyahs,
          revelationType: s.revelationType,
        }));
        res.json({ surahs: cachedSurahList });
        return;
      }
      throw new Error("Invalid surah payload");
    } catch {
      res.status(502).json({ error: "Unable to load 114-Surah list right now." });
    }
  });

  app.get("/api/quran/surah/:number", async (req, res) => {
    const num = Number(req.params.number);
    if (!Number.isInteger(num) || num < 1 || num > 114) {
      res.status(400).json({ error: "Surah number must be between 1 and 114." });
      return;
    }
    if (cachedSurahDetails.has(num)) {
      res.json(cachedSurahDetails.get(num));
      return;
    }
    try {
      const [quranRes, enTafsirRes] = await Promise.allSettled([
        fetch(
          `https://api.alquran.cloud/v1/surah/${num}/editions/quran-uthmani,en.sahih,ar.muyassar`,
          { signal: AbortSignal.timeout(15000) }
        ),
        fetch(
          `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/en-tafisr-ibn-kathir/${num}.json`,
          { signal: AbortSignal.timeout(15000) }
        ),
      ]);

      if (quranRes.status !== "fulfilled" || !quranRes.value.ok) {
        throw new Error("Failed to fetch Quran editions");
      }
      const json = await quranRes.value.json();
      const [uthmani, english, muyassar] = json?.data || [];
      if (!uthmani?.ayahs) throw new Error("Missing ayahs");

      const enTafsirMap = new Map<number, string>();
      if (enTafsirRes.status === "fulfilled" && enTafsirRes.value.ok) {
        try {
          const tafsirJson = await enTafsirRes.value.json();
          const list = Array.isArray(tafsirJson)
            ? tafsirJson
            : Array.isArray(tafsirJson?.ayahs)
            ? tafsirJson.ayahs
            : [];
          for (const entry of list) {
            if (entry?.ayah && entry?.text) {
              enTafsirMap.set(Number(entry.ayah), String(entry.text).trim());
            }
          }
        } catch {
          // ignore malformed English tafsir JSON
        }
      }

      const detail = {
        number: uthmani.number,
        nameAr: uthmani.name,
        nameEn: uthmani.englishName,
        englishMeaning: uthmani.englishNameTranslation,
        revelationType: uthmani.revelationType,
        numberOfAyahs: uthmani.numberOfAyahs,
        tafsirSourceAr: "التفسير الميسّر (مجمع الملك فهد)",
        tafsirSourceEn: "Tafsir Ibn Kathir (Abridged) · Sahih International",
        ayahs: uthmani.ayahs.map((a: any, idx: number) => {
          const ayahNum = Number(a.numberInSurah);
          const enTranslation = english?.ayahs?.[idx]?.text || "";
          return {
            num: ayahNum,
            ar: a.text,
            en: enTranslation,
            tafsirAr: muyassar?.ayahs?.[idx]?.text || "",
            tafsirEn: enTafsirMap.get(ayahNum) || enTranslation,
          };
        }),
      };
      cachedSurahDetails.set(num, detail);
      res.json(detail);
    } catch {
      res.status(502).json({ error: "Unable to load Surah verses right now." });
    }
  });

  const RECITER_AUDIO_BASES: Record<string, string[]> = {
    yasser_dosari: [
      "https://download.quranicaudio.com/quran/yasser_ad-dussary/",
      "https://cdn.mp3quran.net/audio/yasser-dosari/r1/",
    ],
    mishary_alafasy: [
      "https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/",
      "https://cdn.mp3quran.net/audio/mishary-alafasy/r1/",
    ],
    maher_muaiqly: [
      "https://download.quranicaudio.com/quran/maher_256/",
      "https://cdn.mp3quran.net/audio/maher-muaiqly/r1/",
    ],
    nasser_qatami: [
      "https://download.quranicaudio.com/quran/nasser_bin_ali_alqatami/",
      "https://cdn.mp3quran.net/audio/nasser-qatami/r1/",
    ],
    minshawi_murattal: [
      "https://download.quranicaudio.com/quran/muhammad_siddeeq_al-minshaawee/",
      "https://cdn.mp3quran.net/audio/muhammad-minshawi/r1/",
    ],
    minshawi_mujawwad: [
      "https://download.quranicaudio.com/quran/minshawi_mujawwad/",
      "https://cdn.mp3quran.net/audio/muhammad-minshawi/r2/",
    ],
    abdulbasit_murattal: [
      "https://download.quranicaudio.com/quran/abdul_basit_murattal/",
      "https://cdn.mp3quran.net/audio/abdulbasit-abdulsamad/r1/",
    ],
    husary_murattal: [
      "https://download.quranicaudio.com/quran/mahmood_khaleel_al-husaree/",
      "https://cdn.mp3quran.net/audio/mahmoud-husary/r1/",
    ],
    khalid_jalil: ["https://cdn.mp3quran.net/audio/khalid-jalil/r1/"],
    idrees_abkar: [
      "https://cdn.mp3quran.net/audio/idrees-abkar/r1/",
      "https://download.quranicaudio.com/quran/idrees_abkar/",
    ],
    fares_abbad: [
      "https://download.quranicaudio.com/quran/fares/",
      "https://cdn.mp3quran.net/audio/fares-abbad/r1/",
    ],
    saad_ghamdi: [
      "https://download.quranicaudio.com/quran/sa3d_al-ghaamidi/complete/",
      "https://cdn.mp3quran.net/audio/saad-ghamdi/r1/",
    ],
    sudais: [
      "https://download.quranicaudio.com/quran/abdurrahmaan_as-sudays/",
      "https://cdn.mp3quran.net/audio/abdulrahman-sudais/r1/",
    ],
    shuraim: [
      "https://download.quranicaudio.com/quran/sa3ood_al-shuraym/",
      "https://cdn.mp3quran.net/audio/saud-shuraim/r1/",
    ],
    ahmed_ajmi: [
      "https://download.quranicaudio.com/quran/ahmed_ibn_3ali_al-3ajamy/",
      "https://cdn.mp3quran.net/audio/ahmad-ajmi/r1/",
    ],
    ali_jaber: ["https://cdn.mp3quran.net/audio/ali-jaber/r1/"],
    abubakr_shatri: [
      "https://cdn.mp3quran.net/audio/abubakr-shatri/r1/",
      "https://download.quranicaudio.com/quran/abu_bakr_ash-shaatree/",
    ],
    muhammad_ayyub: [
      "https://cdn.mp3quran.net/audio/muhammad-ayyub/r2/",
      "https://download.quranicaudio.com/quran/muhammad_ayyoob/",
    ],
  };

  app.get("/api/quran/audio/:number", async (req, res) => {
    const num = Number(req.params.number);
    if (!Number.isInteger(num) || num < 1 || num > 114) {
      res.status(400).json({ error: "Surah number must be between 1 and 114." });
      return;
    }
    const reciterKey = typeof req.query.reciter === "string" && RECITER_AUDIO_BASES[req.query.reciter]
      ? req.query.reciter
      : "yasser_dosari";
    const padded = String(num).padStart(3, "0");
    const candidates = RECITER_AUDIO_BASES[reciterKey].map((base) => `${base}${padded}.mp3`);

    const headers: Record<string, string> = {};
    if (req.headers.range) {
      headers.Range = String(req.headers.range);
    }

    for (const url of candidates) {
      const controller = new AbortController();
      const connectTimer = setTimeout(() => controller.abort(), 12000);
      req.on("close", () => controller.abort());

      try {
        const upstream = await fetch(url, {
          headers,
          signal: controller.signal,
        });
        clearTimeout(connectTimer);
        if (!upstream.ok && upstream.status !== 206) continue;

        res.status(upstream.status);
        res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
        res.setHeader("Accept-Ranges", "bytes");
        const contentLength = upstream.headers.get("content-length");
        const contentRange = upstream.headers.get("content-range");
        if (contentLength) res.setHeader("Content-Length", contentLength);
        if (contentRange) res.setHeader("Content-Range", contentRange);
        res.setHeader("Cache-Control", "public, max-age=86400");

        if (!upstream.body) {
          res.end();
          return;
        }
        const { Readable } = await import("stream");
        const nodeStream = Readable.fromWeb(upstream.body as any);
        nodeStream.on("error", () => {
          if (!res.headersSent) res.status(502).end();
          else res.end();
        });
        nodeStream.pipe(res);
        return;
      } catch {
        clearTimeout(connectTimer);
      }
    }

    res.status(502).json({ error: "Unable to stream Quran audio right now." });
  });

  const MUEZZIN_AUDIO_MAP: Record<string, string[]> = {
    yasser_dosari: [
      "https://media.assabile.com/assabile/adhan_3435370/f5370aa1a7e2.mp3",
    ],
    mishary_alafasy: [
      "https://media.assabile.com/assabile/adhan_3435370/b45e93f1efb3.mp3",
      "https://archive.org/download/adhan.notifications/Mishary_Rashid_al_Afasy_Fajr_Adhan.mp3",
    ],
    nasser_qatami: [
      "https://media.assabile.com/assabile/adhan_3435370/6f509ec934a4.mp3",
      "https://archive.org/download/adhan.notifications/Nasser_al_Qatami_Adhan.mp3",
    ],
    ali_mulla_makkah: [
      "https://media.assabile.com/assabile/adhan_3435370/54944191e2e2.mp3",
      "https://archive.org/download/20230930_20230930_0716/" + encodeURIComponent("أذان الحرم.mp3"),
    ],
    essam_bukhari_madinah: [
      "https://media.assabile.com/assabile/adhan_3435370/7487fa449eeb.mp3",
    ],
    abdulbasit: [
      "https://media.assabile.com/assabile/adhan_3435370/02f1bec971bb.mp3",
      "https://archive.org/download/20230930_20230930_0716/" + encodeURIComponent("أذان جامع المحمدي دمشق سوريا عبد الباسط عبد الصمد .mp3"),
    ],
    minshawi: [
      "https://media.assabile.com/assabile/adhan_3435370/5771e6a59f2b.mp3",
    ],
    muhammad_refaat: [
      "https://media.assabile.com/assabile/adhan_3435370/d8a3a72860e8.mp3",
    ],
    husary: [
      "https://media.assabile.com/assabile/adhan_3435370/cdb24a4bd658.mp3",
      "https://archive.org/download/20240913_20240913_1950/" + encodeURIComponent("الحصري الأذان.mp3"),
    ],
    mustafa_ismail: [
      "https://media.assabile.com/assabile/adhan_3435370/dd5f42239b71.mp3",
      "https://archive.org/download/MostafaeEsmail-Azan/Ezan1002_Mustafa_Ismail.mp3",
    ],
    al_banna: [
      "https://media.assabile.com/assabile/adhan_3435370/48f9d6984758.mp3",
    ],
    islam_sobhi: [
      "https://archive.org/download/A.S.I.S/Adhan_Sheikh-Islam-Sobhi.mp3",
    ],
    farooq_hadrawi: [
      "https://media.assabile.com/assabile/adhan_3435370/1aadb2df7d5c.mp3",
      "https://archive.org/download/athan2_202301/athan2.mp3",
    ],
    omar_kazabri: [
      "https://media.assabile.com/assabile/adhan_3435370/f77bff859f61.mp3",
    ],
    ahmed_imadi: [
      "https://media.assabile.com/assabile/adhan_3435370/232673ccf543.mp3",
      "https://archive.org/download/adhan.notifications/Ahmed_al_Imadi_Adhan.mp3",
    ],
  };

  app.get("/api/adhan/audio/:id", async (req, res) => {
    const id = req.params.id;
    const candidates = MUEZZIN_AUDIO_MAP[id] || MUEZZIN_AUDIO_MAP.yasser_dosari;

    const headers: Record<string, string> = {};
    if (req.headers.range) {
      headers.Range = String(req.headers.range);
    }

    for (const url of candidates) {
      const controller = new AbortController();
      const connectTimer = setTimeout(() => controller.abort(), 12000);
      req.on("close", () => controller.abort());

      try {
        const upstream = await fetch(url, {
          headers,
          signal: controller.signal,
        });
        clearTimeout(connectTimer);
        if (!upstream.ok && upstream.status !== 206) continue;

        res.status(upstream.status);
        res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
        res.setHeader("Accept-Ranges", "bytes");
        const contentLength = upstream.headers.get("content-length");
        const contentRange = upstream.headers.get("content-range");
        if (contentLength) res.setHeader("Content-Length", contentLength);
        if (contentRange) res.setHeader("Content-Range", contentRange);
        res.setHeader("Cache-Control", "public, max-age=86400");

        if (!upstream.body) {
          res.end();
          return;
        }
        const { Readable } = await import("stream");
        const nodeStream = Readable.fromWeb(upstream.body as any);
        nodeStream.on("error", () => {
          if (!res.headersSent) res.status(502).end();
          else res.end();
        });
        nodeStream.pipe(res);
        return;
      } catch {
        clearTimeout(connectTimer);
      }
    }

    res.status(502).json({ error: "Unable to stream Adhan audio right now." });
  });

  // Server-Side Gemini AI Assistant (Section 7 of Salati Spec)
  app.post("/api/assistant", async (req, res) => {
    const { mode, query, lang, prayerContext } = req.body;
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Query text is required." });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error:
          lang === "en"
            ? "Gemini API key is not configured in Settings > Secrets."
            : "مفتاح Gemini API غير مُعدّ في إعدادات الأسرار (Settings > Secrets).",
      });
      return;
    }

    const isPersonal = mode === "personal";
    const responseLanguage = lang === "en" ? "English" : "Arabic";

    const systemInstruction = isPersonal
      ? `You are the Personal Prayer Companion inside the Salati (صلاتي) app.
Respond strictly in ${responseLanguage}.
Core Ethical Guardrails (MANDATORY):
1. You NEVER judge, guilt, scold, or evaluate the user's faith or worship.
2. You NEVER claim to know whether the user actually prayed; you only see optional self-recorded entries if shared.
3. Offer gentle, practical daily schedule suggestions around the user's prayer times (e.g., short pre-prayer wudu pauses, calm morning/evening focus blocks, realistic reminders).
4. Keep advice concise, warm, dignified, and supportive.`
      : `You are the Islamic Reference Assistant inside the Salati (صلاتي) app.
Respond strictly in ${responseLanguage}.
Core Ethical & Epistemic Guardrails (MANDATORY):
1. Rely strictly on well-established, mainstream Islamic scholarly sources (Quran, Sahih al-Bukhari, Sahih Muslim, Sunan, Tafsir al-Sa'di, Al-Mawsu'ah al-Fiqhiyyah, etc.).
2. NEVER fabricate or guess Quranic verses, Hadith texts, Hadith grades, or scholarly rulings.
3. Always provide explicit source references in the "sources" array.
4. If a question involves nuanced scholarly differences, personal fatwa circumstances, or you lack sufficient certainty, clearly state that in "uncertaintyNote" and recommend consulting a qualified local scholar or trusted fatwa council in "scholarNote".
5. Never judge the user.`;

    const contextSummary =
      isPersonal && prayerContext
        ? `\n[Consented local schedule context: City=${prayerContext.city || "Unknown"}, NextPrayer=${prayerContext.nextPrayer || "N/A"}, SelfRecordedToday=${prayerContext.loggedToday ?? "Not shared"}, ContinuityDays=${prayerContext.streakDays ?? "Not shared"}]`
        : "";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `${query}${contextSummary}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: "Clear, respectful, well-structured answer in the requested language.",
              },
              sources: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Verified primary sources or practical references supporting the answer.",
              },
              uncertaintyNote: {
                type: Type.STRING,
                description: "Explicit disclosure of scholarly differences or any uncertainty, or empty string if clear.",
              },
              scholarNote: {
                type: Type.STRING,
                description: "Guidance to consult qualified scholars for complex or personal rulings.",
              },
            },
            required: ["answer", "sources", "uncertaintyNote", "scholarNote"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (err: any) {
      console.error("Gemini assistant error:", err);
      const status = err?.status || 500;
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error:
          lang === "en"
            ? "Unable to reach the assistant right now. Please check your Gemini API key or try again."
            : "تعذر الاتصال بالمساعد الذكي حالياً. يرجى التحقق من مفتاح API أو المحاولة مرة أخرى.",
      });
    }
  });

  // Vite middleware in dev or static serving in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Salati server running on http://0.0.0.0:${PORT}`);
  });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

startServer();
