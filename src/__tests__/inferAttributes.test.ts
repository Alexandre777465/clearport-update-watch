import { describe, it, expect } from "bun:test";
import { inferAttributes } from "../lib/inferAttributes";

describe("inferAttributes — explicit-negative overrides", () => {
  it("brake drum with no battery/electronics/food-contact description infers nothing", () => {
    const attrs = inferAttributes(
      "Cast-iron brake drum for passenger vehicles",
      "Non-composite construction. Steel content approximately 38% by weight. No electronics, battery, radio transmitter, chemicals or food-contact use.",
    );
    expect(attrs.find((a) => a.key === "has_battery")).toBeUndefined();
    expect(attrs.find((a) => a.key === "is_electronic")).toBeUndefined();
    expect(attrs.find((a) => a.key === "is_food_contact")).toBeUndefined();
  });

  it("'no battery' suppresses has_battery even when 'battery' appears in name", () => {
    const attrs = inferAttributes("Cordless drill", "Contains no battery — sold without battery pack.");
    expect(attrs.find((a) => a.key === "has_battery")).toBeUndefined();
  });

  it("'no electronics' suppresses is_electronic from 'bluetooth speaker' name", () => {
    const attrs = inferAttributes(
      "Bluetooth speaker housing",
      "Enclosure only — no electronics included. Electronics sold separately.",
    );
    expect(attrs.find((a) => a.key === "is_electronic")).toBeUndefined();
  });

  it("'no food-contact use' suppresses is_food_contact from 'bottle' keyword", () => {
    const attrs = inferAttributes(
      "Decorative bottle",
      "For display only. No food-contact use.",
    );
    expect(attrs.find((a) => a.key === "is_food_contact")).toBeUndefined();
  });

  it("'battery-free' suppresses has_battery", () => {
    const attrs = inferAttributes("LED lamp", "Battery-free wall-mounted design.");
    expect(attrs.find((a) => a.key === "has_battery")).toBeUndefined();
  });

  it("positive keyword still fires when no matching negative is present", () => {
    const attrs = inferAttributes("Bluetooth speaker", "Rechargeable lithium-ion battery included.");
    expect(attrs.find((a) => a.key === "has_battery")).toBeDefined();
    expect(attrs.find((a) => a.key === "is_electronic")).toBeDefined();
  });

  it("negative for one attribute does not suppress a different attribute", () => {
    const attrs = inferAttributes(
      "Children's rechargeable flashlight",
      "No food-contact use.",
    );
    expect(attrs.find((a) => a.key === "is_children")).toBeDefined();
    expect(attrs.find((a) => a.key === "has_battery")).toBeDefined();
    expect(attrs.find((a) => a.key === "is_food_contact")).toBeUndefined();
  });
});
