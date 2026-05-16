import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { sources, alerts, relevanceClass } from "@/lib/mock";
import {
  FileText, Search, Clock, Flag, MessageCircle,
  Languages, Target, BookCheck, ListChecks, Mail, ShieldCheck, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ClearPort — U.S. import rule updates, simplified for importers" },
      { name: "description", content: "ClearPort monitors customs, tariff, and import updates and turns them into plain-English alerts for importers buying from China." },
    ],
  }),
});

const problems = [
  { icon: FileText, title: "Long government documents", body: "Important updates are often hidden inside technical customs notices and tariff publications." },
  { icon: Search, title: "Hard to know what applies", body: "Importers struggle to know if a change affects their product, HTS code, or shipment route." },
  { icon: Clock, title: "Late surprises", body: "Many importers only hear about requirements when their broker raises questions close to shipment." },
  { icon: Flag, title: "China-origin updates matter", body: "Tariff actions, exclusions, and product-specific rules can affect China-origin goods." },
  { icon: MessageCircle, title: "Broker dependency", body: "Brokers are important, but importers still need to understand what to ask and what to monitor." },
];

const solutions = [
  { icon: Languages, title: "Plain-English summaries", body: "Long customs and tariff updates summarized into importer-friendly language." },
  { icon: Target, title: "Product-specific monitoring", body: "Track updates by product category, HS/HTS code, origin country, and destination country." },
  { icon: BookCheck, title: "Source-backed alerts", body: "Every alert includes the source, publication date, effective date, and official reference." },
  { icon: ListChecks, title: "Broker-ready questions", body: "Generate clear questions to verify with your customs broker before shipment." },
  { icon: Mail, title: "Weekly or instant updates", body: "Choose instant alerts, daily digest, or weekly digest." },
];

function Index() {
  const featured = alerts[0];
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-blue-50/60 to-background">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="outline" className="mb-5 border-blue-200 bg-blue-50 text-blue-800">
                For importers buying from China
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                U.S. import rules change. ClearPort tells you what matters.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                ClearPort monitors customs, tariff, and import updates, then turns them into simple alerts for importers buying from China — by product category, origin country, destination country, and HTS code.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/onboarding"><Button size="lg">Start Monitoring</Button></Link>
                <Link to="/sample-alert"><Button size="lg" variant="outline">See Sample Alert</Button></Link>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Built for Amazon sellers, e-commerce brands, sourcing agents, and importers buying from China.
              </p>
              <p className="mt-4 max-w-xl rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                ClearPort provides source-backed summaries for preparation. Final interpretation should be confirmed with your customs broker.
              </p>
            </div>

            {/* Hero alert preview */}
            <Card className="overflow-hidden border-border p-0 shadow-xl">
              <div className="flex items-center justify-between border-b border-border bg-slate-50 px-4 py-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Latest alert</span>
                <span>{featured.publicationDate}</span>
              </div>
              <div className="p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className={relevanceClass(featured.relevance)}>{featured.relevance}</Badge>
                  <Badge variant="outline">China → USA</Badge>
                  <Badge variant="outline">Effective {featured.effectiveDate}</Badge>
                </div>
                <h3 className="text-base font-semibold leading-snug">{featured.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{featured.summary}</p>
                <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-muted-foreground">
                  <div className="mb-1 font-medium text-foreground">What to verify with broker</div>
                  <ul className="list-disc pl-4">
                    {featured.brokerQuestions.slice(0, 3).map((q) => <li key={q}>{q}</li>)}
                  </ul>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Source: {featured.source}</span>
                  <Link to="/alerts/$id" params={{ id: featured.id }} className="inline-flex items-center gap-1 text-primary hover:underline">
                    Open alert <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Importers are buried in technical notices.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="p-6">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="border-b border-border bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            ClearPort turns import rule changes into simple alerts.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SOURCES */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Trust & sourcing</span>
          </div>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Built around official trade sources.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every alert is matched back to its official publication so you can verify the source yourself.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((s) => (
              <Card key={s.name} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.type}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{s.frequency}</Badge>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  Last checked: {s.lastChecked}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="border-b border-border bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for preparation, not legal interpretation.
          </h2>
          <p className="mt-4 text-muted-foreground">
            ClearPort helps importers monitor official import-rule updates and prepare better questions for their customs broker. It does not replace a licensed customs broker, legal advisor, or customs authority.
          </p>
          <ul className="mx-auto mt-8 grid max-w-2xl gap-2 text-left text-sm text-muted-foreground sm:grid-cols-2">
            {["Source-backed summaries", "Last-checked dates", "Official references", "Broker verification prompts", "Cautious relevance matching"].map((b) => (
              <li key={b} className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {b}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Don't read 50-page notices manually.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start monitoring U.S. import updates for your products in under 2 minutes.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/onboarding"><Button size="lg">Start Monitoring</Button></Link>
            <Link to="/pricing"><Button size="lg" variant="outline">See pricing</Button></Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
