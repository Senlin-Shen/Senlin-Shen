
import { FHIRResource, ResourceType } from "../types";
import { SYSTEM_INSTRUCTION_PARSER, SYSTEM_INSTRUCTION_REASONER } from "../constants";

/**
 * 豆包（火山引擎）API 配置 - OpenAI 兼容模式
 */
const DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
// 根据系统要求，API Key 统一从 process.env.API_KEY 获取
const API_KEY = process.env.API_KEY; 
// 推理接入点 ID (EP ID)
const MODEL_ID = (process.env as any).VITE_DOUBAO_MODEL_ID || "ep-placeholder";

/**
 * 辅助方法：流式解析响应
 */
async function handleStreamingResponse(
  response: Response,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  if (!reader) throw new Error("无法读取流数据");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content || "";
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
  return fullText;
}

/**
 * 通用豆包 API 请求封装
 */
async function callDoubaoStream(
  messages: any[],
  onChunk: (text: string) => void
): Promise<string> {
  if (!API_KEY) throw new Error("API_KEY 未配置，请在 Vercel 环境变量中设置。");

  const response = await fetch(DOUBAO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: messages,
      temperature: 0.1,
      stream: true
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API 错误 (${response.status}): ${errorBody}`);
  }

  return await handleStreamingResponse(response, onChunk);
}

/**
 * 结构化解析辅助
 */
export function extractResourcesFromText(text: string): FHIRResource[] {
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
 * 解析医疗文档（流式 + 多模态）
 */
export const processMedicalRecordStream = async (
  files: { data: string; mimeType: string }[],
  onChunk: (text: string) => void
): Promise<string> => {
  const contentParts: any[] = [{ type: "text", text: "请基于以下图片内容生成结构化临床报告：" }];
  
  files.forEach(file => {
    contentParts.push({
      type: "image_url",
      image_url: { url: `data:${file.mimeType};base64,${file.data}` }
    });
  });

  return await callDoubaoStream([
    { role: "system", content: SYSTEM_INSTRUCTION_PARSER },
    { role: "user", content: contentParts }
  ], onChunk);
};

/**
 * 临床咨询问答（流式）
 */
export const askMedicalQuestionStream = async (
  question: string,
  context: string,
  onChunk: (text: string) => void
): Promise<string> => {
  return await callDoubaoStream([
    { role: "system", content: SYSTEM_INSTRUCTION_REASONER },
    { role: "user", content: `背景上下文:\n${context}\n\n当前提问: ${question}` }
  ], onChunk);
};

/**
 * 同步方法仅用于 JSON 洞察（豆包不支持流式返回纯 JSON）
 */
export const generateMedicalInsights = async (history: FHIRResource[]): Promise<any> => {
  if (history.length === 0) return [];
  const response = await fetch(DOUBAO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [
        { role: "system", content: "你是一个临床专家。请直接返回 JSON 数组格式的洞察，包含 id, type, title, description 字段。" },
        { role: "user", content: `分析历史记录并返回 JSON: ${JSON.stringify(history)}` }
      ],
      response_format: { type: "json_object" }
    })
  });
  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content.replace(/```json/g, '').replace(/```/g, ''));
};
