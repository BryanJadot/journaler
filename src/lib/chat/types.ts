export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'developer';
  content: string;
  createdAt: string;
};
