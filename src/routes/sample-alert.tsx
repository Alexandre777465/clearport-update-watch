import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { useLang, t, type DictKey } from "@/lib/i18n";

export const Route = createFileRoute("/sample-alert")({ component: Sample });

const sampleQuestions: DictKey[] = [
  "sample_q1",
  "sample_q2",
  "sample_q3",
  "sample_q4",
  "sample_q5",
];

function Sample() {
  const lang = useLang();
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Badge variant="outline" className="mb-4">{t(lang, "sa_badge")}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t(lang, "sample_title")}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">{t(lang, "sample_relevance_direct")}</Badge>
          <Badge variant="outline">USTR / Federal Register</Badge>
          <Badge variant="outline">{t(lang, "sa_origin")}</Badge>
          <Badge variant="outline">{t(lang, "sa_destination")}</Badge>
          <Badge variant="outline">{t(lang, "badge_effective")} 2026-06-01</Badge>
        </div>

        <Card className="mt-8 p-6">
          <h2 className="text-lg font-semibold">{t(lang, "sa_plain_summary")}</h2>
          <p className="mt-2 text-muted-foreground">
            {t(lang, "sample_summary")}
          </p>
        </Card>

        <Card className="mt-4 p-6">
          <h2 className="text-lg font-semibold">{t(lang, "sample_why")}</h2>
          <p className="mt-2 text-muted-foreground">
            {t(lang, "sample_why_body")}
          </p>
        </Card>

        <Card className="mt-4 p-6">
          <h2 className="text-lg font-semibold">{t(lang, "home_verify_broker")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {sampleQuestions.map((q, i) => (
              <li key={q} className="flex gap-3 rounded-md border border-border p-3">
                <span className="font-medium text-primary">{i + 1}.</span>
                <span>{t(lang, q)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-2">
            <Button><Download className="mr-2 h-4 w-4" /> {t(lang, "sa_export")}</Button>
            <a href="https://ustr.gov/" target="_blank" rel="noreferrer">
              <Button variant="outline">{t(lang, "visit_official_source")} <ExternalLink className="ml-2 h-3 w-3" /></Button>
            </a>
          </div>
        </Card>

        <Card className="mt-8 border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {t(lang, "sa_disclaimer")}
        </Card>

        <div className="mt-10 text-center">
          <Link to="/onboarding"><Button size="lg">{t(lang, "sa_start")}</Button></Link>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
