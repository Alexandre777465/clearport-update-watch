/**
 * Inline structured controls for each conversation step.
 * Renders the appropriate input control based on the step's inputType.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";
import type { ConversationStep, ProductQuestionStep } from "./useConversation";

type AnyStep = ConversationStep | ProductQuestionStep;

// Subset of common ISO 3166-1 alpha-2 → display name pairs most relevant to ClearPort users
const COMMON_COUNTRIES = [
  { code: "China", label: "China" },
  { code: "United States", label: "United States" },
  { code: "Vietnam", label: "Vietnam" },
  { code: "India", label: "India" },
  { code: "Mexico", label: "Mexico" },
  { code: "Bangladesh", label: "Bangladesh" },
  { code: "Indonesia", label: "Indonesia" },
  { code: "Germany", label: "Germany" },
  { code: "Japan", label: "Japan" },
  { code: "South Korea", label: "South Korea" },
  { code: "Taiwan", label: "Taiwan" },
  { code: "Thailand", label: "Thailand" },
  { code: "Canada", label: "Canada" },
  { code: "Turkey", label: "Turkey" },
  { code: "Brazil", label: "Brazil" },
  { code: "Cambodia", label: "Cambodia" },
  { code: "Malaysia", label: "Malaysia" },
  { code: "Pakistan", label: "Pakistan" },
  { code: "Philippines", label: "Philippines" },
  { code: "Italy", label: "Italy" },
];

const TRANSPORT_OPTIONS = [
  { value: "ocean", label: "Ocean / Sea freight", labelZh: "海运" },
  { value: "air",   label: "Air freight",          labelZh: "空运" },
  { value: "truck", label: "Truck / Road",          labelZh: "公路运输" },
  { value: "rail",  label: "Rail",                  labelZh: "铁路运输" },
];

interface Props {
  step: AnyStep;
  onSubmit: (value: string) => void;
  onSkip?: () => void;
}

export function StructuredInput({ step, onSubmit, onSkip }: Props) {
  const lang = useLang();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleTextSubmit = () => {
    if (!step.optional && !value.trim()) {
      setError(lang === "zh" ? "此项为必填项" : "This field is required");
      return;
    }
    setError("");
    onSubmit(value.trim());
    setValue("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleTextSubmit();
  };

  if (step.inputType === "options" && "options" in step && step.options) {
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {step.options.map((opt) => (
          <Button
            key={opt.value}
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            onClick={() => onSubmit(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    );
  }

  if (step.inputType === "country") {
    return (
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex gap-2">
          <Input
            className="flex-1 text-sm"
            placeholder={step.placeholder ?? (lang === "zh" ? "国家名称" : "Country name")}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            onKeyDown={handleKey}
            autoFocus
          />
          <Button size="sm" onClick={handleTextSubmit}>
            {lang === "zh" ? "确认" : "OK"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {COMMON_COUNTRIES.map((c) => (
            <button
              key={c.code}
              className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs hover:bg-muted transition-colors"
              onClick={() => { onSubmit(c.code); setValue(""); }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step.inputType === "transport") {
    return (
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap gap-2">
          {TRANSPORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => onSubmit(opt.value)}
            >
              {lang === "zh" ? opt.labelZh : opt.label}
            </Button>
          ))}
        </div>
        {onSkip && (
          <button
            className="text-xs text-muted-foreground hover:underline self-start"
            onClick={onSkip}
          >
            {lang === "zh" ? "不确定" : "Not sure"}
          </button>
        )}
      </div>
    );
  }

  // text / email / number / optional-text / optional-number
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex gap-2">
        <Input
          className="flex-1 text-sm"
          type={
            step.inputType === "email"
              ? "email"
              : step.inputType === "number" || step.inputType === "optional-number"
              ? "number"
              : "text"
          }
          placeholder={step.placeholder}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={handleKey}
          autoFocus
          min={
            step.inputType === "number" || step.inputType === "optional-number"
              ? "0"
              : undefined
          }
        />
        <Button size="sm" onClick={handleTextSubmit}>
          {lang === "zh" ? "确认" : "OK"}
        </Button>
      </div>
      {step.helpText && (
        <p className="text-xs text-muted-foreground">{step.helpText}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {step.optional && onSkip && (
        <button
          className="text-xs text-muted-foreground hover:underline self-start"
          onClick={onSkip}
        >
          {lang === "zh" ? "跳过" : "Skip"}
        </button>
      )}
    </div>
  );
}
