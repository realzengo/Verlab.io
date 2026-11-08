import "server-only";
import { ACCOUNT_TOOLS } from "./account";
import { RESEARCH_TOOLS } from "./research";
import { BEND_TOOLS } from "./bend";
import { SCRIPT_TOOLS } from "./scripts";
import { IMAGE_TOOLS } from "./images";
import { VOICE_TOOLS } from "./voice";
import { VIDEO_TOOLS } from "./video";
import { CLIP_TOOLS } from "./clips";
import { MEDIA_TOOLS } from "./media";

export type { McpToolDefinition } from "./shared";
export { errorResult } from "./shared";

// Ordered the way a creator's workflow runs: research -> playbook -> script
// -> media -> clips, with account/library tools first.
export const MCP_TOOLS = [
  ...ACCOUNT_TOOLS,
  ...RESEARCH_TOOLS,
  ...BEND_TOOLS,
  ...SCRIPT_TOOLS,
  ...IMAGE_TOOLS,
  ...VOICE_TOOLS,
  ...VIDEO_TOOLS,
  ...CLIP_TOOLS,
  ...MEDIA_TOOLS,
];
