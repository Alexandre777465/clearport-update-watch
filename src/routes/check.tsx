/**
 * /check — Conversational import compliance intake.
 *
 * Mounts ChatShell to collect product details via a chat UX,
 * then submits to the existing ClearPort pipeline via intakeToPayload()
 * and renders ImportReport when the scan is ready.
 *
 * This route is completely isolated from /, /onboarding, and the
 * existing MonitoringForm flow.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { ChatShell } from "@/components/ConversationalIntake/ChatShell";
import { intakeToPayload, type ConversationState } from "@/components/ConversationalIntake/intakeToPayload";
import { ReportShell } from "@/components/ImportReport/ReportShell";
import { submitWatchlistEntry, pollScanResult } from "@/lib/api";
import type { ProductRiskScan } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/check")({
  component: CheckPage,
});

type Phase =
  | { kind: "intake" }
  | { kind: "loading"; label: string }
  | { kind: "report"; scan: ProductRiskScan; state: ConversationState }
  | { kind: "error"; message: string };

function CheckPage() {
  const lang = useLang();
  const [phase, setPhase] = useState<Phase>({ kind: "intake" });

  const handleComplete = useCallback(
    async (state: ConversationState) => {
      setPhase({ kind: "loading", label: lang === "zh" ? "正在保存…" : "Saving…" });

      try {
        const payload = intakeToPayload(state);
        const result = await submitWatchlistEntry(payload);

        let scan: ProductRiskScan;

        if (result.scan_status === "local") {
          // No backend — no mock scan available in this route; show error
          setPhase({
            kind: "error",
            message:
              lang === "zh"
                ? "未连接后端，无法生成报告。"
                : "No backend connected — cannot generate report.",
          });
          return;
        }

        setPhase({ kind: "loading", label: lang === "zh" ? "正在分析…" : "Analyzing…" });

        const polled = await pollScanResult(result.id);
        if (polled.status === "ready" && polled.scan) {
          scan = polled.scan;
        } else {
          setPhase({
            kind: "error",
            message:
              polled.status === "failed"
                ? lang === "zh"
                  ? "扫描失败，请重试。"
                  : "Scan failed. Please try again."
                : lang === "zh"
                ? "扫描超时，请重试。"
                : "Scan timed out. Please try again.",
          });
          return;
        }

        setPhase({ kind: "report", scan, state });
      } catch (err) {
        setPhase({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : lang === "zh"
              ? "发生错误，请重试。"
              : "An error occurred. Please try again.",
        });
      }
    },
    [lang],
  );

  const handleStartOver = useCallback(() => {
    setPhase({ kind: "intake" });
  }, []);

  if (phase.kind === "intake") {
    return (
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-2xl flex-col">
        <ChatShell onComplete={handleComplete} />
      </div>
    );
  }

  if (phase.kind === "loading") {
    return (
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center">
        <p className="animate-pulse text-sm text-muted-foreground">{phase.label}</p>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 pt-20">
        <p className="text-sm text-destructive">{phase.message}</p>
        <button
          className="text-sm text-primary hover:underline"
          onClick={handleStartOver}
        >
          {lang === "zh" ? "重试" : "Try again"}
        </button>
      </div>
    );
  }

  // phase.kind === "report"
  const { scan, state } = phase;
  const numericValue =
    state.estimatedValue
      ? parseFloat(state.estimatedValue.replace(/[,$\s]/g, ""))
      : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ReportShell
        scan={scan}
        productName={state.productName}
        originCountry={state.originCountry || "China"}
        destinationCountry={state.destination || "United States"}
        customsValueUsd={isFinite(numericValue ?? NaN) ? numericValue : undefined}
        transportMode={state.transportMode || undefined}
        onStartOver={handleStartOver}
      />
    </div>
  );
}
