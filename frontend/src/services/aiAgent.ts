

export interface AIMessage {
  type: 'user' | 'ai';
  text: string;
  timestamp: number;
  metadata?: any;
}

export interface AIResponse {
  text: string;
  action?: string;
  metadata?: any;
}

class AIAgentService {
  private baseUrl: string;
  private isConnected: boolean = false;
  private listeners: ((message: AIMessage) => void)[] = [];

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      this.isConnected = response.ok;
      return this.isConnected;
    } catch (error) {
      console.error('Failed to connect to AI Agent:', error);
      this.isConnected = false;
      return false;
    }
  }

  async sendMessage(message: string): Promise<AIResponse> {
    if (!this.isConnected) {
      throw new Error('AI Agent not connected. Please ensure agent service is running.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.text || data.response || 'No response from AI agent',
        action: data.action,
        metadata: data.metadata
      };
    } catch (error) {
      console.error('Failed to communicate with AI agent:', error);
      throw error;
    }
  }

  onMessage(listener: (message: AIMessage) => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: (message: AIMessage) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  processIncomingMessage(message: any) {
    const aiMessage: AIMessage = {
      type: 'ai',
      text: message.text,
      timestamp: message.timestamp || Date.now(),
      metadata: message.metadata || { type: 'notification' }
    };
    
    this.listeners.forEach(listener => listener(aiMessage));
  }

  getStatus(): { connected: boolean; url: string } {
    return {
      connected: this.isConnected,
      url: this.baseUrl
    };
  }
}

export const aiAgentService = new AIAgentService(
  process.env.NEXT_PUBLIC_AI_AGENT_URL || 'http://localhost:3001'
);

if (typeof window !== 'undefined') {
  aiAgentService.connect().then((connected) => {
    console.log(`AI Agent Service initialized. Connected: ${connected}`);
  });
}
