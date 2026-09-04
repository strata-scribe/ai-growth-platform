export interface AgentService {
  slug: string;
  price_usdc?: number;
  category: string;
  [key: string]: unknown;
}

export interface AgentPaymentInfo {
  protocol: string;
  network: string;
  token: string;
  contract?: string;
  wallet?: string;
  [key: string]: unknown;
}

export interface ScoutedAgent {
  agent_id: string;
  name: string;
  description?: string;
  url?: string;
  protocols: string[];
  endpoints: Record<string, string>;
  payment?: AgentPaymentInfo;
  services: AgentService[];
  capabilities: string[];
  lastScanned: number;
}

export class AgentScout {
  private cache: Map<string, ScoutedAgent>;

  constructor() {
    this.cache = new Map<string, ScoutedAgent>();
  }

  /**
   * Scans a single public A2A/Agentverse endpoint and caches the result
   */
  async scanEndpoint(endpointUrl: string): Promise<ScoutedAgent | null> {
    try {
      const response = await fetch(endpointUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch from ${endpointUrl}: ${response.statusText}`);
      }

      const data = await response.json();

      // Basic validation for agent format
      if (!data.agent_id) {
        console.warn(`Invalid data from ${endpointUrl}: missing agent_id`);
        return null;
      }

      const agent: ScoutedAgent = {
        agent_id: data.agent_id,
        name: data.name || data.agent_id,
        description: data.description,
        url: data.url,
        protocols: data.protocols || [],
        endpoints: data.endpoints || {},
        payment: data.payment,
        services: data.services || [],
        capabilities: data.capabilities || [],
        lastScanned: Date.now(),
      };

      this.cache.set(agent.agent_id, agent);
      return agent;

    } catch (error) {
      console.error(`Error scanning endpoint ${endpointUrl}:`, error);
      return null;
    }
  }

  /**
   * Scans multiple endpoints concurrently
   */
  async scanRegistry(endpoints: string[]): Promise<ScoutedAgent[]> {
    const results = await Promise.all(
      endpoints.map(endpoint => this.scanEndpoint(endpoint))
    );

    return results.filter((agent): agent is ScoutedAgent => agent !== null);
  }

  /**
   * Retrieves an agent from the local cache
   */
  getAgent(agentId: string): ScoutedAgent | undefined {
    return this.cache.get(agentId);
  }

  /**
   * Retrieves all agents currently indexed in the local cache
   */
  getAllAgents(): ScoutedAgent[] {
    return Array.from(this.cache.values());
  }

  /**
   * Finds agents by a specific capability or service category
   */
  findAgentsByCapability(capability: string): ScoutedAgent[] {
    return this.getAllAgents().filter(agent =>
      agent.capabilities.includes(capability) ||
      agent.services.some(service => service.category === capability)
    );
  }

  /**
   * Finds agents offering a specific service by slug
   */
  findAgentsByService(serviceSlug: string): ScoutedAgent[] {
    return this.getAllAgents().filter(agent =>
      agent.services.some(service => service.slug === serviceSlug)
    );
  }

  /**
   * Clears the local cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export a singleton instance
export const scout = new AgentScout();
