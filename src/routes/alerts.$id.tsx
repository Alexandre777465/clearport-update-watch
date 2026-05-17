import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { alerts, relevanceClass, savedProducts, whyYouSeeThis, buildBrokerSummary, type Alert } from "@/lib/mock";
import { toggleSaved, dismissAlert, useAlertState } from "@/lib/alert-store";
import { toast } from "sonner";
import { Download, ExternalLink, ArrowLeft, Bookmark, BookmarkCheck, X, MessageSquare, Info } from "lucide-react";

export const Route = createFileRoute("/alerts/$id")({
  component: AlertDetail,
  loader: ({ params }) => {
    const alert = alerts.find((a) => a.id === params.id);
    if (!alert) throw notFound();
    return { alert };
  },
});

function AlertDetail() {
  const { alert } = Route.useLoaderData() as { alert: Alert };
  const related = savedProducts.filter((p) => alert.htsCodes.includes(p.hts) || alert.categories.includes(p.category));
  const { saved } = useAlertState();
  const isSaved = saved.includes(alert.id);
  const [exportOpen, setExportOpen] = useState(false);

  const download = () => {
    const text = buildBrokerSummary(alert);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clearport-broker-summary-${alert.id}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell title="Alert detail" subtitle="Source-backed summary — verify with your customs broker">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Monitoring Center
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

            <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50/60 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span><span className="font-medium">Why you are seeing this:</span> {whyYouSeeThis(alert)}</span>
            </div>

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
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => setExportOpen(true)}><Download className="mr-2 h-4 w-4" /> Export broker summary</Button>
              <Link to="/ask" search={{ alertId: alert.id }}>
                <Button variant="outline"><MessageSquare className="mr-2 h-4 w-4" /> Ask ClearPort</Button>
              </Link>
              <Button variant="outline" onClick={() => toast.success("Marked as verified.")}>Mark as verified</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold">Actions</h3>
            <div className="mt-3 flex flex-col gap-2">
              <Button variant={isSaved ? "default" : "outline"} size="sm" onClick={() => toggleSaved(alert.id)}>
                {isSaved ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
                {isSaved ? "Saved" : "Save alert"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { dismissAlert(alert.id); toast.success("Dismissed from feed."); }}>
                <X className="mr-2 h-4 w-4" /> Dismiss
              </Button>
            </div>
          </Card>

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

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Broker-ready summary</DialogTitle>
            <DialogDescription>Preview the broker summary, then download a plain-text copy for your customs broker.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[50vh] overflow-auto rounded-md border border-border bg-slate-50 p-4 text-xs whitespace-pre-wrap">{buildBrokerSummary(alert)}</pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Close</Button>
            <Button onClick={() => { download(); setExportOpen(false); }}>
              <Download className="mr-2 h-4 w-4" /> Download .txt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}