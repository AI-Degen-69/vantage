// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { I18nProvider } from "@/lib/i18n";

function withI18n(node: React.ReactNode): React.ReactElement {
  return <I18nProvider>{node}</I18nProvider>;
}

describe("LanguageSwitcher", () => {
  it("renders both language buttons", () => {
    const html = renderToString(withI18n(<LanguageSwitcher />));

    expect(html).toContain("US");
    expect(html).toContain("עב");
    expect(html).toContain("🇺🇸");
    expect(html).toContain("🇮🇱");
  });
});
