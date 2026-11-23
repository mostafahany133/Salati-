import React, { useState } from "react";
import {
  FileText,
  Languages,
  LifeBuoy,
  Activity,
  Megaphone,
  Plus,
  Trash2,
  Check,
  Shield,
} from "lucide-react";
import {
  AdminContentItem,
  AnnouncementItem,
  AuditEntry,
  Locale,
  SupportTicket,
  TranslationRow,
} from "../types/salati";

interface AdminDashboardProps {
  locale: Locale;
  content: AdminContentItem[];
  translations: TranslationRow[];
  tickets: SupportTicket[];
  announcements: AnnouncementItem[];
  auditLog: AuditEntry[];
  diagnostics: {
    appVersion: string;
    buildTarget: string;
    crashFreeRate: string;
    activeLocales: string[];
    offlinePackReady: boolean;
  };
  onRefresh: () => Promise<void>;
}

type AdminRole =
  | "مدير عام / General Manager"
  | "محرر محتوى / Content Editor"
  | "دعم فني / Support Lead"
  | "مسؤول تقني / Technical Lead";

type AdminTab = "content" | "translations" | "support" | "diagnostics" | "announcements";

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  locale,
  content,
  translations,
  tickets,
  announcements,
  auditLog,
  diagnostics,
  onRefresh,
}) => {
  const isAr = locale === "ar";
  const [role, setRole] = useState<AdminRole>("مدير عام / General Manager");
  const [tab, setTab] = useState<AdminTab>("content");
  const [statusMsg, setStatusMsg] = useState("");

  // New content form
  const [newKind, setNewKind] = useState<AdminContentItem["kind"]>("adhkar");
  const [newCategory, setNewCategory] = useState("morning");
  const [newTitleAr, setNewTitleAr] = useState("");
  const [newTitleEn, setNewTitleEn] = useState("");
  const [newBodyAr, setNewBodyAr] = useState("");
  const [newBodyEn, setNewBodyEn] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newRights, setNewRights] = useState("صحيح / موثق");

  // Translation edit state
  const [newTransKey, setNewTransKey] = useState("");
  const [newTransAr, setNewTransAr] = useState("");
  const [newTransEn, setNewTransEn] = useState("");

  // Support reply state
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // Announcement draft
  const [annTitleAr, setAnnTitleAr] = useState("");
  const [annTitleEn, setAnnTitleEn] = useState("");
  const [annBodyAr, setAnnBodyAr] = useState("");
  const [annBodyEn, setAnnBodyEn] = useState("");
  const [annType, setAnnType] = useState<"notice" | "sponsorship">("notice");

  const canEditContent =
    role.includes("General Manager") || role.includes("Content Editor");
  const canEditSupport =
    role.includes("General Manager") || role.includes("Support Lead");
  const canEditAnnouncements = role.includes("General Manager");

  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitleAr.trim() || !newBodyAr.trim()) return;
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        item: {
          kind: newKind,
          category: newCategory,
          titleAr: newTitleAr,
          titleEn: newTitleEn || newTitleAr,
          bodyAr: newBodyAr,
          bodyEn: newBodyEn || newBodyAr,
          source: newSource || "مصدر إسلامي معتمد",
          gradeOrRights: newRights || "موثق",
          published: true,
        },
      }),
    });
    if (res.ok) {
      setNewTitleAr("");
      setNewTitleEn("");
      setNewBodyAr("");
      setNewBodyEn("");
      setNewSource("");
      setStatusMsg(isAr ? "تمت إضافة المحتوى وتسجيل العملية." : "Content item published and audited.");
      await onRefresh();
    }
  };

  const handleTogglePublish = async (item: AdminContentItem) => {
    await fetch(`/api/admin/content/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, patch: { published: !item.published } }),
    });
    await onRefresh();
  };

  const handleDeleteContent = async (id: string) => {
    await fetch(`/api/admin/content/${id}`, {
      method: "DELETE",
      headers: { "x-admin-role": role },
    });
    await onRefresh();
  };

  const handleSaveTranslation = async (row: TranslationRow) => {
    await fetch("/api/admin/translations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, row }),
    });
    setStatusMsg(isAr ? `تم حفظ الترجمة: ${row.key}` : `Saved translation: ${row.key}`);
    await onRefresh();
  };

  const handleAddTranslation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransKey.trim()) return;
    await handleSaveTranslation({
      key: newTransKey.trim(),
      ar: newTransAr.trim(),
      en: newTransEn.trim(),
      reviewed: Boolean(newTransAr.trim() && newTransEn.trim()),
    });
    setNewTransKey("");
    setNewTransAr("");
    setNewTransEn("");
  };

  const handleUpdateTicket = async (
    id: string,
    status: SupportTicket["status"]
  ) => {
    await fetch(`/api/admin/support/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        status,
        reply: replyDrafts[id],
      }),
    });
    setStatusMsg(isAr ? `تم تحديث التذكرة ${id}` : `Updated ticket ${id}`);
    await onRefresh();
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitleAr.trim() || !annBodyAr.trim()) return;
    await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        announcement: {
          titleAr: annTitleAr,
          titleEn: annTitleEn || annTitleAr,
          bodyAr: annBodyAr,
          bodyEn: annBodyEn || annBodyAr,
          type: annType,
          active: true,
          scheduleWindow: "Non-prayer hours · Zero prayer-log targeting",
        },
      }),
    });
    setAnnTitleAr("");
    setAnnTitleEn("");
    setAnnBodyAr("");
    setAnnBodyEn("");
    await onRefresh();
  };

  const handleToggleAnnouncement = async (a: AnnouncementItem) => {
    await fetch(`/api/admin/announcements/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, patch: { active: !a.active } }),
    });
    await onRefresh();
  };

  const reviewedCount = translations.filter((t) => t.reviewed).length;

  return (
    <div className="space-y-6">
      {/* Top Admin Control Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {isAr ? "لوحة الإدارة المركزية — الإصدار 1.0" : "Web Admin Dashboard · Version 1.0"}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            {isAr ? "إدارة المحتوى الديني واللغات والدعم" : "Content, Localization, Support & Governance"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-500 dark:text-stone-400 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{isAr ? "الدور الإداري:" : "Active Role:"}</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-slate-900 dark:text-stone-100 text-xs font-medium"
            >
              <option value="مدير عام / General Manager">مدير عام / General Manager</option>
              <option value="محرر محتوى / Content Editor">محرر محتوى / Content Editor</option>
              <option value="دعم فني / Support Lead">دعم فني / Support Lead</option>
              <option value="مسؤول تقني / Technical Lead">مسؤول تقني / Technical Lead</option>
            </select>
          </label>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B]">
        {(
          [
            { id: "content", ar: "المحتوى والحقوق", en: "Content & Rights", icon: <FileText className="w-4 h-4" /> },
            { id: "translations", ar: "إدارة اللغات", en: "Translations", icon: <Languages className="w-4 h-4" /> },
            { id: "support", ar: "طلبات الدعم", en: "Support Inbox", icon: <LifeBuoy className="w-4 h-4" /> },
            { id: "diagnostics", ar: "الأعطال والإحصائيات", en: "Diagnostics", icon: <Activity className="w-4 h-4" /> },
            { id: "announcements", ar: "التنبيهات وسجل الإدارة", en: "Notices & Audit", icon: <Megaphone className="w-4 h-4" /> },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "bg-emerald-700 text-white dark:bg-emerald-600"
                : "text-slate-600 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-emerald-950/60"
            }`}
          >
            {t.icon}
            <span>{isAr ? t.ar : t.en}</span>
          </button>
        ))}
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
          {statusMsg}
        </div>
      )}

      {/* TAB 1: CONTENT & RIGHTS */}
      {tab === "content" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCreateContent}
            className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-3"
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isAr ? "إضافة محتوى ديني موثق" : "Publish Verified Content"}</span>
            </h2>
            {!canEditContent && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {isAr
                  ? "صلاحية التعديل متاحة للمدير العام أو محرر المحتوى."
                  : "Content editing requires General Manager or Content Editor role."}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as AdminContentItem["kind"])}
                className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
              >
                <option value="adhkar">{isAr ? "ذكر / دعاء" : "Adhkar / Dua"}</option>
                <option value="hadith">{isAr ? "حديث نبوي" : "Hadith"}</option>
                <option value="article">{isAr ? "مقال / درس" : "Article"}</option>
                <option value="audio">{isAr ? "مادة صوتية" : "Audio Track"}</option>
              </select>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={isAr ? "التصنيف (morning/wudu...)" : "Category"}
                className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
              />
            </div>
            <input
              type="text"
              value={newTitleAr}
              onChange={(e) => setNewTitleAr(e.target.value)}
              placeholder={isAr ? "العنوان بالعربية *" : "Arabic Title *"}
              className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
            />
            <input
              type="text"
              value={newTitleEn}
              onChange={(e) => setNewTitleEn(e.target.value)}
              placeholder={isAr ? "العنوان بالإنجليزية" : "English Title"}
              className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
            />
            <textarea
              rows={3}
              value={newBodyAr}
              onChange={(e) => setNewBodyAr(e.target.value)}
              placeholder={isAr ? "النص العربي *" : "Arabic Text *"}
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
            />
            <textarea
              rows={2}
              value={newBodyEn}
              onChange={(e) => setNewBodyEn(e.target.value)}
              placeholder={isAr ? "الترجمة الإنجليزية" : "English Translation"}
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
            />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <input
                type="text"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder={isAr ? "المصدر (مثال: صحيح مسلم)" : "Source citation"}
                className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
              />
              <input
                type="text"
                value={newRights}
                onChange={(e) => setNewRights(e.target.value)}
                placeholder={isAr ? "الدرجة / حقوق النشر" : "Grade / License"}
                className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
              />
            </div>
            <button
              type="submit"
              disabled={!canEditContent || !newTitleAr.trim() || !newBodyAr.trim()}
              className="w-full min-h-[42px] rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 dark:bg-emerald-600 text-white text-xs font-semibold"
            >
              {isAr ? "نشر في التطبيق" : "Publish Item"}
            </button>
          </form>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] divide-y divide-slate-100 dark:divide-emerald-900/40">
            {content.map((item) => (
              <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-stone-400">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">{item.kind}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.source}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.gradeOrRights}</span>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">
                    {isAr ? item.titleAr : item.titleEn}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-stone-300 line-clamp-2">
                    {isAr ? item.bodyAr : item.bodyEn}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!canEditContent}
                    onClick={() => handleTogglePublish(item)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium border ${
                      item.published
                        ? "border-emerald-600 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-300 text-slate-500"
                    }`}
                  >
                    {item.published ? (isAr ? "منشور" : "Live") : isAr ? "مخفي" : "Draft"}
                  </button>
                  <button
                    type="button"
                    disabled={!canEditContent}
                    onClick={() => handleDeleteContent(item.id)}
                    aria-label={isAr ? "حذف" : "Delete"}
                    className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-200 dark:border-emerald-900 text-rose-600 flex items-center justify-center disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TRANSLATIONS */}
      {tab === "translations" && (
        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? "إدارة النصوص العربية والإنجليزية" : "Bilingual String Review"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400 font-mono-num">
                {reviewedCount} / {translations.length} {isAr ? "مراجع ومعتمد" : "reviewed"}
              </p>
            </div>
          </div>

          <form onSubmit={handleAddTranslation} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <input
              type="text"
              value={newTransKey}
              onChange={(e) => setNewTransKey(e.target.value)}
              placeholder="key.name"
              className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] font-mono-num"
            />
            <input
              type="text"
              value={newTransAr}
              onChange={(e) => setNewTransAr(e.target.value)}
              placeholder={isAr ? "النص العربي" : "Arabic copy"}
              className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
            />
            <input
              type="text"
              value={newTransEn}
              onChange={(e) => setNewTransEn(e.target.value)}
              placeholder={isAr ? "النص الإنجليزي" : "English copy"}
              className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614]"
            />
            <button
              type="submit"
              disabled={!canEditContent}
              className="min-h-[38px] rounded-lg bg-emerald-700 text-white font-semibold disabled:opacity-40"
            >
              {isAr ? "إضافة مفتاح" : "Add String"}
            </button>
          </form>

          <div className="divide-y divide-slate-100 dark:divide-emerald-900/40">
            {translations.map((row) => (
              <div key={row.key} className="py-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
                <span className="md:col-span-3 font-mono-num font-semibold text-slate-700 dark:text-stone-200">
                  {row.key}
                </span>
                <span className="md:col-span-4 text-slate-700 dark:text-stone-300">{row.ar}</span>
                <span className="md:col-span-3 text-slate-600 dark:text-stone-400" dir="ltr">
                  {row.en}
                </span>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    disabled={!canEditContent}
                    onClick={() => handleSaveTranslation({ ...row, reviewed: !row.reviewed })}
                    className={`min-h-[34px] px-3 rounded-lg border inline-flex items-center gap-1.5 ${
                      row.reviewed
                        ? "border-emerald-600 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{row.reviewed ? (isAr ? "مُراجع" : "Reviewed") : isAr ? "بحاجة لمراجعة" : "Needs Review"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SUPPORT TICKETS */}
      {tab === "support" && (
        <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] divide-y divide-slate-100 dark:divide-emerald-900/40">
          <div className="p-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? "استفسارات وطلبات الدعم الفني" : "User Support & Diagnostic Queue"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">
                {isAr
                  ? "لا تحتوي التذاكر على أي بيانات شخصية من سجل الصلاة حفاظاً على الخصوصية."
                  : "Tickets carry only voluntary diagnostic metadata—personal prayer logs are never exposed."}
              </p>
            </div>
          </div>

          {tickets.map((t) => (
            <div key={t.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-mono-num">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">{t.id}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-500">{t.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-500">v{t.appVersion} ({t.locale})</span>
                </div>
                <span
                  className={`font-semibold ${
                    t.status === "resolved"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-300"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <p className="font-semibold text-sm text-slate-900 dark:text-white">{t.subject}</p>
              <p className="text-xs text-slate-600 dark:text-stone-300">{t.message}</p>
              {t.reply && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {isAr ? "الرد المسجل:" : "Reply:"} {t.reply}
                </p>
              )}
              {canEditSupport && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={replyDrafts[t.id] ?? t.reply ?? ""}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    placeholder={isAr ? "اكتب رد الدعم..." : "Write support reply..."}
                    className="flex-1 min-w-[200px] min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateTicket(t.id, "resolved")}
                    className="min-h-[38px] px-3.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold"
                  >
                    {isAr ? "إغلاق وحفظ الرد" : "Resolve & Reply"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: DIAGNOSTICS */}
      {tab === "diagnostics" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-5">
            <span className="text-xs text-slate-500 dark:text-stone-400">
              {isAr ? "إصدار التطبيق" : "Release Version"}
            </span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono-num mt-1">
              {diagnostics.appVersion}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-5">
            <span className="text-xs text-slate-500 dark:text-stone-400">
              {isAr ? "استقرار الجلسات المجمّع" : "Aggregated Stability"}
            </span>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 font-mono-num mt-1">
              {diagnostics.crashFreeRate}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-5">
            <span className="text-xs text-slate-500 dark:text-stone-400">
              {isAr ? "اللغات المدعومة" : "Active Locales"}
            </span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono-num mt-1">
              {diagnostics.activeLocales.join(" · ").toUpperCase()}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-5">
            <span className="text-xs text-slate-500 dark:text-stone-400">
              {isAr ? "جاهزية العمل دون إنترنت" : "Offline Core Status"}
            </span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {diagnostics.offlinePackReady ? (isAr ? "مفعّلة" : "Ready") : "Pending"}
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: ANNOUNCEMENTS & AUDIT LOG */}
      {tab === "announcements" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 space-y-4">
            <form
              onSubmit={handleAddAnnouncement}
              className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-3"
            >
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? "إدارة التنويهات والرعاية الهادئة" : "Non-Intrusive Notices & Sponsorships"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400">
                {isAr
                  ? "تُمنع الإعلانات المزعجة أو الظهور أثناء الأذان، ولا يُستخدم سجل الصلاة في الاستهداف مطلقاً."
                  : "Never shown during Adhan or prayer focus; zero prayer-log targeting permitted."}
              </p>
              <select
                value={annType}
                onChange={(e) => setAnnType(e.target.value as "notice" | "sponsorship")}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
              >
                <option value="notice">{isAr ? "تنويه عام (مثل صيام الأيام البيض)" : "General Notice"}</option>
                <option value="sponsorship">{isAr ? "رعاية خيرية متوافقة مع الهوية" : "Ethical Sponsorship"}</option>
              </select>
              <input
                type="text"
                value={annTitleAr}
                onChange={(e) => setAnnTitleAr(e.target.value)}
                placeholder={isAr ? "العنوان بالعربية *" : "Arabic Title *"}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
              />
              <input
                type="text"
                value={annTitleEn}
                onChange={(e) => setAnnTitleEn(e.target.value)}
                placeholder={isAr ? "العنوان بالإنجليزية" : "English Title"}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
              />
              <textarea
                rows={2}
                value={annBodyAr}
                onChange={(e) => setAnnBodyAr(e.target.value)}
                placeholder={isAr ? "نص التنويه بالعربية *" : "Arabic Body *"}
                className="w-full p-3 rounded-lg border border-slate-200 dark:border-emerald-900 bg-slate-50 dark:bg-[#071614] text-xs"
              />
              <button
                type="submit"
                disabled={!canEditAnnouncements || !annTitleAr.trim() || !annBodyAr.trim()}
                className="w-full min-h-[40px] rounded-xl bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40"
              >
                {isAr ? "إضافة التنويه" : "Publish Notice"}
              </button>
            </form>

            <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] divide-y divide-slate-100 dark:divide-emerald-900/40">
              {announcements.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {isAr ? a.titleAr : a.titleEn}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-stone-400">{a.scheduleWindow}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!canEditAnnouncements}
                    onClick={() => handleToggleAnnouncement(a)}
                    className={`min-h-[34px] px-3 rounded-lg border text-xs font-medium ${
                      a.active
                        ? "border-emerald-600 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-300 text-slate-500"
                    }`}
                  >
                    {a.active ? (isAr ? "مفعّل" : "Active") : isAr ? "موقف" : "Paused"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Log */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#0A1E1B] p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isAr ? "سجل العمليات الإدارية (Audit Log)" : "Administrative Audit Log"}
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-emerald-900/40 max-h-[380px] overflow-y-auto">
              {auditLog.map((entry) => (
                <div key={entry.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-stone-400">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">{entry.role}</span>
                    <span className="font-mono-num">
                      {new Date(entry.timestamp).toLocaleString(isAr ? "ar-SA" : "en-US")}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-stone-200">
                    {entry.action} — <span className="text-slate-500">{entry.target}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
