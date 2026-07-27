import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Index from "./pages/Index";
import Insights from "./pages/Insights";
import Charts from "./pages/Charts";
import Watchlists from "./pages/Watchlists";
import Earnings from "./pages/Earnings";
import Portfolios from "./pages/Portfolios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen bg-background dark overflow-hidden">
    <Sidebar />
    <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
      <TopBar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  </div>
);

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const SplashPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-4">
      <h1 className="text-4xl font-bold text-foreground mb-6 tracking-widest">QUALTRIM</h1>
      <p className="text-muted-foreground mb-8 text-lg">
        {t("splash.subtitle", "Your personalized Bloomberg terminal for long-term investors.")}
      </p>
      <div className="w-full space-y-4 bg-card p-6 rounded-xl border border-border">
        <div>
          <input 
            type="email" 
            placeholder={t("splash.email", "Email address")} 
            className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500 transition-colors"
            defaultValue="demo@qualtrim.com"
          />
        </div>
        <div>
          <input 
            type="password" 
            placeholder={t("splash.password", "Password")} 
            className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500 transition-colors"
            defaultValue="password123"
          />
        </div>
        <button 
          onClick={() => navigate("/insights")}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          {t("splash.login", "Log In / 7-Day Trial")}
        </button>
      </div>
    </div>
  );
};

const PlaceholderPage = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">{t("placeholder.title")}</h2>
        <p className="text-muted-foreground mb-6">{t("placeholder.description")}</p>
        <p className="text-sm text-slate-400">{t("placeholder.checkBack")}</p>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <AppLayout>
                  <SplashPage />
                </AppLayout>
              }
            />
            <Route path="/portfolios" element={<AppLayout><Portfolios /></AppLayout>} />
            <Route path="/stock/:ticker" element={<AppLayout><Index /></AppLayout>} />
            <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
            <Route path="/watchlists" element={<AppLayout><Watchlists /></AppLayout>} />
            <Route path="/charts" element={<AppLayout><Charts /></AppLayout>} />
            <Route path="/earnings" element={<AppLayout><Earnings /></AppLayout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
