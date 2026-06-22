/**
 * Human review upsell CTAs.
 * Non-functional for now — DB table exists (human_review_requests) and is
 * ready to be activated when payment flow is wired up.
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, FileCheck } from "lucide-react";

const REVIEWS = [
  {
    icon: MessageSquare,
    title: "Prepare broker questions",
    price: "$29",
    description:
      "A trade compliance specialist reviews your product and prepares a custom question list for your customs broker.",
    badge: "Popular",
    reviewType: "broker_questions",
  },
  {
    icon: Users,
    title: "Product import review",
    price: "$49",
    description:
      "Human review of your product's HTS classification, tariff exposure, Section 301 status, and documentation requirements.",
    badge: null,
    reviewType: "product_review",
  },
  {
    icon: FileCheck,
    title: "Full import readiness review",
    price: "$99",
    description:
      "Complete pre-import assessment: classification, compliance, documentation checklist, supplier questions, and broker brief.",
    badge: "Most complete",
    reviewType: "full_review",
  },
];

export function HumanReviewCta(_props: { productName: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Want a human expert to verify this assessment? Paid expert reviews are
        launching soon.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {REVIEWS.map(({ icon: Icon, title, price, description, reviewType }) => (
          <Card key={reviewType} className="p-4 opacity-75">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <Badge variant="outline" className="text-xs">
                Coming soon
              </Badge>
            </div>
            <p className="mt-3 font-semibold text-sm">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              disabled
            >
              {price} — Coming soon
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
