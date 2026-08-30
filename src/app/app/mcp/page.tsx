import { McpConnectSection } from "@/components/mcp/McpConnectSection";
import { McpSetupFlow } from "@/components/mcp/McpSetupFlow";

export default function McpPage() {
  return (
    <div className="w-full py-8">
      <McpConnectSection compact />

      <div className="mt-6 sm:mt-8">
        <McpSetupFlow />
      </div>
    </div>
  );
}
