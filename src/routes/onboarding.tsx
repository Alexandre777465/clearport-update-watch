import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MonitoringFormBlock } from "@/components/MonitoringForm";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Start Monitoring — ClearPort" },
      {
        name: "description",
        content:
          "Enter your product details once. ClearPort monitors official U.S. trade sources and emails you when something relevant changes.",
      },
    ],
  }),
});

function Onboarding() {
  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <MonitoringFormBlock headingAs="h1" />
      </div>
    </div>
  );
}
