# CloudLab MCP Server

An MCP (Model Context Protocol) server for managing CloudLab/Emulab experiments. This allows AI assistants like Claude to interact with your CloudLab experiments directly.

## Features

- **List experiments** - View all your CloudLab experiments
- **Get experiment details** - See detailed status including node states
- **Reboot nodes** - Reboot individual nodes or all nodes in an experiment
- **Reload/reimage nodes** - Reload a node with its disk image
- **Power cycle nodes** - Hard reboot for unresponsive nodes
- **Get console logs** - Retrieve console output from nodes
- **Extend experiments** - Request time extensions
- **Terminate experiments** - Clean up when done

## Prerequisites

- Node.js 18+
- A CloudLab account with API access
- A valid CloudLab JWT token

## Installation

```bash
npm install
npm run build
```

## Configuration

### Getting your CloudLab JWT Token

1. Log in to [CloudLab](https://www.cloudlab.us/)
2. Go to your user profile
3. Navigate to "Download Credentials" or generate an API token
4. Save the token as `cloudlab.jwt`

### Token Location

The server looks for your JWT token in these locations (in order):

1. Path specified in `CLOUDLAB_TOKEN_PATH` environment variable
2. `cloudlab.jwt` in the project directory
3. `~/Downloads/cloudlab.jwt`

**Important:** Never commit your JWT token to version control!

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cloudlab": {
      "command": "node",
      "args": ["/path/to/cloudlab-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_experiments` | List all your experiments |
| `get_experiment` | Get detailed status of an experiment |
| `reboot_node` | Reboot a specific node |
| `reboot_all_nodes` | Reboot all nodes in an experiment |
| `reload_node` | Reload/reimage a node |
| `powercycle_node` | Power cycle a node (hard reboot) |
| `get_experiment_logs` | Get console logs for nodes |
| `extend_experiment` | Extend experiment expiration |
| `terminate_experiment` | Terminate an experiment |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLOUDLAB_TOKEN_PATH` | Custom path to your JWT token file |
| `CLOUDLAB_API_URL` | Override the API endpoint (default: `https://www.emulab.net:43794`) |

## License

MIT
