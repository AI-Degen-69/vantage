import { useI18n } from "@/lib/i18n";
import Portfolio from "@/components/Portfolio";

/**
 * Renders the portfolios page with a translated heading and portfolio content.
 */
export default function Portfolios() {
  const { t } = useI18n();

  return (
    <div className="w-full bg-background dark min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-foreground">{t("portfolio.title")}</h1>

        <Portfolio />
      </div>
    </div>
  );
}
