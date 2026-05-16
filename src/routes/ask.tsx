import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ExternalLink } from "lucide-react";
import { alerts } from "@/lib/mock";

export const Route = createFileRoute("/ask")({ component: Ask });

const chips = [
  "Show updates for my products",
  "Show China-origin updates",
  "Show upcoming effective dates",
  "What should I ask my broker?",
  "Summarize latest USTR updates",
  "Any updates for my HTS codes?",
];

type Msg = { role: "user" | "assistant"; text: string; sources?: { title: string; date: string; url: string }[] };

function Ask() {
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi — I'm Ask ClearPort. I answer only from official source summaries and your saved products. I won't provide final legal interpretation. What would you like to know?",
    },
  ]);

  const ask = (text: string) => {
    if (!text.trim()) return;
    const reply: Msg = {
      role: "assistant",
      text: `Based on saved sources, here are updates that may be relevant: a USTR Section 301 exclusion change and a CBP CSMS textile labeling reminder both affect China-origin goods this week. This may be relevant and should be verified with your customs broker.`,
      sources: alerts.slice(0, 2).map((a) => ({ title: a.title, date: a.publicationDate, url: a.sourceUrl })),
    };
    setMessages((m) => [...m, { role: "user", text }, reply]);
    setQ("");
  };

  return (
    <AppShell title="Ask ClearPort" subtitle="Fact-based answers from official sources and your saved products">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="flex h-[70vh] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-slate-100 text-foreground"
                  }`}
                >
                  <p>{m.text}</p>
                  {m.sources && (
                    <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
                      {m.sources.map((s) => (
                        <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-xs text-primary hover:underline">
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{s.title} <span className="text-muted-foreground">— {s.date}</span></span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c} onClick={() => ask(c)} className="rounded-full border border-border bg-white px-3 py-1 text-xs hover:bg-slate-50">
                  {c}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about updates, HTS codes, or broker questions…" />
              <Button type="submit"><Sparkles className="mr-2 h-4 w-4" /> Ask</Button>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">How Ask ClearPort works</h3>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>• Answers from saved source summaries and your settings</li>
              <li>• Always shows source and date when possible</li>
              <li>• Says "verify with broker" when uncertain</li>
              <li>• Does not provide final legal interpretation</li>
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Recent sources</h3>
            <div className="mt-3 space-y-2">
              {alerts.slice(0, 3).map((a) => (
                <div key={a.id} className="text-xs">
                  <Badge variant="outline" className="mr-1">{a.source}</Badge>
                  <span className="text-muted-foreground">{a.publicationDate}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}