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
            project: {
              type: "string",
              description: "Project name (e.g., 'UCY-CS499-DC')",
            },
            experiment: {
              type: "string",
              description: "Experiment name",
            },
          },
          required: ["project", "experiment"],
        },
      },
      {
        name: "reboot_node",
        description: "Reboot a specific node in an experiment",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project name",
            },
            experiment: {
              type: "string",
              description: "Experiment name",
            },
            node: {
              type: "string",
              description: "Node name (e.g., 'node0')",
            },
          },
          required: ["project", "experiment", "node"],
        },
      },
      {
        name: "reboot_all_nodes",
        description: "Reboot all nodes in an experiment",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project name",
            },
            experiment: {
              type: "string",
              description: "Experiment name",
            },
          },
          required: ["project", "experiment"],
        },
      },
      {
        name: "reload_node",
        description: "Reload/reimage a node with its disk image",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project name",
            },
            experiment: {
              type: "string",
              description: "Experiment name",
            },
            node: {
              type: "string",
              description: "Node name",
            },
          },
          required: ["project", "experiment", "node"],
        },
      },
      {
        name: "powercycle_node",
        description: "Power cycle a node (hard reboot)",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project name",
            },
            experiment: {
              type: "string",
              description: "Experiment name",
            },
            node: {
              type: "string",
              description: "Node name",
            },
          },
          required: ["project", "experiment", "node"],
        },
      },
      {
        name: "get_experiment_logs",
        description: "Get console logs for nodes in an experiment",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project name",
            },
            experiment: {
              type: "string",
              description: "Experiment name",
            },
          },
          required: ["project", "experiment"],
        },
      },
      {
        name: "extend_experiment",
        description: "Extend the expiration time of an experiment",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project name",
            },
            experiment: {
              type: "string",
              description: "Experiment name",
            },
            hours: {
              type: "number",
              description: "Number of hours to extend",
            },
            reason: {
              type: "string",
              description: "Reason for extension",
            },
          },
          required: ["project", "experiment", "hours"],
        },
      },
      {
        name: "terminate_experiment",
        description: "Terminate an experiment (WARNING: destroys all data)",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project name",
            },
            experiment: {
              type: "string",
              description: "Experiment name",
            },
          },
          required: ["project", "experiment"],
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
        const { project, experiment } = args as { project: string; experiment: string };
        const result = await cloudlabRequest(`/experiments/${project}/${experiment}`);
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
        const { project, experiment, node } = args as {
          project: string;
          experiment: string;
          node: string;
        };
        const result = await cloudlabRequest(
          `/experiments/${project}/${experiment}/nodes/${node}/reboot`,
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
        const { project, experiment } = args as { project: string; experiment: string };
        const result = await cloudlabRequest(
          `/experiments/${project}/${experiment}/reboot`,
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
        const { project, experiment, node } = args as {
          project: string;
          experiment: string;
          node: string;
        };
        const result = await cloudlabRequest(
          `/experiments/${project}/${experiment}/nodes/${node}/reload`,
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
        const { project, experiment, node } = args as {
          project: string;
          experiment: string;
          node: string;
        };
        const result = await cloudlabRequest(
          `/experiments/${project}/${experiment}/nodes/${node}/powercycle`,
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

      case "get_experiment_logs": {
        const { project, experiment } = args as { project: string; experiment: string };
        const result = await cloudlabRequest(`/experiments/${project}/${experiment}/logs`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "extend_experiment": {
        const { project, experiment, hours, reason } = args as {
          project: string;
          experiment: string;
          hours: number;
          reason?: string;
        };
        const result = await cloudlabRequest(
          `/experiments/${project}/${experiment}/extend`,
          "POST",
          { hours, reason: reason || "Extension requested" }
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
        const { project, experiment } = args as { project: string; experiment: string };
        const result = await cloudlabRequest(
          `/experiments/${project}/${experiment}`,
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
