import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

// Base URL for your deployed PayPer Card API
const API_BASE = "https://agc.rizzmo.site/api";

const server = new Server(
  {
    name: "payper-card-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Define the Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "provision_card",
        description: "Instantly provision a virtual credit card for a specific merchant by negotiating an x402 crypto payment.",
        inputSchema: {
          type: "object",
          properties: {
            merchant: { type: "string", description: "Name of the merchant" },
            amount: { type: "number", description: "Dollar amount to authorize" },
          },
          required: ["merchant", "amount"],
        },
      },
      {
        name: "list_cards",
        description: "List all active provisioned virtual cards.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_card_details",
        description: "Reveal full card details (PAN, CVV, Expiry) for a specific card token.",
        inputSchema: {
          type: "object",
          properties: {
            token: { type: "string", description: "The Lithic card token" },
          },
          required: ["token"],
        },
      }
    ],
  };
});

// 2. Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "provision_card": {
        const args = request.params.arguments as any;
        const merchant = args?.merchant;
        const amount = args?.amount;
        const res = await fetch(`${API_BASE}/run-agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchant, amount }),
        });
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "list_cards": {
        const res = await fetch(`${API_BASE}/cards`);
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_card_details": {
        const args = request.params.arguments as any;
        const token = args?.token;
        const res = await fetch(`${API_BASE}/cards/${token}`);
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error executing tool: ${error.message}` }] };
  }
});

// 3. Start the Server over Stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PayPer Card MCP Server running on stdio");
}

main().catch(console.error);
