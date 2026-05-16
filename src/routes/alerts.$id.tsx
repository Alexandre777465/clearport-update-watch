import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { alerts, relevanceClass, savedProducts } from "@/lib/mock";
import { Download, ExternalLink, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/alerts/$id")({
  component: AlertDetail,
  loader: ({ params }) => {
    const alert = alerts.find((a) => a.id === params.id);
    if (!alert) throw notFound();
    return { alert };
  },
});

function AlertDetail() {
  const { alert } = Route.useLoaderData();
  const related = savedProducts.filter((p) => alert.htsCodes.includes(p.hts) || alert.categories.includes(p.category));

  return (
    <AppShell title="Alert detail" subtitle="Source-backed summary — verify with your customs broker">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={relevanceClass(alert.relevance)}>{alert.relevance}</Badge>
              <Badge variant="outline">{alert.source}</Badge>
              <Badge variant="outline">Published {alert.publicationDate}</Badge>
              <Badge variant="outline">Effective {alert.effectiveDate}</Badge>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">{alert.title}</h1>
            <p className="mt-4 text-muted-foreground">{alert.summary}</p>

            <div className="mt-6 rounded-md border border-border bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why this update matters</div>
              <p className="mt-2 text-sm">{alert.whyMatters}</p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Affected origin</div>
                <div className="mt-1">{alert.originCountries.join(", ")}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Destination</div>
                <div className="mt-1">{alert.destinationCountry}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Affected categories</div>
                <div className="mt-1">{alert.categories.join(", ")}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Affected HS/HTS codes</div>
                <div className="mt-1">{alert.htsCodes.length ? alert.htsCodes.join(", ") : "Not specified"}</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Why this may be relevant to you</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Based on your saved products and HTS codes, this update has a <span className="font-medium text-foreground">{alert.relevance.toLowerCase()}</span> to your import activity. Final interpretation should be verified with your customs broker.
            </p>
            {related.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Related saved products</div>
                {related.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border border-border bg-white p-3 text-sm">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">HTS {p.hts} · {p.origin} → {p.destination}</div>
                    </div>
                    <Badge variant="outline">{p.channel}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Broker verification checklist</h2>
            <p className="mt-1 text-sm text-muted-foreground">Questions to verify before your next shipment.</p>
            <ol className="mt-4 space-y-2 text-sm">
              {alert.brokerQuestions.map((q, i) => (
                <li key={q} className="flex gap-3 rounded-md border border-border p-3">
                  <span className="font-medium text-primary">{i + 1}.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex gap-2">
              <Button><Download className="mr-2 h-4 w-4" /> Export broker summary</Button>
              <Button variant="outline">Mark as verified</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold">Official source</h3>
            <p className="mt-2 text-sm text-muted-foreground">{alert.source}</p>
            <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              View official source <ExternalLink className="h-3 w-3" />
            </a>
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-muted-foreground">
              <div className="mb-1 font-medium text-foreground">Source excerpt</div>
              <p className="italic">"{alert.sourceExcerpt}"</p>
            </div>
          </Card>

          <Card className="border-amber-200 bg-amber-50 p-5 text-xs text-amber-900">
            <p>
              ClearPort summaries describe what an update <strong>may</strong> mean. Final classification and applicability should be confirmed with a licensed customs broker.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}