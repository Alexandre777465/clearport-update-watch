import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { alerts, relevanceClass } from "@/lib/mock";
import { Bookmark, X, Download, ExternalLink, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

const stats = [
  { label: "Relevant updates this week", value: 5, hint: "Across your products" },
  { label: "Affecting China-origin goods", value: 4, hint: "Last 7 days" },
  { label: "Upcoming effective dates", value: 3, hint: "In next 30 days" },
  { label: "Saved HTS codes monitored", value: 12, hint: "Across 3 products" },
  { label: "Alerts needing broker verification", value: 2, hint: "Action recommended" },
];

function Dashboard() {
  return (
    <AppShell title="Dashboard" subtitle="Source-backed import rule alerts for your products">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Alert feed</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">All sources</Button>
          <Button variant="outline" size="sm">China-origin only</Button>
          <Button variant="outline" size="sm">Direct HTS matches</Button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {alerts.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={relevanceClass(a.relevance)}>{a.relevance}</Badge>
                  <Badge variant="outline">{a.source}</Badge>
                  <Badge variant="outline">Effective {a.effectiveDate}</Badge>
                  {a.originCountries.includes("China") && (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">China-origin</Badge>
                  )}
                </div>
                <Link to="/alerts/$id" params={{ id: a.id }} className="mt-3 block">
                  <h3 className="text-base font-semibold leading-snug hover:underline">{a.title}</h3>
                </Link>
                <p className="mt-2 text-sm text-muted-foreground">{a.summary}</p>

                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <div><span className="font-medium text-foreground">Categories:</span> {a.categories.join(", ")}</div>
                  <div><span className="font-medium text-foreground">HTS:</span> {a.htsCodes.length ? a.htsCodes.join(", ") : "—"}</div>
                  <div><span className="font-medium text-foreground">Published:</span> {a.publicationDate}</div>
                </div>

                {a.relevance !== "Possible match" && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><span className="font-medium">Verify with broker:</span> {a.brokerQuestions[0]}</span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-2">
                <Button variant="outline" size="sm"><Bookmark className="mr-2 h-4 w-4" /> Save</Button>
                <Button variant="ghost" size="sm"><X className="mr-2 h-4 w-4" /> Dismiss</Button>
                <Button variant="ghost" size="sm"><Download className="mr-2 h-4 w-4" /> Export</Button>
                <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-primary hover:underline">
                  Source <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}