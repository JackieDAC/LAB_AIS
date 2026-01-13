import { GoogleGenAI } from "@google/genai";
import { StageType } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateStageSuggestions = async (stage: StageType, projectContext: string): Promise<string> => {
  const client = getClient();
  if (!client) return "API Key not configured.";

  const prompt = `
    I am a student working on a Design Thinking project.
    Project Description: ${projectContext}
    Current Stage: ${stage}

    Please provide 3-5 specific, actionable suggestions or checklist items for this stage.
    For Empathize, suggest interview questions.
    For Define, suggest problem statements.
    For Ideate, suggest brainstorming triggers.
    For Prototype, suggest low-fidelity methods.
    For Test, suggest user feedback questions.
    
    Format the output as a simple Markdown list.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No suggestions generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate suggestions. Please try again later.";
  }
};

export const analyzeFeedback = async (feedback: string, score: number): Promise<string> => {
  const client = getClient();
  if (!client) return "";

  const prompt = `
    As a supportive tutor, summarize this instructor feedback for a student in one encouraging sentence.
    Score given: ${score}/10.
    Feedback: ${feedback}
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    return "";
  }
};