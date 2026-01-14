
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION_PARSER, SYSTEM_INSTRUCTION_REASONER, FHIR_PARSER_SCHEMA } from "../constants";
import { FHIRResource, Insight } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 第一阶段：数据解析引擎
 * 将非结构化输入转化为 FHIR 结构
 */
export const parseMedicalRecord = async (input: string | { data: string, mimeType: string }): Promise<FHIRResource[]> => {
  const ai = getAI();
  const contents = typeof input === 'string' 
    ? input 
    : { parts: [{ inlineData: input }, { text: "请解析此医疗记录为 FHIR 格式 JSON" }] };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_PARSER,
      responseMimeType: "application/json"
    }
  });

  try {
    const data = JSON.parse(response.text);
    return data.resources || [];
  } catch (e) {
    console.error("解析 FHIR JSON 失败", e);
    return [];
  }
};

/**
 * 第二/四阶段：时间轴推理与 RAG 问答
 */
export const generateMedicalInsights = async (history: FHIRResource[]): Promise<Insight[]> => {
  const ai = getAI();
  const historyText = JSON.stringify(history);
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `基于以下病历历史，生成 3-5 条关键医学洞察：\n${historyText}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_REASONER,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["WARNING", "INFO", "CAUSAL"] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            sourceIds: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["id", "type", "title", "description"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const askMedicalQuestion = async (question: string, history: FHIRResource[]): Promise<string> => {
  const ai = getAI();
  const historyText = JSON.stringify(history);
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `历史病历数据：\n${historyText}\n\n用户问题：${question}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_REASONER,
      thinkingConfig: { thinkingBudget: 4000 }
    }
  });

  return response.text || "抱歉，无法生成分析结果。";
};
