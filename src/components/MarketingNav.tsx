import { Link } from "@tanstack/react-router";
import { Ship } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Ship className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ClearPort</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link to="/ask" className="hover:text-foreground">ClearPort Assistant</Link>
          <Link to="/sources" className="hover:text-foreground">Official sources</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/onboarding">
            <Button size="sm">Check a product</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Ship className="h-4 w-4" />
            </div>
            <span className="font-semibold">ClearPort</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            U.S. import rule updates, simplified for importers.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-2 font-medium">Product</div>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link to="/onboarding">Check a product</Link></li>
            <li><Link to="/ask">ClearPort Assistant</Link></li>
            <li><Link to="/sources">Official sources</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-2 font-medium">Legal</div>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/terms">Terms &amp; disclaimer</Link></li>
          </ul>
        </div>
        <div className="text-xs text-muted-foreground">
          ClearPort provides source-backed summaries for preparation. It is not legal advice and
          does not replace a licensed customs broker, lawyer, or accredited laboratory.
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ClearPort. All rights reserved.
      </div>
    </footer>
  );
}