import { auth, defineMcp } from "@lovable.dev/mcp-js";
import askOnboardingCoachTool from "./tools/ask-onboarding-coach";
import getRoleContentTool from "./tools/get-role-content";

// The OAuth issuer must be the direct Supabase auth host; the project ref is
// inlined at build time and survives publish unchanged.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "moveforward-dashboard",
  title: "Onboardie Dashboard",
  version: "0.1.0",
  instructions:
    "Tools for Onboardie, an AI onboarding coach for new hires. Use `get_role_content` to read the published Sales Development Representative onboarding material, and `ask_onboarding_coach` to get a grounded answer to an onboarding question.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getRoleContentTool, askOnboardingCoachTool],
});
