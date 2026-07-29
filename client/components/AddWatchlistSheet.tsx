import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { parseTickers } from "@/lib/parseCsv";
import { useValidateSymbols } from "@/hooks/useStockData";
import type { Result, Watchlist, WatchlistSymbolEntry } from "@/lib/watchlistStore";

interface AddWatchlistSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (
    name: string,
    symbols: WatchlistSymbolEntry[],
  ) => Result<Watchlist>;
}

/**
 * Right-side sheet for creating a new user watchlist. The sheet is
 * intentionally narrow but tall — name input + symbols textarea at the
 * top so the user can immediately paste a CSV column, then validation
 * chips + submit at the bottom.
 *
 * Validation flow:
 *   1. User types/pastes in the textarea. `parseTickers` gives us the
 *      format-clean list and an honest invalid-set back.
 *   2. We feed the format-clean list to `useValidateSymbols` which fires
 *      `/api/stock-overview` in parallel (cap 8). Results return as
 *      `valid` (with profile.companyName to seed display names) plus
 *      `invalid`.
 *   3. The submit button counts valid items and disables itself when
 *      valid < 1 OR the name field is empty.
 *
 * Honest feedback: the user sees both the format-invalid chips (from
 * `parseTickers`) AND the upstream-invalid chips (from the validation
 * hook) so they understand exactly why a paste got truncated — nothing
 * is silently dropped.
 */
export function AddWatchlistSheet({ open, onOpenChange, onCreate }: AddWatchlistSheetProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [rawSymbols, setRawSymbols] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset state when the sheet closes so re-opening starts clean.
  useEffect(() => {
    if (!open) {
      setName("");
      setRawSymbols("");
      setError(null);
    }
  }, [open]);

  // Format-clean list (uppercased, deduped, regex-gated).
  const parsed = useMemo(() => parseTickers(rawSymbols), [rawSymbols]);
  const validated = useValidateSymbols(parsed.valid);

  // Display names come from the validated profiles when we have them;
  // otherwise we fall back to whatever the system knows about the symbol.
  const displayNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const { symbol, profile } of validated.valid) {
      if (profile.companyName) map.set(symbol, profile.companyName);
    }
    return map;
  }, [validated.valid]);

  // Combined preview: every parsed symbol tagged with valid/invalid/unverified +
  // (when valid) a display name. This drives the chip row.
  const preview: Array<{
    symbol: string;
    displayName: string | null;
    state: "valid" | "invalid" | "unverified";
  }> = useMemo(() => {
    const validSet = new Set(validated.valid.map((v) => v.symbol));
    const invalidSet = new Set(validated.invalid);
    const unverifiedSet = new Set(validated.unverified);
    return parsed.valid.map((sym) => {
      if (validSet.has(sym)) {
        return {
          symbol: sym,
          displayName: displayNames.get(sym) ?? null,
          state: "valid" as const,
        };
      } else if (invalidSet.has(sym)) {
        return {
          symbol: sym,
          displayName: null,
          state: "invalid" as const,
        };
      } else if (unverifiedSet.has(sym)) {
        return {
          symbol: sym,
          displayName: null,
          state: "unverified" as const,
        };
      } else {
        // Still validating
        return {
          symbol: sym,
          displayName: null,
          state: "unverified" as const,
        };
      }
    });
  }, [parsed.valid, validated.valid, validated.invalid, validated.unverified, displayNames]);

  const formatInvalidPreview = parsed.invalid;

  const truncatedPreview = preview.slice(0, 48); // keep chip row scannable
  const visibleValidCount = preview.length;
  const visibleInvalidCount = formatInvalidPreview.length;

  const canSubmit =
    name.trim().length > 0 &&
    preview.length > 0 &&
    preview.some((p) => p.state === "valid" || p.state === "unverified") &&
    !validated.isValidating;

  const handleSubmit = () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("watchlists.emptyNameError"));
      return;
    }
    if (preview.length === 0 || !preview.some((p) => p.state === "valid" || p.state === "unverified")) {
      setError(t("watchlists.csvHint"));
      return;
    }
    // Accept validated symbols and unverified format-clean symbols. Never
    // commit invalid candidates to disk; surface them to the user instead.
    const accept: WatchlistSymbolEntry[] = preview
      .filter((p) => p.state === "valid" || p.state === "unverified")
      .map((p) => ({ symbol: p.symbol, name: p.displayName ?? undefined }));

    const result = onCreate(trimmedName, accept);
    // Explicit `result.ok === false` narrowing — TS sometimes loses the
    // union-narrow on callback return types; hard-split the failure path.
    if (result.ok === false) {
      if (result.reason === "empty_name") setError(t("watchlists.emptyNameError"));
      else if (result.reason === "duplicate_name") setError(t("watchlists.duplicateNameError", { name: trimmedName }));
      return;
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("watchlists.addTitle")}</SheetTitle>
          <SheetDescription>{t("watchlists.csvHint")}</SheetDescription>
        </SheetHeader>

        {/* Name + symbols form */}
        <div className="space-y-4 px-1">
          <div>
            <label htmlFor="watchlist-name-input" className="text-sm font-medium block mb-1.5">
              {t("watchlists.nameLabel")}
            </label>
            <Input
              id="watchlist-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("watchlists.namePlaceholder")}
              className="w-full"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="watchlist-symbols-textarea" className="text-sm font-medium block mb-1.5">
              {t("watchlists.symbolsLabel")}
            </label>
            <textarea
              id="watchlist-symbols-textarea"
              value={rawSymbols}
              onChange={(e) => setRawSymbols(e.target.value)}
              placeholder={t("watchlists.symbolsPlaceholder")}
              className="w-full h-40 bg-slate-900/40 border border-slate-700 rounded-md p-3 text-sm font-mono text-foreground placeholder-slate-500 outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Validation chips — show what we have after parsing. Live
              upstream-validation chips flip from pending to valid/invalid
              as /api/stock-overview resolves per symbol (cap 8). */}
          {truncatedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {t("watchlists.validCount", { count: visibleValidCount })}
                </span>
                {validated.isValidating && (
                  <span className="text-[10px] text-amber-300" dir="ltr">
                    ● {t("watchlists.validatingLabel")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {truncatedPreview.map((p) => (
                  <span
                    key={p.symbol}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                      p.state === "valid"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : p.state === "unverified"
                          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                          : "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                    }`}
                    title={p.displayName ?? p.symbol}
                  >
                    {p.symbol}
                  </span>
                ))}
                {preview.length > truncatedPreview.length && (
                  <span className="text-[11px] text-slate-500 px-2 py-0.5">
                    +{preview.length - truncatedPreview.length}
                  </span>
                )}
              </div>
              {formatInvalidPreview.length > 0 && (
                <>
                  <div className="text-xs text-slate-400 font-medium" dir="ltr">
                    {t("watchlists.invalidCount", { count: visibleInvalidCount })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formatInvalidPreview.slice(0, 24).map((s) => (
                      <span
                        key={s}
                        className="text-[11px] font-bold px-2 py-0.5 rounded border bg-red-500/15 text-red-300 border-red-500/30"
                        title={t("watchlists.invalidChip")}
                      >
                        {s} <X className="w-3 h-3 inline-block -mt-0.5" />
                      </span>
                    ))}
                    {formatInvalidPreview.length > 24 && (
                      <span className="text-[11px] text-slate-500 px-2 py-0.5" dir="ltr">
                        +{formatInvalidPreview.length - 24}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <SheetFooter className="mt-auto gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("watchlists.cancelButton")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            <Plus className="w-4 h-4 me-1.5" />
            {t("watchlists.createButton")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
