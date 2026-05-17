import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AlertCard } from "@/components/AlertCard";
import { alerts } from "@/lib/mock";
import { useAlertState } from "@/lib/alert-store";

export const Route = createFileRoute("/alerts/")({
  component: AlertsList,
  head: () => ({
    meta: [
      { title: "Alerts — ClearPort" },
      { name: "description", content: "All import-rule updates ClearPort has matched to your monitored products." },
    ],
  }),
});

function AlertsList() {
  const { dismissed } = useAlertState();
  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  return (
    <AppShell
      title="Alerts"
      subtitle="Recent U.S. import-rule updates, explained in plain English"
    >
      <div className="space-y-4">
        {visible.length === 0 ? (
          <div className="rounded-md border border-border bg-white p-8 text-center text-sm text-muted-foreground">
            No alerts right now. ClearPort will notify you when a new update may affect your products.
          </div>
        ) : (
          visible.map((a) => <AlertCard key={a.id} alert={a} />)
        )}
      </div>
    </AppShell>
  );
}
