
import { GoogleGenAI, Type } from "@google/genai";
import { FHIRResource, Insight, ResourceType } from "../types";
import { SYSTEM_INSTRUCTION_PARSER, SYSTEM_INSTRUCTION_REASONER } from "../constants";

// 初始化 Gemini 客户端，必须从 process.env.API_KEY 获取密钥
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 辅助方法：从报告文本中正则提取临床事件，用于左侧时间轴同步
 */
function extractResources(text: string): FHIRResource[] {
  const resources: FHIRResource[] = [];
  const lines = text.split('\n');
  lines.forEach(line => {
    const dateMatch = line.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
    if (dateMatch && (line.includes('检') || line.includes('诊') || line.includes('院') || line.includes('报告'))) {
      resources.push({
        id: Math.random().toString(36).substring(2, 9),
        resourceType: line.includes('检') ? ResourceType.OBSERVATION : ResourceType.CONDITION,
        timestamp: dateMatch[0].replace(/[年月]/g, '-').replace('日', ''),
        display: line.replace(dateMatch[0], '').replace(/[#*>-]/g, '').trim().substring(0, 50)
      });
    }
  });
  return resources;
}

/**
 * 核心解析函数：支持多张图片同时解析
 */
export const processMedicalRecord = async (
  files: { data: string; mimeType: string }[],
  textContent?: string
): Promise<{ report: string; resources: FHIRResource[] }> => {
  const parts: any[] = [];
  
  if (textContent) {
    parts.push({ text: `Context: ${textContent}` });
  }
  
  files.forEach(file => {
    parts.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType,
      },
    });
  });

  try {
    // Correctly using ai.models.generateContent with model name and multi-part contents object
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_PARSER,
        temperature: 0.1,
      },
    });

    const reportText = response.text || "";
    return {
      report: reportText,
      resources: extractResources(reportText)
    };
  } catch (err: any) {
    console.error("Gemini Parsing Error:", err);
    throw new Error(`临床解析引擎异常: ${err.message || "未知错误"}`);
  }
};

/**
 * 生成临床洞察：使用 responseSchema 强制返回 JSON
 */
export const generateMedicalInsights = async (history: FHIRResource[]): Promise<Insight[]> => {
  if (history.length === 0) return [];
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [{ text: `分析以下病历历史并生成 Insight 数组：\n${JSON.stringify(history)}` }] },
      config: {
        systemInstruction: "你是一个资深临床专家。请分析历史并返回 JSON 数组，必须符合 Insight 接口定义。不要输出 JSON 以外的内容。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING, description: "WARNING, INFO, 或 CAUSAL" },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              sourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["id", "type", "title", "description", "sourceIds"],
          },
        },
      },
    });

    // response.text property directly returns the extracted string output
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Insights Error:", e);
    return [];
  }
};

/**
 * 临床对话：支持图片追问
 */
export const askMedicalQuestion = async (
  question: string, 
  context: string, 
  images?: { data: string, mimeType: string }[]
): Promise<string> => {
  const parts: any[] = [{ text: `背景上下文:\n${context}\n\n问题: ${question}` }];
  
  if (images) {
    images.forEach(img => parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } }));
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: { systemInstruction: SYSTEM_INSTRUCTION_REASONER },
    });
    return response.text || "未能生成有效建议。";
  } catch (e: any) {
    return `对话请求失败: ${e.message}`;
  }
};
