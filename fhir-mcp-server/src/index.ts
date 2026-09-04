import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const BAHMNI_URL = process.env.BAHMNI_URL || "https://localhost/openmrs/ws/fhir2/R4/";
const BAHMNI_USERNAME = process.env.BAHMNI_USERNAME || "admin";
const BAHMNI_PASSWORD = process.env.BAHMNI_PASSWORD || "Admin123";

const server = new Server(
  {
    name: "aegis-fhir-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Common headers for all FHIR requests
 */
const getHeaders = () => ({
  Authorization: `Basic ${Buffer.from(`${BAHMNI_USERNAME}:${BAHMNI_PASSWORD}`).toString("base64")}`,
  Accept: "application/fhir+json",
  "Content-Type": "application/fhir+json",
});

/**
 * List available tools to the AI Agent.
 * These are generic FHIR R4 tools that work for ANY resource.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fhir_search",
        description: "Search for any FHIR resource (Patient, Observation, Condition, etc.) using key-value parameters.",
        inputSchema: {
          type: "object",
          properties: {
            resourceType: { type: "string", description: "The FHIR resource type (e.g., 'Observation')" },
            parameters: { type: "object", description: "Search parameters (e.g., { 'patient': 'UUID', '_count': 10 })" },
          },
          required: ["resourceType"],
        },
      },
      {
        name: "fhir_read",
        description: "Read a specific FHIR resource by its type and ID.",
        inputSchema: {
          type: "object",
          properties: {
            resourceType: { type: "string" },
            id: { type: "string" },
          },
          required: ["resourceType", "id"],
        },
      },
      {
        name: "fhir_get_patient_history",
        description: "Convenience tool to fetch all clinical data (Observations, Conditions, MedicationRequests) for a patient.",
        inputSchema: {
          type: "object",
          properties: {
            patientId: { type: "string", description: "The UUID of the patient" },
          },
          required: ["patientId"],
        },
      },
    ],
  };
});

/**
 * Handle execution of tools.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "fhir_search") {
      const { resourceType, parameters = {} } = args as any;
      const searchParams = new URLSearchParams(parameters as any);
      const url = `${BAHMNI_URL}${resourceType}?${searchParams.toString()}`;
      
      const response = await fetch(url, { headers: getHeaders() });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    if (name === "fhir_read") {
      const { resourceType, id } = args as any;
      const url = `${BAHMNI_URL}${resourceType}/${id}`;
      
      const response = await fetch(url, { headers: getHeaders() });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    if (name === "fhir_get_patient_history") {
      const { patientId } = args as any;
      // Fetch several key clinical resources in parallel
      const resources = ["Observation", "Condition", "MedicationRequest", "AllergyIntolerance"];
      const results = await Promise.all(
        resources.map(async (resType) => {
          const url = `${BAHMNI_URL}${resType}?patient=${patientId}`;
          const response = await fetch(url, { headers: getHeaders() });
          return { [resType]: await response.json() };
        })
      );
      
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `FHIR Error: ${error.message}` }],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Aegis-FHIR-MCP running on stdio");
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
