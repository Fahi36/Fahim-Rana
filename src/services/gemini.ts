import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const MODELS = {
  CODING: "gemini-3.1-pro-preview",
  SEARCH: "gemini-3-flash-preview",
  GENERAL: "gemini-3.1-pro-preview",
};

export async function* sendMessageStream(
  history: Message[],
  userMessage: string,
  mode: 'coding' | 'search' | 'general',
  dateRange: string = 'anytime'
) {
  // Model selection based on mode
  let model = MODELS.GENERAL;
  if (mode === 'coding') model = MODELS.CODING;
  if (mode === 'search') model = MODELS.SEARCH;
  
  // Prepare contents for the API
  const contents = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));
  
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  let systemPrompt = "You are RANA, an advanced AI assistant. Be helpful, articulate, and objective.";
  if (mode === 'coding') {
    systemPrompt = "You are RANA, an expert software architect and senior developer. When asked for code, provide functional, clean, and well-commented code blocks. ALWAYS follow code with a 'Logic Breakdown' or 'Architecture Explanation' section. Prefer modern patterns and best practices.";
  } else if (mode === 'search') {
    const rangeText = dateRange === 'anytime' ? "any time" : `the last ${dateRange.replace('past-', '')}`;
    systemPrompt = `You are RANA, an advanced search assistant. Use the provided tools to find up-to-date information strictly focusing on information from ${rangeText}. Synthesize answers with clear citations. Be concise and accurate. Today's date is ${new Date().toLocaleDateString()}.`;
  } else if (mode === 'general') {
    systemPrompt = "You are RANA, a creative and highly intelligent general assistant similar to Claude or GPT-4. You excel at creative writing, complex reasoning, and providing nuanced, empathetic responses. Maintain a professional yet approachable tone.";
  }

  const config: any = {
    systemInstruction: systemPrompt,
    tools: mode === 'search' ? [{ googleSearch: {} }] : [],
    ...(mode === 'search' ? { toolConfig: { includeServerSideToolInvocations: true } } : {})
  };

  const result = await ai.models.generateContentStream({
    model,
    contents,
    config
  });

  for await (const chunk of result) {
    if (chunk.text) {
      yield {
        text: chunk.text,
        groundingMetadata: chunk.candidates?.[0]?.groundingMetadata
      };
    }
  }
}
