import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { fetchScanContext, askProduct, type AssistantSource } from "@/lib/api";
import { useLang, t, type DictKey } from "@/lib/i18n";

const searchSchema = z.object({
  alertId: z.string().optional(),
  entryId: z.string().optional(),
});

export const Route = createFileRoute("/ask")({
  component: Ask,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "ClearPort Assistant — answers grounded in official sources" },
      {
        name: "description",
        content:
          "Ask ClearPort about your product's duties, classification, tests, certificates, and documents — answered only from verified findings and official sources.",
      },
    ],
  }),
});

const CHIP_KEYS: DictKey[] = [
  "ask_chip_1",
  "ask_chip_2",
  "ask_chip_3",
  "ask_chip_4",
  "ask_chip_5",
];

type Msg = { role: "user" | "assistant"; text: string; sources?: AssistantSource[]; grounded?: boolean };

function Ask() {
  const lang = useLang();
  const { entryId } = Route.useSearch();
  const [product, setProduct] = useState<{ product_name: string; hts_code: string | null } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (entryId) fetchScanContext(entryId).then((p) => p && setProduct(p));
  }, [entryId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  const send = async (q: string) => {
    if (!q.trim() || loading) return;
    if (!entryId) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    const r = await askProduct(entryId, q);
    setMessages((m) => [...m, { role: "assistant", text: r.answer, sources: r.sources, grounded: r.grounded }]);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">{t(lang, "asst_title")}</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          {t(lang, "ask_intro")}
        </p>

        {!entryId ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t(lang, "ask_need_product")}
            </p>
            <Link to="/onboarding" className="mt-4 inline-block">
              <Button>{t(lang, "nav_check")}</Button>
            </Link>
          </Card>
        ) : (
          <>
            {product && (
              <Card className="mb-4 border-primary/20 bg-primary/5 p-3 text-sm">
                <span className="font-medium">{product.product_name}</span>
                {product.hts_code && (
                  <span className="text-muted-foreground"> · HTS {product.hts_code}</span>
                )}
              </Card>
            )}

            <Card className="flex h-[60vh] flex-col p-0">
              <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-2">
                    {CHIP_KEYS.map((key) => {
                      const label = t(lang, key);
                      return (
                        <button
                          key={key}
                          onClick={() => send(label)}
                          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-lg px-4 py-3 text-sm ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : m.grounded === false
                            ? "border border-amber-200 bg-amber-50 text-amber-900"
                            : "bg-slate-100 text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-line">{m.text}</p>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-3 space-y-1 border-t border-slate-200 pt-2">
                          <p className="text-xs font-medium">{t(lang, "ask_official_sources")}</p>
                          {m.sources.map((s) => (
                            <a
                              key={s.url}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              {s.agency}
                              {s.citation ? ` — ${s.citation}` : ""}: {s.title.slice(0, 60)}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t(lang, "ask_checking")}
                    </div>
                  </div>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex gap-2 border-t border-border p-3"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t(lang, "asst_placeholder")}
                  disabled={loading}
                />
                <Button type="submit" disabled={loading || !input.trim()}>{t(lang, "asst_send")}</Button>
              </form>
            </Card>
          </>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3 w-3" />
          {t(lang, "ask_disclaimer")}
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
