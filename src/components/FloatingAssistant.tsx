/**
 * FloatingAssistant — persistent bottom-right chat widget.
 *
 * Behaviour:
 *  - Always visible on marketing pages (homepage, report pages).
 *  - When a scan completes, MonitoringForm writes the entryId to localStorage
 *    (ENTRY_KEY). The widget reads it and binds to that product automatically.
 *  - On refresh the widget re-reads localStorage and stays bound.
 *  - Without an entryId the widget opens but tells the user to submit a product first.
 *  - Uses the same grounded /api/public/scan/:id/ask endpoint as the /ask page.
 *  - Language tracks the i18n store: switches instantly on EN/中文 toggle.
 */

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Sparkles, ExternalLink, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askProduct, fetchScanContext, type AssistantSource } from "@/lib/api";
import { useLang, t } from "@/lib/i18n";

export const LATEST_ENTRY_KEY = "clearport_latest_entry_id";

type Msg = {
  role: "user" | "assistant";
  text: string;
  sources?: AssistantSource[];
  grounded?: boolean;
};

export function FloatingAssistant() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [entryId, setEntryId] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(LATEST_ENTRY_KEY) : null,
  );
  const [productName, setProductName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pick up entryId set by MonitoringForm after a successful scan.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === LATEST_ENTRY_KEY && e.newValue) {
        setEntryId(e.newValue);
        setMessages([]); // new product → fresh chat
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Custom event so the same-tab MonitoringForm can notify us immediately.
  useEffect(() => {
    function onEntry(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      setEntryId(id);
      setMessages([]);
    }
    window.addEventListener("clearport:entry", onEntry);
    return () => window.removeEventListener("clearport:entry", onEntry);
  }, []);

  // Fetch product name when entryId changes.
  useEffect(() => {
    if (!entryId) { setProductName(null); return; }
    fetchScanContext(entryId).then((ctx) => {
      if (ctx) setProductName(ctx.product_name);
    }).catch(() => {});
  }, [entryId]);

  // Auto-scroll to bottom.
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading, open]);

  const send = async (q: string) => {
    if (!q.trim() || loading || !entryId) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    const r = await askProduct(entryId, q);
    setMessages((m) => [
      ...m,
      { role: "assistant", text: r.answer, sources: r.sources, grounded: r.grounded },
    ]);
    setLoading(false);
  };

  return (
    <>
      {/* ── Floating button (closed) ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t(lang, "nav_assistant")}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:bottom-6 sm:right-6"
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t(lang, "nav_assistant")}</span>
        </button>
      )}

      {/* ── Chat panel (open) ── */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex w-[min(92vw,380px)] flex-col rounded-2xl border border-border bg-background shadow-2xl sm:bottom-6 sm:right-6">
          {/* Header */}
          <div className="flex items-center gap-2 rounded-t-2xl bg-primary px-4 py-3 text-primary-foreground">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-sm font-semibold">{t(lang, "nav_assistant")}</span>
            {productName && (
              <span className="max-w-[120px] truncate rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                {productName}
              </span>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded p-0.5 hover:bg-primary-foreground/20"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-4"
            style={{ maxHeight: "min(55vh, 360px)", minHeight: "180px" }}
          >
            {!entryId ? (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                {t(lang, "ask_need_product")}
              </div>
            ) : messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t(lang, "ask_intro")}</p>
                {(["ask_chip_1", "ask_chip_2", "ask_chip_3"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => send(t(lang, key))}
                    className="block w-full rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    {t(lang, key)}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : m.grounded === false
                          ? "border border-amber-200 bg-amber-50 text-amber-900"
                          : "bg-slate-100 text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 space-y-0.5 border-t border-slate-200 pt-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t(lang, "ask_official_sources")}
                        </p>
                        {m.sources.map((s) => (
                          <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            {s.agency}{s.citation ? ` — ${s.citation}` : ""}
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t(lang, "ask_checking")}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          {entryId && (
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex gap-2 border-t border-border p-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t(lang, "asst_placeholder")}
                disabled={loading}
                className="h-8 text-sm"
              />
              <Button type="submit" size="sm" disabled={loading || !input.trim()}>
                {t(lang, "asst_send")}
              </Button>
            </form>
          )}

          {/* Disclaimer */}
          <p className="px-4 pb-3 text-[10px] text-muted-foreground">
            {t(lang, "ask_disclaimer")}
          </p>
        </div>
      )}
    </>
  );
}
