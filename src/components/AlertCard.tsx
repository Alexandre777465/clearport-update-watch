import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Bookmark, BookmarkCheck, X, Download, ExternalLink, AlertTriangle, MessageSquare, Info } from "lucide-react";
import { type Alert, relevanceClass, whyYouSeeThis, buildBrokerSummary } from "@/lib/mock";
import { useAlertState, toggleSaved, dismissAlert, restoreAlert } from "@/lib/alert-store";

export function AlertCard({ alert, showRestore = false }: { alert: Alert; showRestore?: boolean }) {
  const { saved, dismissed } = useAlertState();
  const isSaved = saved.includes(alert.id);
  const isDismissed = dismissed.includes(alert.id);
  const [exportOpen, setExportOpen] = useState(false);

  const exportSummary = () => {
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
    <Card className={`p-5 ${isDismissed ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={relevanceClass(alert.relevance)}>{alert.relevance}</Badge>
            <Badge variant="outline">{alert.source}</Badge>
            <Badge variant="outline">Effective {alert.effectiveDate}</Badge>
            {alert.originCountries.includes("China") && (
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">China-origin</Badge>
            )}
            {isSaved && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Saved</Badge>}
          </div>
          <Link to="/alerts/$id" params={{ id: alert.id }} className="mt-3 block">
            <h3 className="text-base font-semibold leading-snug hover:underline">{alert.title}</h3>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">{alert.summary}</p>

          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div><span className="font-medium text-foreground">Origin → Dest:</span> {alert.originCountries.join("/")} → {alert.destinationCountry}</div>
            <div><span className="font-medium text-foreground">Categories:</span> {alert.categories.join(", ")}</div>
            <div><span className="font-medium text-foreground">HTS:</span> {alert.htsCodes.length ? alert.htsCodes.join(", ") : "—"}</div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md bg-slate-50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span><span className="font-medium text-foreground">Why you are seeing this:</span> {whyYouSeeThis(alert)}</span>
          </div>

          {alert.relevance !== "Possible match" && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span><span className="font-medium">Verify with broker:</span> {alert.brokerQuestions[0]}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <Link to="/alerts/$id" params={{ id: alert.id }}>
            <Button variant="outline" size="sm" className="w-full">View details</Button>
          </Link>
          <Button variant={isSaved ? "default" : "outline"} size="sm" onClick={() => toggleSaved(alert.id)}>
            {isSaved ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
            {isSaved ? "Saved" : "Save"}
          </Button>
          {showRestore || isDismissed ? (
            <Button variant="ghost" size="sm" onClick={() => restoreAlert(alert.id)}>Restore</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => dismissAlert(alert.id)}>
              <X className="mr-2 h-4 w-4" /> Dismiss
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Export broker questions
          </Button>
          <Link to="/ask" search={{ alertId: alert.id }}>
            <Button variant="ghost" size="sm" className="w-full"><MessageSquare className="mr-2 h-4 w-4" /> Ask ClearPort</Button>
          </Link>
          <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-primary hover:underline">
            Source <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </div>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Broker-ready summary</DialogTitle>
            <DialogDescription>
              Preview the broker summary for this alert. Download a plain-text copy to share with your customs broker.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[50vh] overflow-auto rounded-md border border-border bg-slate-50 p-4 text-xs whitespace-pre-wrap">
            {buildBrokerSummary(alert)}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Close</Button>
            <Button onClick={() => { exportSummary(); setExportOpen(false); }}>
              <Download className="mr-2 h-4 w-4" /> Download .txt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
