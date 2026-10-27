import { describe, expect, it } from "vitest";
import { makeLead } from "@/test/fixtures";
import {
  countKpi,
  followUpState,
  isFormUnqualified,
  leadHitsKpiInRange,
  leadReachedKpi,
  needsQualification,
  pipelineStageOf
} from "@/lib/leads/lifecycleDefinitions";

const IN = "2026-09-10T06:00:00.000Z"; // IST 11:30 on 10 Sep
const EDGE = "2026-09-10T18:30:00.000Z"; // IST midnight 11 Sep — counts as 11 Sep
const FROM = "2026-09-01";
const TO = "2026-09-10";

describe("pipelineStageOf", () => {
  it("walks new → contacted → qualified → call_booked → showed_up", () => {
    expect(pipelineStageOf(makeLead())).toBe("new");
    expect(pipelineStageOf(makeLead({ first_contacted_at: IN }))).toBe("contacted");
    expect(pipelineStageOf(makeLead({ first_contacted_at: IN, qualified: true }))).toBe(
      "qualified"
    );
    expect(pipelineStageOf(makeLead({ call_booked_at: IN }))).toBe("call_booked");
    expect(pipelineStageOf(makeLead({ call_booked_at: IN, call_showed: true }))).toBe(
      "showed_up"
    );
  });
});

describe("overlays", () => {
  it("needs qualification when booked and qualified is null", () => {
    expect(needsQualification(makeLead({ call_booked_at: IN }))).toBe(true);
    expect(needsQualification(makeLead({ call_booked_at: IN, qualified: true }))).toBe(
      false
    );
    expect(needsQualification(makeLead())).toBe(false);
  });

  it("form-unqualified is form no + no setter decision", () => {
    expect(isFormUnqualified(makeLead({ form_qualified: false }))).toBe(true);
    expect(isFormUnqualified(makeLead({ form_qualified: false, qualified: true }))).toBe(
      false
    );
    expect(isFormUnqualified(makeLead({ form_qualified: true }))).toBe(false);
  });

  it("follow-up colour is IST calendar day vs today", () => {
    expect(followUpState("2026-09-09T18:29:00.000Z", "2026-09-10")).toBe("overdue");
    expect(followUpState("2026-09-10T06:00:00.000Z", "2026-09-10")).toBe("today");
    expect(followUpState("2026-09-11T06:00:00.000Z", "2026-09-10")).toBe("upcoming");
    expect(followUpState(null, "2026-09-10")).toBeNull();
  });
});

describe("KPI range (IST inclusive last day)", () => {
  it("counts a timestamp on the last IST day and excludes the next IST midnight", () => {
    const inRange = makeLead({ created_at: IN });
    const nextDay = makeLead({ id: "edge", created_at: EDGE });
    expect(leadHitsKpiInRange(inRange, "leads", FROM, TO)).toBe(true);
    expect(leadHitsKpiInRange(nextDay, "leads", FROM, TO)).toBe(false);
  });

  it("Calls Booked is call_booked_at in range, not call_confirmed", () => {
    const booked = makeLead({ call_booked_at: IN });
    const laterDied = makeLead({
      id: "dead",
      call_booked_at: IN,
      is_dead: true
    });
    expect(leadReachedKpi(booked, "calls_booked")).toBe(true);
    expect(countKpi([booked, laterDied], "calls_booked", FROM, TO)).toBe(2);
  });

  it("Showups need call_showed and call_showed_at; qualified showups also need qualified", () => {
    const showed = makeLead({
      call_showed: true,
      call_showed_at: IN,
      qualified: true
    });
    const showedUnqualified = makeLead({
      id: "u",
      call_showed: true,
      call_showed_at: IN,
      qualified: false
    });
    const flagOnly = makeLead({ id: "flag", call_showed: true });
    expect(countKpi([showed, showedUnqualified, flagOnly], "showups", FROM, TO)).toBe(2);
    expect(
      countKpi([showed, showedUnqualified, flagOnly], "qualified_showups", FROM, TO)
    ).toBe(1);
  });
});
