import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ADSPEND_SHEET_ID,
  getAdspendSheetId
} from "@/lib/adspend/googleAuth";

const ORIGINAL = process.env.ADSPEND_SHEET_ID;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADSPEND_SHEET_ID;
  else process.env.ADSPEND_SHEET_ID = ORIGINAL;
});

describe("getAdspendSheetId", () => {
  it("uses the hardcoded Master AdSpend id when env is empty", () => {
    delete process.env.ADSPEND_SHEET_ID;
    expect(getAdspendSheetId()).toBe(DEFAULT_ADSPEND_SHEET_ID);
    process.env.ADSPEND_SHEET_ID = "   ";
    expect(getAdspendSheetId()).toBe(DEFAULT_ADSPEND_SHEET_ID);
  });

  it("lets ADSPEND_SHEET_ID override", () => {
    process.env.ADSPEND_SHEET_ID = " other-sheet-id ";
    expect(getAdspendSheetId()).toBe("other-sheet-id");
  });
});
