
import { FHIRResource, Insight } from "../types";
import { SYSTEM_INSTRUCTION_PARSER, SYSTEM_INSTRUCTION_REASONER } from "../constants";

const DOUBAO_API_URL = "https://ark.cn-beijing.volces.com/api/v3/responses";
const DOUBAO_MODEL_ID = "doubao-seed-1-8-251228"; 

async function callDoubao(input: any[]): Promise<string> {
  try {
    const response = await fetch(DOUBAO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.API_KEY}`
      },
      body: JSON.stringify({
        model: DOUBAO_MODEL_ID,
        input: input
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Doubao API Error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    // 兼容豆包 v3/responses 结构
    return data.output?.text || (data.choices && data.choices[0]?.message?.content) || "";
  } catch (err) {
    console.error("API Call Failed:", err);
    throw err;
  }
}

/**
 * 核心解析流程：生成标准化报告并提取 FHIR 数据
 */
export const processMedicalRecord = async (fileData?: { data: string, mimeType: string }, textContent?: string): Promise<{ report: string, resources: FHIRResource[] }> => {
  const content: any[] = [
    { type: "input_text", text: SYSTEM_INSTRUCTION_PARSER }
  ];

  if (fileData) {
    content.push({ 
      type: "input_image", 
      image_url: `data:${fileData.mimeType};base64,${fileData.data}` 
    });
  } 
  
  if (textContent) {
    content.push({ type: "input_text", text: `病历资料内容：\n${textContent}` });
  }

  const inputPayload = [{ role: "user", content }];

  try {
    const reportText = await callDoubao(inputPayload);
    
    // 异步提取 FHIR 结构（为了不阻塞报告显示，我们可以做一个简单的正则提取或再次调用低成本模型）
    // 在本原型中，我们将 report 本身作为输出，并尝试从中推断核心节点
    const resources: FHIRResource[] = [];
    
    // 简单的解析逻辑：从 Markdown 标题或列表提取日期和事件作为时间轴节点
    const lines = reportText.split('\n');
    lines.forEach(line => {
      const dateMatch = line.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
      if (dateMatch) {
        resources.push({
          id: Math.random().toString(36).substr(2, 9),
          resourceType: 'Observation' as any,
          timestamp: dateMatch[0].replace(/[年月]/g, '-').replace('日', ''),
          display: line.replace(dateMatch[0], '').replace(/[#*>-]/g, '').trim().substring(0, 40)
        });
      }
    });

    return { report: reportText, resources };
  } catch (e) {
    console.error("多模态梳理失败:", e);
    return { report: "解析失败，请检查 API 配置或网络。", resources: [] };
  }
};

export const generateMedicalInsights = async (history: FHIRResource[]): Promise<Insight[]> => {
  const historyText = JSON.stringify(history);
  const inputPayload = [{
    role: "user",
    content: [
      { type: "input_text", text: SYSTEM_INSTRUCTION_REASONER },
      { type: "input_text", text: `基于以下历史记录数组，生成 3 条临床警告或因果分析 JSON：\n${historyText}` }
    ]
  }];
  try {
    const res = await callDoubao(inputPayload);
    const jsonMatch = res.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : "[]");
  } catch (e) { return []; }
};

export const askMedicalQuestion = async (question: string, context: string): Promise<string> => {
  const inputPayload = [{
    role: "user",
    content: [
      { type: "input_text", text: SYSTEM_INSTRUCTION_REASONER },
      { type: "input_text", text: `当前病历报告上下文：\n${context}\n\n用户提问：${question}` }
    ]
  }];
  return await callDoubao(inputPayload);
};
