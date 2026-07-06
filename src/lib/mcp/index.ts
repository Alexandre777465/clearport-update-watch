import { defineMcp } from "@lovable.dev/mcp-js";
import aboutClearport from "./tools/about-clearport";
import listRegulatoryModules from "./tools/list-regulatory-modules";

export default defineMcp({
  name: "clearport-mcp",
  title: "ClearPort MCP",
  version: "0.1.0",
  instructions:
    "Tools that describe ClearPort, a U.S. trade compliance monitoring service. Use `about_clearport` for an overview and `list_regulatory_modules` to see which U.S. regulatory areas ClearPort evaluates.",
  tools: [aboutClearport, listRegulatoryModules],
});