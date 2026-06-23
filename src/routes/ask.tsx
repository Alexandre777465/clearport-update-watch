import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { alerts, savedProducts, whyYouSeeThis, type Alert } from "@/lib/mock";
import { askClearportFn } from "@/api/ask";

const searchSchema = z.object({
  alertId: z.string().optional(),
  entryId: z.string().optional(),
});

export const Route = createFileRoute("/ask")({
  component: Ask,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Ask ClearPort — fact-based answers from official sources" },
      {
        name: "description",
        content:
          "Ask ClearPort questions about import-rule updates, HTS codes, and broker preparation.",
      },
    ],
  }),
});

const chips = [
  "What changed this week?",
  "Do any updates mention my HTS code?",
  "Which updates affect China-origin goods?",
  "Are there upcoming effective dates?",
  "What should I ask my broker?",
  "Summarize updates for my electronics products.",
];

type Source = { title: string; date: string; url: string };
type Msg = { role: "user" | "assistant"; text: string; sources?: Source[]; isLegal?: boolean };

function alertSrc(a: Alert): Source {
  return { title: a.title, date: a.publicationDate, url: a.sourceUrl };
}

// Local mock answer — used when ANTHROPIC_API_KEY is not configured server-side
function mockAnswer(q: string, contextAlert?: Alert): Msg {
  const lower = q.toLowerCase();
  const tail =
    " Verify the final interpretation with your customs broker — ClearPort does not provide legal advice or guarantees on whether an update applies.";

  if (contextAlert && (lower.includes("why") || lower.includes("this alert"))) {
    return {
      role: "assistant",
      text: `${whyYouSeeThis(contextAlert)} The update is from ${contextAlert.source}, published ${contextAlert.publicationDate}, effective ${contextAlert.effectiveDate}.${tail}`,
      sources: [alertSrc(contextAlert)],
    };
  }
  if (lower.includes("hts")) {
    const userHts = savedProducts.map((p) => p.hts);
    const matches = alerts.filter((a) => a.htsCodes.some((h) => userHts.includes(h)));
    if (!matches.length)
      return {
        role: "assistant",
        text: `No current updates explicitly reference your saved HTS codes (${userHts.join(", ")}).${tail}`,
      };
    return {
      role: "assistant",
      text: `These updates reference one of your saved HTS codes: ${matches.map((m) => `"${m.title}"`).join("; ")}.${tail}`,
      sources: matches.map(alertSrc),
    };
  }
  if (lower.includes("china")) {
    const matches = alerts.filter((a) => a.originCountries.includes("China"));
    return {
      role: "assistant",
      text: `${matches.length} updates may affect China-origin goods. Most recent: "${matches[0].title}" (${matches[0].publicationDate}).${tail}`,
      sources: matches.slice(0, 3).map(alertSrc),
    };
  }
  if (lower.includes("upcoming") || lower.includes("effective")) {
    const today = new Date();
    const upcoming = alerts
      .filter((a) => new Date(a.effectiveDate) >= today)
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    return {
      role: "assistant",
      text: upcoming.length
        ? `Upcoming effective dates: ${upcoming.map((u) => `${u.effectiveDate} — ${u.title}`).join("; ")}.${tail}`
        : `No upcoming effective dates in monitored sources.${tail}`,
      sources: upcoming.slice(0, 3).map(alertSrc),
    };
  }
  if (lower.includes("broker")) {
    const a = contextAlert ?? alerts[0];
    return {
      role: "assistant",
      text: `For "${a.title}", consider asking your broker: ${a.brokerQuestions.slice(0, 3).map((q, i) => `(${i + 1}) ${q}`).join(" ")}${tail}`,
      sources: [alertSrc(a)],
    };
  }
  // default
  return {
    role: "assistant",
    text: `Recent updates: ${alerts.slice(0, 3).map((a) => `"${a.title}" (${a.source}, ${a.publicationDate})`).join("; ")}.${tail}`,
    sources: alerts.slice(0, 3).map(alertSrc),
  };
}

function Ask() {
  const { alertId } = Route.useSearch();
  const contextAlert = alertId ? alerts.find((a) => a.id === alertId) : undefined;

  const [q, setQ] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      role: "assistant",
      text: contextAlert
        ? `Loaded context: "${contextAlert.title}" (${contextAlert.source}, ${contextAlert.publicationDate}). Ask me why you're seeing it, what to verify with your broker, or how it relates to your saved products.`
        : "Hi — I'm Ask ClearPort. I answer from official source summaries and your saved products. I won't provide final legal interpretation. What would you like to know?",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (contextAlert) {
      setMessages([
        {
          role: "assistant",
          text: `Loaded context: "${contextAlert.title}" (${contextAlert.source}, ${contextAlert.publicationDate}). Ask me why you're seeing it, what to verify with your broker, or how it relates to your saved products.`,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId]);

  const ask = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setQ("");
    setIsLoading(true);

    try {
      const result = await askClearportFn({
        data: {
          query: text,
          productHtsCodes: savedProducts.map((p) => p.hts).filter(Boolean),
          productCategories: [...new Set(savedProducts.map((p) => p.category))].filter(Boolean),
          contextAlertTitle: contextAlert?.title,
          contextAlertSource: contextAlert?.source,
        },
      });

      if (result.response) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: result.response!,
            isLegal: result.isLegalDeflection,
            sources: contextAlert && !result.isLegalDeflection ? [alertSrc(contextAlert)] : undefined,
          },
        ]);
      } else {
        // Server fn returned null — ANTHROPIC_API_KEY not set, use local mock
        setMessages((m) => [...m, mockAnswer(text, contextAlert)]);
      }
    } catch {
      setMessages((m) => [...m, mockAnswer(text, contextAlert)]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">ClearPort Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Fact-based answers from official sources and your scanned product.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="flex h-[70vh] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : m.isLegal
                        ? "border border-amber-200 bg-amber-50 text-amber-900"
                        : "bg-slate-100 text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
                      {m.sources.map((s) => (
                        <a
                          key={s.url + s.title}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-2 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            {s.title}{" "}
                            <span className="text-muted-foreground">— {s.date}</span>
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-slate-100 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => ask(c)}
                  disabled={isLoading}
                  className="rounded-full border border-border bg-white px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(q);
              }}
              className="flex gap-2"
            >
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ask about updates, HTS codes, or broker questions…"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Ask
              </Button>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          {contextAlert && (
            <Card className="border-blue-200 bg-blue-50/50 p-5 text-xs">
              <div className="font-medium text-foreground">Loaded alert context</div>
              <Link
                to="/alerts/$id"
                params={{ id: contextAlert.id }}
                className="mt-1 block text-primary hover:underline"
              >
                {contextAlert.title}
              </Link>
              <p className="mt-2 text-muted-foreground">
                {contextAlert.source} · {contextAlert.publicationDate}
              </p>
            </Card>
          )}
          <Card className="p-5">
            <h3 className="text-sm font-semibold">How Ask ClearPort works</h3>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>• Answers from official source summaries, your saved products, and HTS codes</li>
              <li>• Always shows source and date when possible</li>
              <li>• Says "verify with broker" when interpretation is required</li>
              <li>• Never guarantees whether something applies</li>
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Recent sources</h3>
            <div className="mt-3 space-y-2">
              {alerts.slice(0, 3).map((a) => (
                <div key={a.id} className="text-xs">
                  <Badge variant="outline" className="mr-1">
                    {a.source}
                  </Badge>
                  <span className="text-muted-foreground">{a.publicationDate}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
