#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// CloudLab API configuration
// Port 43794 is the correct portal API port (43795 for HTTP, 43794 for HTTPS)
// www.emulab.net works for all CloudLab clusters (Utah, Wisconsin, Clemson, etc.)
const CLOUDLAB_API_BASE = process.env.CLOUDLAB_API_URL || "https://www.emulab.net:43794";

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_DIR = dirname(__dirname); // Go up from dist/ to project root

// Load JWT token
function loadToken(): string {
  // Check multiple locations in order of preference
  const locations = [
    process.env.CLOUDLAB_TOKEN_PATH,
    join(PROJECT_DIR, "cloudlab.jwt"),
    join(homedir(), "Downloads", "cloudlab.jwt"),
  ].filter(Boolean) as string[];

  for (const tokenPath of locations) {
    if (existsSync(tokenPath)) {
      try {
        return readFileSync(tokenPath, "utf-8").trim();
      } catch (error) {
        // Continue to next location
      }
    }
  }

  throw new Error(`Failed to load CloudLab token. Searched: ${locations.join(", ")}`);
}

// API helper
async function cloudlabRequest(
  endpoint: string,
  method: string = "GET",
  body?: object
): Promise<any> {
  const token = loadToken();
  const url = `${CLOUDLAB_API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    "X-Api-Token": token,
    "Accept": "application/json",
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "follow",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CloudLab API error (${response.status}): ${text}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

// Create the MCP server
const server = new Server(
  {
    name: "cloudlab-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_experiments",
        description: "List all your CloudLab experiments",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_experiment",
        description: "Get detailed status of a specific experiment including node states",
        inputSchema: {
          type: "object",
          properties: {
            experiment_id: {
              type: "string",
              description: "Experiment UUID (from list_experiments)",
            },
          },
          required: ["experiment_id"],
        },
      },
      {
        name: "reboot_node",
        description: "Reboot a specific node in an experiment",
        inputSchema: {
          type: "object",
          properties: {
            experiment_id: {
              type: "string",
              description: "Experiment UUID (from list_experiments)",
            },
            node: {
              type: "string",
              description: "Node client_id (e.g., 'node0')",
            },
          },
          required: ["experiment_id", "node"],
        },
      },
      {
        name: "reboot_all_nodes",
        description: "Reboot all nodes in an experiment",
        inputSchema: {
          type: "object",
          properties: {
            experiment_id: {
              type: "string",
              description: "Experiment UUID (from list_experiments)",
            },
          },
          required: ["experiment_id"],
        },
      },
      {
        name: "reload_node",
        description: "Reload/reimage a node with its disk image",
        inputSchema: {
          type: "object",
          properties: {
            experiment_id: {
              type: "string",
              description: "Experiment UUID (from list_experiments)",
            },
            node: {
              type: "string",
              description: "Node client_id",
            },
          },
          required: ["experiment_id", "node"],
        },
      },
      {
        name: "powercycle_node",
        description: "Power cycle a node (hard reboot)",
        inputSchema: {
          type: "object",
          properties: {
            experiment_id: {
              type: "string",
              description: "Experiment UUID (from list_experiments)",
            },
            node: {
              type: "string",
              description: "Node client_id",
            },
          },
          required: ["experiment_id", "node"],
        },
      },
      {
        name: "extend_experiment",
        description: "Extend the expiration time of an experiment",
        inputSchema: {
          type: "object",
          properties: {
            experiment_id: {
              type: "string",
              description: "Experiment UUID (from list_experiments)",
            },
            hours: {
              type: "number",
              description: "Number of hours to extend",
            },
          },
          required: ["experiment_id", "hours"],
        },
      },
      {
        name: "terminate_experiment",
        description: "Terminate an experiment (WARNING: destroys all data)",
        inputSchema: {
          type: "object",
          properties: {
            experiment_id: {
              type: "string",
              description: "Experiment UUID (from list_experiments)",
            },
          },
          required: ["experiment_id"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_experiments": {
        const result = await cloudlabRequest("/experiments");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_experiment": {
        const { experiment_id } = args as { experiment_id: string };
        const result = await cloudlabRequest(`/experiments/${experiment_id}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "reboot_node": {
        const { experiment_id, node } = args as {
          experiment_id: string;
          node: string;
        };
        const result = await cloudlabRequest(
          `/experiments/${experiment_id}/node/${node}/reboot`,
          "POST"
        );
        return {
          content: [
            {
              type: "text",
              text: `Reboot initiated for node ${node}: ${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case "reboot_all_nodes": {
        const { experiment_id } = args as { experiment_id: string };
        const result = await cloudlabRequest(
          `/experiments/${experiment_id}/nodes/reboot`,
          "POST"
        );
        return {
          content: [
            {
              type: "text",
              text: `Reboot initiated for all nodes: ${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case "reload_node": {
        const { experiment_id, node } = args as {
          experiment_id: string;
          node: string;
        };
        const result = await cloudlabRequest(
          `/experiments/${experiment_id}/node/${node}/reload`,
          "POST"
        );
        return {
          content: [
            {
              type: "text",
              text: `Reload initiated for node ${node}: ${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case "powercycle_node": {
        const { experiment_id, node } = args as {
          experiment_id: string;
          node: string;
        };
        const result = await cloudlabRequest(
          `/experiments/${experiment_id}/node/${node}/powercycle`,
          "POST"
        );
        return {
          content: [
            {
              type: "text",
              text: `Power cycle initiated for node ${node}: ${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case "extend_experiment": {
        const { experiment_id, hours } = args as {
          experiment_id: string;
          hours: number;
        };
        const result = await cloudlabRequest(
          `/experiments/${experiment_id}`,
          "PUT",
          { extend_by: hours }
        );
        return {
          content: [
            {
              type: "text",
              text: `Extension requested: ${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case "terminate_experiment": {
        const { experiment_id } = args as { experiment_id: string };
        const result = await cloudlabRequest(
          `/experiments/${experiment_id}`,
          "DELETE"
        );
        return {
          content: [
            {
              type: "text",
              text: `Experiment termination initiated: ${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CloudLab MCP server running on stdio");
}

main().catch(console.error);
