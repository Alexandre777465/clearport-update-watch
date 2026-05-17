import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, MessageSquare, Info, HelpCircle, Package } from "lucide-react";
import { type Alert, whyYouSeeThis, savedProducts } from "@/lib/mock";
import { useAlertState, toggleSaved } from "@/lib/alert-store";

function affectedProducts(alert: Alert) {
  return savedProducts.filter(
    (p) => alert.htsCodes.includes(p.hts) || alert.categories.includes(p.category),
  );
}

export function AlertCard({ alert }: { alert: Alert }) {
  const { saved } = useAlertState();
  const isSaved = saved.includes(alert.id);
  const affected = affectedProducts(alert);
  const brokerQs = alert.brokerQuestions.slice(0, 3);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Effective {alert.effectiveDate}</Badge>
        {alert.originCountries.includes("China") && (
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">China → USA</Badge>
        )}
        {isSaved && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Saved</Badge>}
      </div>

      <Link to="/alerts/$id" params={{ id: alert.id }} className="mt-3 block">
        <h3 className="text-base font-semibold leading-snug hover:underline">{alert.title}</h3>
      </Link>
      <p className="mt-2 text-sm text-muted-foreground">{alert.summary}</p>

      <div className="mt-3 flex items-start gap-2 rounded-md bg-slate-50 p-3 text-xs">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span><span className="font-medium">Why you are seeing this:</span> {whyYouSeeThis(alert)}</span>
      </div>

      {affected.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Package className="h-3.5 w-3.5 text-primary" /> Products that may be affected
          </div>
          <ul className="space-y-0.5 pl-5 text-sm text-muted-foreground list-disc">
            {affected.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
          <HelpCircle className="h-3.5 w-3.5 text-primary" /> What to ask your broker
        </div>
        <ul className="space-y-0.5 pl-5 text-sm text-muted-foreground list-disc">
          {brokerQs.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/alerts/$id" params={{ id: alert.id }}>
          <Button variant="outline" size="sm">View details</Button>
        </Link>
        <Link to="/ask" search={{ alertId: alert.id }}>
          <Button variant="ghost" size="sm"><MessageSquare className="mr-2 h-4 w-4" /> Ask ClearPort</Button>
        </Link>
        <Button variant={isSaved ? "default" : "ghost"} size="sm" onClick={() => toggleSaved(alert.id)}>
          {isSaved ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
          {isSaved ? "Saved" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
