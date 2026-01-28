
import { GoogleGenAI, Type } from "@google/genai";
import { FHIRResource, Insight, ResourceType } from "../types";
import { SYSTEM_INSTRUCTION_PARSER, SYSTEM_INSTRUCTION_REASONER } from "../constants";

/**
 * Initialize Gemini API client using the environment variable API_KEY.
 * Always using named parameters for initialization.
 */
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 辅助方法：从报告中提取时间轴节点
 * 用于从生成的 Markdown 报告中提取关键医疗事件并同步到左侧时间轴。
 */
function extractResourcesFromReport(report: string): FHIRResource[] {
  const resources: FHIRResource[] = [];
  const lines = report.split('\n');
  
  lines.forEach(line => {
    // 匹配常见的日期格式：YYYY-MM-DD, YYYY/MM/DD, 或 YYYY年MM月DD日
    const dateMatch = line.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
    if (dateMatch && (line.includes('检') || line.includes('诊') || line.includes('院') || line.includes('报告'))) {
      resources.push({
        id: Math.random().toString(36).substring(2, 11),
        resourceType: line.includes('检') ? ResourceType.OBSERVATION : ResourceType.CONDITION,
        timestamp: dateMatch[0].replace(/[年月]/g, '-').replace('日', ''),
        display: line.replace(dateMatch[0], '').replace(/[#*>-]/g, '').trim().substring(0, 50)
      });
    }
  });
  return resources;
}

/**
 * 处理多格式医疗文档 (使用 Gemini 3 Pro)
 * 支持文本、图片或 PDF 转换的 base64 图像。
 */
export const processMedicalRecord = async (
  file?: { data: string; mimeType: string },
  textContent?: string
): Promise<{ report: string; resources: FHIRResource[] }> => {
  const parts: any[] = [];
  
  if (textContent) {
    parts.push({ text: `Additional Record Text: ${textContent}` });
  }
  
  if (file) {
    parts.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType,
      },
    });
  }

  try {
    // Gemini 3 Pro is selected for complex multi-modal medical parsing and clinical director reasoning tasks.
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_PARSER,
      },
    });

    const reportText = response.text || "";
    const resources = extractResourcesFromReport(reportText);

    return { report: reportText, resources };
  } catch (err) {
    console.error("Gemini API Error (Parsing):", err);
    throw new Error("Gemini 临床引擎解析失败，请检查病历清晰度或网络连接。");
  }
};

/**
 * 生成临床洞察 (利用 Gemini 3 Pro 深度推理)
 * 使用 responseSchema 强制模型返回结构化 JSON。
 */
export const generateMedicalInsights = async (history: FHIRResource[]): Promise<Insight[]> => {
  if (history.length === 0) return [];
  const historyText = JSON.stringify(history);
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Based on this medical history, generate structured clinical insights. \nData: ${historyText}`,
      config: {
        systemInstruction: "You are a professional clinical medical analyst. Return a JSON array of insight objects. Each object MUST strictly follow the Insight interface.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { 
                type: Type.STRING, 
                description: "Must be exactly one of: WARNING, INFO, CAUSAL" 
              },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              sourceIds: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Array of resource IDs from the provided history that support this insight."
              },
            },
            required: ["id", "type", "title", "description", "sourceIds"],
          },
        },
      },
    });

    const jsonStr = response.text || "[]";
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Insights Generation Error:", e);
    return [];
  }
};

/**
 * 临床顾问问答
 */
export const askMedicalQuestion = async (question: string, context: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `CONTEXT:\n${context}\n\nUSER QUESTION: ${question}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_REASONER,
      },
    });
    return response.text || "暂无建议。";
  } catch (e) {
    console.error("Consultation Error:", e);
    return "智能辅助诊断服务暂时不可用，请稍后重试。";
  }
};
