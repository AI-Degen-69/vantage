import { useEffect, useRef } from "react";
import { X, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * The categorical reason the user arrived via the locked CTA. Surfaces
   * in the body copy so the user sees "this is what you're paying to
   * unlock" rather than a generic upsell. Keeps the placeholder honest
   * — when a real billing flow lands it can branch on this prop.
   */
  context?: "revenueSegments" | null;
}

/**
 * Lightweight placeholder /pricing modal.
 *
 * Triggered by the locked-premium CTA in the revenue card + chart
 * modal: when the free-tier FMP quota is exhausted (or no FMP key is
 * configured), the locked chip exposes an Upgrade link that opens this
 * modal. Body copy explains what the premium tier unlocks and offers
 * two placeholder CTAs (Notify me / Contact) — wireframe intent, not
 * a billing flow. When a real payment SDK lands, swap the placeholder
 * CTAs for the real ones; everything else (focus trap, backdrop,
 * escape-to-close) stays.
 *
 * Implementation notes:
 *   - Renders a top-level fixed overlay (no Portal) so the modal sits
 *     above any card-specific backdrop without z-index gymnastics.
 *   - Restores focus to the previously focused element on close so the
 *     lock-chip / banner button retains focus context.
 *   - Escape key + backdrop click both close (mirrors the ChartModal
 *     pattern the user already knows).
 */
export default function PricingModal({
  isOpen,
  onClose,
  context = "revenueSegments",
}: PricingModalProps) {
  const { t } = useI18n();

  // Track the element that had focus when the modal opened so we can
  // restore it on close (a11y: a screen reader or keyboard user who
  // pressed the Upgrade button should land back on that button).
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // Move focus into the modal so escape + tab cycles start clean.
    const closeBtn = document.getElementById("pricing-modal-close");
    closeBtn?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Body copy switches on the context prop so a future earnings-locked
  // CTA (or any other gated feature) can re-use this modal with
  // feature-specific copy without a new component.
  const bodyKey =
    context === "revenueSegments"
      ? "pricing.revenueSegmentsBody"
      : "pricing.genericBody";

  return (
    <div
      className="fixed inset-0 bg-background/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-modal-title"
    >
      <div
        className="bg-card rounded-panel border border-primary/30 shadow-glow w-[95vw] max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary/15 text-primary border border-primary/30">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2
                id="pricing-modal-title"
                className="text-lg font-semibold text-foreground"
              >
                {t("pricing.title")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("pricing.subtitle")}
              </p>
            </div>
          </div>
          <button
            id="pricing-modal-close"
            type="button"
            onClick={onClose}
            aria-label={t("pricing.close")}
            className="p-2 hover:bg-muted rounded-[6px] transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {t(bodyKey)}
          </p>
          <ul className="text-sm text-foreground/80 space-y-1.5 ps-1">
            <li className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 mt-1 text-primary shrink-0" />
              <span>{t("pricing.bulletSegments")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 mt-1 text-primary shrink-0" />
              <span>{t("pricing.bulletHistory")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 mt-1 text-primary shrink-0" />
              <span>{t("pricing.bulletAlerts")}</span>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground pt-1">
            {t("pricing.placeholderNote")}
          </p>
        </div>

        {/* Footer CTAs — placeholder framing, real billing lands later. */}
        <div className="flex items-center gap-2 p-5 border-t border-border bg-background/40">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border bg-transparent text-foreground text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors"
          >
            {t("pricing.notifyMe")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {t("pricing.contactSales")}
          </button>
        </div>
      </div>
    </div>
  );
}
