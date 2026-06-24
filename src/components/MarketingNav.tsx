import { Link } from "@tanstack/react-router";
import { Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang, setLang, t } from "@/lib/i18n";

function LanguageToggle() {
  const lang = useLang();
  return (
    <div className="flex items-center rounded-md border border-border text-xs">
      <button
        onClick={() => setLang("en")}
        className={`px-2 py-1 ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("zh")}
        className={`px-2 py-1 ${lang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
      >
        中文
      </button>
    </div>
  );
}

export function MarketingNav() {
  const lang = useLang();
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
          <Link to="/ask" className="hover:text-foreground">{t(lang, "nav_assistant")}</Link>
          <Link to="/sources" className="hover:text-foreground">{t(lang, "nav_sources")}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link to="/onboarding">
            <Button size="sm">{t(lang, "nav_check")}</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const lang = useLang();
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
            {t(lang, "footer_tagline")}
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-2 font-medium">{t(lang, "footer_product")}</div>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link to="/onboarding">{t(lang, "nav_check")}</Link></li>
            <li><Link to="/ask">{t(lang, "nav_assistant")}</Link></li>
            <li><Link to="/sources">{t(lang, "nav_sources")}</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-2 font-medium">{t(lang, "footer_legal")}</div>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link to="/privacy">{t(lang, "footer_privacy")}</Link></li>
            <li><Link to="/terms">{t(lang, "footer_terms")}</Link></li>
          </ul>
        </div>
        <div className="text-xs text-muted-foreground">
          {t(lang, "footer_disclaimer")}
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ClearPort. {t(lang, "footer_rights")}
      </div>
    </footer>
  );
}