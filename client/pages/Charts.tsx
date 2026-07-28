import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DCFWidget from "@/components/DCFWidget";
import { SectionCardSkeleton } from "@/components/Skeleton";
import { useStockQuote } from "@/hooks/useStockData";

export default function Charts() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const ticker = (searchParams.get("ticker") || "AAPL").toUpperCase();

  // DCF math depends on the live quote — never feed a hardcoded number.
  const { data: quoteData, isLoading: quoteLoading } = useStockQuote(ticker);
  const currentPrice = quoteData?.price;

  return (
    <div className="w-full bg-background dark min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">{t("sidebar.charts")}</h1>
          <span className="text-sm text-muted-foreground" dir="ltr">{ticker}</span>
        </div>

        {quoteLoading || currentPrice == null ? (
          <SectionCardSkeleton height={360} />
        ) : (
          <DCFWidget currentPrice={currentPrice} />
        )}
      </div>
    </div>
  );
}
