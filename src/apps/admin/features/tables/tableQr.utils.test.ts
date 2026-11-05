import { describe, expect, it } from "vitest";
import { escapeHtml } from "./tableQr.utils";

describe("escapeHtml", () => {
  it("escapes markup in restaurant and table labels", () => {
    expect(escapeHtml(`Café <script> & "friends"`)).toBe(
      "Café &lt;script&gt; &amp; &quot;friends&quot;",
    );
  });
});
