export type MessageRole = 'user' | 'model';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  type: 'text' | 'code' | 'search';
  timestamp: number;
  groundingMetadata?: any;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}
