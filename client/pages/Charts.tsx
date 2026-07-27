import { useTranslation } from "react-i18next";
import DCFWidget from "@/components/DCFWidget";

export default function Charts() {
  const { t } = useTranslation();

  return (
    <div className="w-full bg-background dark min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">{t("sidebar.charts")}</h1>
        </div>

        <DCFWidget currentPrice={215.30} />
      </div>
    </div>
  );
}
