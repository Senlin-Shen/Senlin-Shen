
import { FHIRResource, Insight, ResourceType } from "../types";
import { SYSTEM_INSTRUCTION_PARSER, SYSTEM_INSTRUCTION_REASONER } from "../constants";

const DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
// Prioritize process.env.API_KEY as per the core instruction for the key.
const API_KEY = process.env.API_KEY;
// Use model ID from environment if available.
const MODEL_ID = (process.env as any).VITE_DOUBAO_MODEL_ID || "doubao-pro-32k";

/**
 * 辅助方法：从报告中提取时间轴节点
 */
function extractResourcesFromReport(report: string): FHIRResource[] {
  const resources: FHIRResource[] = [];
  const lines = report.split('\n');
  
  lines.forEach(line => {
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
 * 通用豆包 API 调用封装
 */
async function callDoubao(messages: any[]) {
  const response = await fetch(DOUBAO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: messages,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
    throw new Error(error.message || `API 请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 处理多格式医疗文档 (使用豆包多模态能力)
 */
export const processMedicalRecord = async (
  files: { data: string; mimeType: string }[],
  textContent?: string
): Promise<{ report: string; resources: FHIRResource[] }> => {
  const content: any[] = [{ type: "text", text: textContent || "请解析以下病历资料，生成多维度标准化报告。" }];
  
  files.forEach(file => {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${file.mimeType};base64,${file.data}`
      }
    });
  });

  try {
    const reportText = await callDoubao([
      { role: "system", content: SYSTEM_INSTRUCTION_PARSER },
      { role: "user", content: content }
    ]);

    const resources = extractResourcesFromReport(reportText);
    return { report: reportText, resources };
  } catch (err: any) {
    console.error("Doubao API Error (Parsing):", err);
    throw new Error(`解析失败: ${err.message}`);
  }
};

/**
 * 生成临床洞察
 */
export const generateMedicalInsights = async (history: FHIRResource[]): Promise<Insight[]> => {
  if (history.length === 0) return [];
  const historyText = JSON.stringify(history);
  
  try {
    const prompt = `基于以下医疗历史，生成结构化的临床洞察。
请务必返回一个且仅一个 JSON 数组，包含 Insight 对象。格式严格如下:
[{"id": "...", "type": "WARNING/INFO/CAUSAL", "title": "...", "description": "...", "sourceIds": ["..."]}]
数据: ${historyText}`;

    const jsonStr = await callDoubao([
      { role: "system", content: "你是一个专业的临床医学分析师。只返回纯净的 JSON 数组，不要包含任何解释文字。" },
      { role: "user", content: prompt }
    ]);

    const cleaned = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Insights Generation Error:", e);
    return [];
  }
};

/**
 * 临床顾问问答
 */
export const askMedicalQuestion = async (question: string, context: string, images?: { data: string, mimeType: string }[]): Promise<string> => {
  try {
    const userContent: any[] = [{ type: "text", text: `背景上下文:\n${context}\n\n我的问题: ${question}` }];
    
    if (images) {
      images.forEach(img => {
        userContent.push({
          type: "image_url",
          image_url: {
            url: `data:${img.mimeType};base64,${img.data}`
          }
        });
      });
    }

    return await callDoubao([
      { role: "system", content: SYSTEM_INSTRUCTION_REASONER },
      { role: "user", content: userContent }
    ]);
  } catch (e: any) {
    console.error("Consultation Error:", e);
    return `智能助理暂时无法回答: ${e.message}`;
  }
};
