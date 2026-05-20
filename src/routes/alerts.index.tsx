import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { AlertCard } from "@/components/AlertCard";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAlerts } from "@/lib/api";
import { alerts as mockAlerts } from "@/lib/mock";
import { useAlertState } from "@/lib/alert-store";

export const Route = createFileRoute("/alerts/")({
  component: AlertsList,
  head: () => ({
    meta: [
      { title: "Alerts — ClearPort" },
      {
        name: "description",
        content:
          "All import-rule updates ClearPort has matched to your monitored products.",
      },
    ],
  }),
});

function AlertsList() {
  const { dismissed } = useAlertState();

  const { data: allAlerts = mockAlerts, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    staleTime: 60_000,
    placeholderData: mockAlerts,
  });

  const visible = allAlerts.filter((a) => !dismissed.includes(a.id));

  return (
    <AppShell
      title="Alerts"
      subtitle="Recent U.S. import-rule updates, explained in plain English"
    >
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-md border border-border bg-white p-8 text-center text-sm text-muted-foreground">
          No alerts right now. ClearPort will notify you when a new update may
          affect your products.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
