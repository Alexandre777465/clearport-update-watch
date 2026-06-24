import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { MonitoringFormBlock } from "@/components/MonitoringForm";
import { officialSources, alerts, relevanceClass } from "@/lib/mock";
import { useLang, t, SOURCE_TYPE_KEYS, type DictKey } from "@/lib/i18n";
import {
  FileText, Search, Clock, Flag, MessageCircle,
  Languages, Target, BookCheck, ListChecks, Mail, ShieldCheck, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ClearPort — Never miss a customs or tariff update affecting your products" },
      {
        name: "description",
        content:
          "Enter your product details and HTS/HS code once. ClearPort monitors official U.S. trade sources and emails you when something relevant changes.",
      },
    ],
  }),
});

// Icon + dictionary keys only — all copy lives in i18n so it renders per-language.
const problems: Array<{ icon: typeof FileText; t: DictKey; b: DictKey }> = [
  { icon: FileText, t: "prob_1_t", b: "prob_1_b" },
  { icon: Search, t: "prob_2_t", b: "prob_2_b" },
  { icon: Clock, t: "prob_3_t", b: "prob_3_b" },
  { icon: Flag, t: "prob_4_t", b: "prob_4_b" },
  { icon: MessageCircle, t: "prob_5_t", b: "prob_5_b" },
];

const solutions: Array<{ icon: typeof Languages; t: DictKey; b: DictKey }> = [
  { icon: Languages, t: "sol_1_t", b: "sol_1_b" },
  { icon: Target, t: "sol_2_t", b: "sol_2_b" },
  { icon: BookCheck, t: "sol_3_t", b: "sol_3_b" },
  { icon: ListChecks, t: "sol_4_t", b: "sol_4_b" },
  { icon: Mail, t: "sol_5_t", b: "sol_5_b" },
];

const trustBullets: DictKey[] = ["trust_b1", "trust_b2", "trust_b3", "trust_b4", "trust_b5"];

// Localized broker questions for the hero sample-alert card.
const sampleQuestions: DictKey[] = ["sample_q1", "sample_q2", "sample_q3"];

function Index() {
  const lang = useLang();
  const formRef = useRef<HTMLElement>(null);
  const featured = alerts[0];

  const scrollToForm = (e: React.MouseEvent) => {
    e.preventDefault();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-blue-50/60 to-background">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="outline" className="mb-5 border-blue-200 bg-blue-50 text-blue-800">
                {t(lang, "home_badge")}
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t(lang, "home_headline")}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                {t(lang, "home_desc")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" onClick={scrollToForm}>
                  {t(lang, "home_cta_start")}
                </Button>
                <Link to="/sample-alert">
                  <Button size="lg" variant="outline">
                    {t(lang, "home_cta_sample")}
                  </Button>
                </Link>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                {t(lang, "home_built_for")}
              </p>
              <p className="mt-4 max-w-xl rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {t(lang, "home_hero_disclaimer")}
              </p>
            </div>

            {/* Hero — latest alert preview */}
            <Card className="overflow-hidden border-border p-0 shadow-xl">
              <div className="flex items-center justify-between border-b border-border bg-slate-50 px-4 py-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t(lang, "home_latest_alert")}</span>
                <span>{featured.publicationDate}</span>
              </div>
              <div className="p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className={relevanceClass(featured.relevance)}>
                    {t(lang, "sample_relevance_direct")}
                  </Badge>
                  <Badge variant="outline">{t(lang, "badge_china_usa")}</Badge>
                  <Badge variant="outline">{t(lang, "badge_effective")} {featured.effectiveDate}</Badge>
                </div>
                <h3 className="text-base font-semibold leading-snug">{t(lang, "sample_title")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(lang, "sample_summary")}</p>
                <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-muted-foreground">
                  <div className="mb-1 font-medium text-foreground">
                    {t(lang, "home_verify_broker")}
                  </div>
                  <ul className="list-disc pl-4">
                    {sampleQuestions.map((q) => (
                      <li key={q}>{t(lang, q)}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t(lang, "home_source_label")} {featured.source}
                  </span>
                  <Link
                    to="/alerts/$id"
                    params={{ id: featured.id }}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {t(lang, "home_open_alert")} <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── MONITORING FORM ───────────────────────────────────────────────── */}
      <section
        ref={formRef}
        id="monitor"
        className="border-b border-border bg-white py-16"
      >
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <MonitoringFormBlock headingAs="h2" />
        </div>
      </section>

      {/* ── PROBLEM ───────────────────────────────────────────────────────── */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {t(lang, "prob_heading")}
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map(({ icon: Icon, t: title, b: body }) => (
              <Card key={title} className="p-6">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 font-semibold">{t(lang, title)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(lang, body)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUTION ──────────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {t(lang, "sol_heading")}
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map(({ icon: Icon, t: title, b: body }) => (
              <Card key={title} className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{t(lang, title)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(lang, body)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOURCES ───────────────────────────────────────────────────────── */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">{t(lang, "src_eyebrow")}</span>
          </div>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {t(lang, "src_sec_heading")}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {t(lang, "src_sec_sub")}
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {officialSources.map((s) => (
              <Card key={s.name} className="p-5">
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {SOURCE_TYPE_KEYS[s.name] ? t(lang, SOURCE_TYPE_KEYS[s.name]) : s.type}
                  </p>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {t(lang, "visit_official_source")} <ExternalLink className="h-3 w-3" />
                </a>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t(lang, "trust_heading")}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {t(lang, "trust_body")}
          </p>
          <ul className="mx-auto mt-8 grid max-w-2xl gap-2 text-left text-sm text-muted-foreground sm:grid-cols-2">
            {trustBullets.map((b) => (
              <li key={b} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> {t(lang, b)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t(lang, "cta_heading")}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {t(lang, "cta_body")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={scrollToForm}>
              {t(lang, "home_cta_start")}
            </Button>
            <Link to="/pricing">
              <Button size="lg" variant="outline">
                {t(lang, "see_pricing")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
