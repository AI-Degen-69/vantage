import "./global.css";

import { Component, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { WatchlistsProvider } from "@/hooks/useWatchlists";
import { EarningsAlertEngine } from "@/hooks/useEarningsAlerts";
import TopBar from "@/components/TopBar";
import Index from "./pages/Index";
import I18nDebug from "./pages/I18nDebug";
import Insights from "./pages/Insights";
import Charts from "./pages/Charts";
import Watchlists from "./pages/Watchlists";
import Earnings from "./pages/Earnings";
import Portfolios from "./pages/Portfolios";
import NotFound from "./pages/NotFound";

// ----------------------------------------------------------------------------
// QueryClient — shared defaults (Phase 0 — C4)
// ----------------------------------------------------------------------------
// staleTime  = 60s      → don't refetch immediately on every render
// gcTime     = 5min    → keep cache in memory for back-nav
// retry      = 1        → ONE retry, not infinite
// refetchOnWindowFocus  → off; explicit refetchInterval on quote hooks is enough
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ----------------------------------------------------------------------------
// SplAppLayout + SplashPage
// ----------------------------------------------------------------------------
const AppLayout = ({ children }: { children: ReactNode }) => (
  // `<WatchlistsProvider>` lifts the module-level watchlists subscription
  // into the React tree so every consumer (page, alert engine, ...) reads
  // the same snapshot via `useSyncExternalStore`. Mounted at AppLayout-
  // level so it wraps ALL pages and never re-mounts on route change.
  //
  // `<EarningsAlertEngine>` (nested INSIDE the Watchlists Provider) runs
  // the engine work exactly once for the whole layout — one TanStack
  // Query subscription, one 60s heartbeat, one storage listener — and
  // exposes the resulting `EngineData` via Context. The Strip and
  // HistoryPanel mounted in TopBar are reading through this Provider;
  // no second subscription layer.
  <WatchlistsProvider>
    <EarningsAlertEngine>
      <div className="flex h-screen bg-background dark overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
          <TopBar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </EarningsAlertEngine>
  </WatchlistsProvider>
);

const SplashPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-4">
      <h1 className="text-4xl font-bold text-foreground mb-6 tracking-widest">VANTAGE</h1>
      <p className="text-muted-foreground mb-8 text-lg">
        {t("splash.subtitle")}
      </p>
      <div className="w-full space-y-4 bg-card p-6 rounded-xl border border-border">
        <div>
          <input
            type="email"
            placeholder={t("splash.email")}
            className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500 transition-colors"
            defaultValue="demo@vantage.com"
          />
        </div>
        <div>
          <input
            type="password"
            placeholder={t("splash.password")}
            className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500 transition-colors"
            defaultValue="password123"
          />
        </div>
        <button
          onClick={() => navigate("/insights")}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          {t("splash.login")}
        </button>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// ErrorBoundary — single route crashes shouldn't white-screen the app (Phase 0 — C3)
// ----------------------------------------------------------------------------
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}
interface ErrorBoundaryState {
  error: Error | null;
}
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-8 mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-red-400 mb-3">Something went wrong</h2>
          <p className="text-sm text-slate-300 mb-4">
            {this.state.error.message || "Unknown rendering error"}
          </p>
          <button
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
            onClick={() => {
              // A full reload is the only safe recovery from a render crash —
              // no point partial-patching the React tree. The new mount re-runs
              // getDerivedStateFromError with a fresh error=null state.
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ----------------------------------------------------------------------------
// App
/**
 * Configures shared application providers and renders the application's routes.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route
                path="/"
                element={
                  <AppLayout>
                    <SplashPage />
                  </AppLayout>
                }
              />
              <Route path="/portfolios" element={<AppLayout><ErrorBoundary><Portfolios /></ErrorBoundary></AppLayout>} />
              <Route path="/stock/:ticker" element={<AppLayout><ErrorBoundary><Index /></ErrorBoundary></AppLayout>} />
              <Route path="/insights" element={<AppLayout><ErrorBoundary><Insights /></ErrorBoundary></AppLayout>} />
              <Route path="/watchlists" element={<AppLayout><ErrorBoundary><Watchlists /></ErrorBoundary></AppLayout>} />
              <Route path="/charts" element={<AppLayout><ErrorBoundary><Charts /></ErrorBoundary></AppLayout>} />
              <Route path="/earnings" element={<AppLayout><ErrorBoundary><Earnings /></ErrorBoundary></AppLayout>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              {/* Dev-only `/i18n` translator QA route — gated so the bundle
                  is excluded from production builds via Vite tree-shake on
                  the dead branch. Tree-shake succeeds because `import.meta.env.DEV`
                  is statically replaced with `false` at build time. */}
              {import.meta.env.DEV && (
                <Route path="/i18n" element={<AppLayout><ErrorBoundary><I18nDebug /></ErrorBoundary></AppLayout>} />
              )}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
