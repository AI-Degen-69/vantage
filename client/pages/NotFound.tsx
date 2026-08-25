import { useLocation } from "react-router-dom";
import { useEffect } from "react";

import { useI18n } from "@/lib/i18n";

const NotFound = () => {
  const { t } = useI18n();
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">{t("notfound.title")}</h1>
            <p className="text-xl text-muted-foreground mb-4">{t("notfound.description")}</p>
            <a href="/" className="text-primary hover:text-primary/80 underline">
          {t("notfound.returnHome")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
