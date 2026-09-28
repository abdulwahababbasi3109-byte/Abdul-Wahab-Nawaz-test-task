export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiCompletion {
  id: string;
  model: string;
  answer: string;
  finishReason: string;
  usage: TokenUsage;
}
