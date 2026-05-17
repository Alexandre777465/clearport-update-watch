import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCard } from "@/components/AlertCard";
import { alerts, savedProducts } from "@/lib/mock";
import { useAlertState } from "@/lib/alert-store";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Monitoring Center — ClearPort" },
      { name: "description", content: "ClearPort monitors U.S. import-rule sources and explains relevant updates in plain English." },
    ],
  }),
});

function Dashboard() {
  const { dismissed } = useAlertState();
  const visible = alerts.filter((a) => !dismissed.includes(a.id));

  const savedHts = savedProducts.map((p) => p.hts);
  const savedCats = savedProducts.map((p) => p.category);
  const relevant = visible.filter(
    (a) => a.htsCodes.some((h) => savedHts.includes(h)) || a.categories.some((c) => savedCats.includes(c)),
  );
  const brokerChecks = relevant.length;

  const stats = [
    { label: "New alerts", value: visible.length },
    { label: "Products monitored", value: savedProducts.length },
    { label: "Broker checks needed", value: brokerChecks },
    { label: "Sources last checked", value: "2 hours ago" },
  ];

  return (
    <AppShell
      title="Updates that may affect your products"
      subtitle="ClearPort monitors U.S. import-rule sources and explains relevant updates in plain English."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent alerts</h2>
        <Link to="/alerts"><Button variant="ghost" size="sm">View all</Button></Link>
      </div>

      <div className="mt-3 space-y-4">
        {relevant.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No updates currently match your products. ClearPort will alert you when something relevant appears.
          </Card>
        ) : (
          relevant.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} />)
        )}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        ClearPort provides plain-English monitoring. Verify final interpretation with your customs broker.
      </p>
    </AppShell>
  );
}
