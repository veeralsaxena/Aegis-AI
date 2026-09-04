import asyncio
import os
from dotenv import load_dotenv
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession

load_dotenv()

async def run_agent():
    # Path to the built FHIR MCP server
    server_script = os.path.abspath("../fhir-mcp-server/dist/index.js")
    
    if not os.path.exists(server_script):
        print(f"Error: MCP Server build not found at {server_script}.")
        return

    # Transport to talk to the Node.js MCP server
    server_params = StdioServerParameters(
        command="node",
        args=[server_script],
        env=os.environ.copy()
    )

    async with stdio_client(server_params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            # Initialize connection
            await session.initialize()
            print("Successfully connected to Aegis-FHIR-MCP Server via stdio")

            # 1. List available tools
            tools_result = await session.list_tools()
            print("\nAvailable Tools:")
            for tool in tools_result.tools:
                print(f"- {tool.name}: {tool.description}")

            # 2. Example: Search for a patient
            print("\nSearching for patient 'John'...")
            response = await session.call_tool("fhir_search", {
                "resourceType": "Patient",
                "parameters": { "name": "John" }
            })
            
            # response is a CallToolResult
            print(f"Result: {response.content[0].text[:500]}...")

if __name__ == "__main__":
    asyncio.run(run_agent())
