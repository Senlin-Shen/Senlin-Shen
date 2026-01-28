
import { FHIRResource, Insight, ResourceType } from "../types";
import { SYSTEM_INSTRUCTION_PARSER, SYSTEM_INSTRUCTION_REASONER } from "../constants";

/**
 * 豆包（火山引擎）API 配置
 */
const DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const API_KEY = process.env.API_KEY; // 从 Vercel 环境变量获取
const MODEL_ID = (process.env as any).VITE_DOUBAO_MODEL_ID || "doubao-pro-32k"; // 推理接入点 ID

/**
 * 通用豆包 API 请求封装（OpenAI 兼容格式）
 */
async function callDoubao(messages: any[], responseFormat?: string) {
  if (!API_KEY) {
    throw new Error("未配置 API_KEY，请在 Vercel 后台检查环境变量。");
  }

  const body: any = {
    model: MODEL_ID,
    messages: messages,
    temperature: 0.1,
  };

  if (responseFormat === "json_object") {
    // 豆包部分模型支持通过提示词强制 JSON，这里在 body 中也做标记
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(DOUBAO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `API 请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 辅助方法：从生成的报告中提取临床事件
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
 * 解析医疗文档（多模态：支持批量图片）
 */
export const processMedicalRecord = async (
  files: { data: string; mimeType: string }[],
  textContent?: string
): Promise<{ report: string; resources: FHIRResource[] }> => {
  const contentParts: any[] = [];
  
  if (textContent) {
    contentParts.push({ type: "text", text: `病历文本内容: ${textContent}` });
  }
  
  files.forEach(file => {
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${file.mimeType};base64,${file.data}`
      }
    });
  });

  if (contentParts.length === 0) {
    contentParts.push({ type: "text", text: "请解析当前病历资料。" });
  }

  try {
    const reportText = await callDoubao([
      { role: "system", content: SYSTEM_INSTRUCTION_PARSER },
      { role: "user", content: contentParts }
    ]);

    return {
      report: reportText,
      resources: extractResources(reportText)
    };
  } catch (err: any) {
    console.error("Doubao Parsing Error:", err);
    throw err;
  }
};

/**
 * 生成临床洞察（JSON 结构化输出）
 */
export const generateMedicalInsights = async (history: FHIRResource[]): Promise<Insight[]> => {
  if (history.length === 0) return [];
  
  try {
    const prompt = `分析以下临床事件并生成 Insight JSON 数组。
要求：
1. 识别潜在风险 (WARNING) 或因果关联 (CAUSAL)。
2. 严格返回 JSON 格式，不要有 Markdown 标记。
数据：${JSON.stringify(history)}`;

    const jsonStr = await callDoubao([
      { role: "system", content: "你是一个资深临床专家。只返回 JSON 数组，包含 id, type (WARNING/INFO/CAUSAL), title, description, sourceIds 字段。" },
      { role: "user", content: prompt }
    ], "json_object");

    // 清理 Markdown 代码块包裹
    const cleaned = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Insights Error:", e);
    return [];
  }
};

/**
 * 临床咨询问答（支持追问图片）
 */
export const askMedicalQuestion = async (
  question: string, 
  context: string, 
  images?: { data: string, mimeType: string }[]
): Promise<string> => {
  const contentParts: any[] = [{ type: "text", text: `背景上下文:\n${context}\n\n我的提问: ${question}` }];
  
  if (images) {
    images.forEach(img => {
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}` }
      });
    });
  }

  try {
    return await callDoubao([
      { role: "system", content: SYSTEM_INSTRUCTION_REASONER },
      { role: "user", content: contentParts }
    ]);
  } catch (e: any) {
    return `对话失败: ${e.message}`;
  }
};
