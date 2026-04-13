export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  pending?: boolean;
}

export interface Session {
  id: string;
  title: string;
  updatedAt: string;
  archived: boolean;
  modelId: string;
  messages: ChatMessage[];
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export interface AppSettings {
  serverUrl: string;
  defaultModelId: string;
}

export interface PersistedState {
  sessions: Session[];
  favoriteModelIds: string[];
  settings: AppSettings;
}
