
import { FHIRResource, ResourceType } from "../types";
import { SYSTEM_INSTRUCTION_PARSER, SYSTEM_INSTRUCTION_REASONER } from "../constants";

/**
 * 豆包（火山引擎）API 配置 - OpenAI 兼容模式
 */
const DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

// 优先使用用户指定的 VITE_ 变量，回退到系统标准 process.env.API_KEY
const API_KEY = (process.env as any).VITE_DOUBAO_API_KEY || process.env.API_KEY;
const MODEL_ID = (process.env as any).VITE_DOUBAO_MODEL_ID;

/**
 * 辅助方法：流式解析 SSE 响应
 */
async function handleStreamingResponse(
  response: Response,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  if (!reader) throw new Error("无法初始化数据读取流，请检查网络连接。");

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
          // 忽略单行解析错误
        }
      }
    }
  }
  return fullText;
}

/**
 * 通用豆包 API 请求封装（支持流式输出）
 */
async function callDoubaoStream(
  messages: any[],
  onChunk: (text: string) => void
): Promise<string> {
  if (!API_KEY) throw new Error("API_KEY (VITE_DOUBAO_API_KEY) 未配置。");
  if (!MODEL_ID) throw new Error("MODEL_ID (VITE_DOUBAO_MODEL_ID) 未配置。");

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
    let errorDetail = errorBody;
    try {
      const errJson = JSON.parse(errorBody);
      errorDetail = errJson.error?.message || errorBody;
    } catch(e) {}
    throw new Error(`豆包引擎异常 (${response.status}): ${errorDetail}`);
  }

  return await handleStreamingResponse(response, onChunk);
}

/**
 * 结构化解析辅助：从文本提取临床事件
 */
export function extractResourcesFromText(text: string): FHIRResource[] {
  const resources: FHIRResource[] = [];
  const lines = text.split('\n');
  lines.forEach(line => {
    // 匹配日期格式 YYYY-MM-DD 或 YYYY年MM月DD日
    const dateMatch = line.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
    if (dateMatch && (line.includes('检') || line.includes('诊') || line.includes('院') || line.includes('报告') || line.includes('化验'))) {
      resources.push({
        id: Math.random().toString(36).substring(2, 9),
        resourceType: (line.includes('检') || line.includes('化验')) ? ResourceType.OBSERVATION : ResourceType.CONDITION,
        timestamp: dateMatch[0].replace(/[年月]/g, '-').replace('日', '').trim(),
        display: line.replace(dateMatch[0], '').replace(/[#*>-]/g, '').trim().substring(0, 50)
      });
    }
  });
  return resources;
}

/**
 * 解析医疗文档（流式 + 多模态图片）
 */
export const processMedicalRecordStream = async (
  files: { data: string; mimeType: string }[],
  onChunk: (text: string) => void
): Promise<string> => {
  const contentParts: any[] = [
    { type: "text", text: "请基于以下提供的临床资料图片，进行结构化深度解析。请遵循系统提示词中的三个专业视角给出报告。" }
  ];
  
  files.forEach(file => {
    contentParts.push({
      type: "image_url",
      image_url: { 
        url: `data:${file.mimeType};base64,${file.data}`,
        detail: "high"
      }
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
    { role: "user", content: `当前临床上下文：\n${context}\n\n我的提问：${question}` }
  ], onChunk);
};

/**
 * 同步方法仅用于生成 JSON 洞察
 */
export const generateMedicalInsights = async (history: FHIRResource[]): Promise<any> => {
  if (history.length === 0 || !API_KEY || !MODEL_ID) return [];
  
  try {
    const response = await fetch(DOUBAO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: "你是一个临床洞察专家。请分析历史记录并返回一个 JSON 数组。数组中的每个对象应包含 id, type (WARNING/INFO/CAUSAL), title, description 字段。仅返回 JSON。" },
          { role: "user", content: `临床历史数据：${JSON.stringify(history)}` }
        ],
        response_format: { type: "json_object" }
      })
    });
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (e) {
    console.warn("洞察生成失败:", e);
    return [];
  }
};
