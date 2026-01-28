
import { FHIRResource, Insight } from "../types";
import { SYSTEM_INSTRUCTION_PARSER, SYSTEM_INSTRUCTION_REASONER } from "../constants";

// 火山引擎 Ark 配置
// 注意：API_KEY 从环境变量获取。MODEL 名称通常需要替换为您在火山引擎创建的 Endpoint ID
const ARK_API_KEY = process.env.API_KEY;
const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

// 默认 Endpoint ID (请根据您的火山方舟后台进行相应配置)
const MODEL_VISION = "doubao-vision-pro-240528"; // 假设的 Vision 模型 Endpoint
const MODEL_PRO = "doubao-pro-4k-240528";      // 假设的文本推理模型 Endpoint

/**
 * 核心请求封装
 */
async function callArk(messages: any[], model: string, jsonMode: boolean = false) {
  try {
    const response = await fetch(ARK_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.1,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "请求火山引擎失败");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error("Ark API Error:", err);
    throw err;
  }
}

/**
 * 处理多格式医疗文档 (使用豆包多模态能力)
 */
export const processMedicalRecord = async (
  file?: { data: string; mimeType: string },
  textContent?: string
): Promise<{ report: string; resources: FHIRResource[] }> => {
  const content: any[] = [{ type: "text", text: SYSTEM_INSTRUCTION_PARSER }];

  if (file) {
    // 豆包 Vision API 接收 base64 图片格式
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${file.mimeType};base64,${file.data}`,
      },
    });
  }

  if (textContent) {
    content.push({ type: "text", text: `附加文本内容：\n${textContent}` });
  }

  try {
    const reportText = await callArk([{ role: "user", content }], MODEL_VISION);
    
    // 自动提取时间轴资源节点
    const resources = extractResourcesFromReport(reportText);

    return { report: reportText, resources };
  } catch (err) {
    throw new Error("豆包临床引擎解析失败，请检查 API 配置或网络环境。");
  }
};

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
        id: Math.random().toString(36).substr(2, 9),
        resourceType: line.includes('检') ? 'Observation' as any : 'Condition' as any,
        timestamp: dateMatch[0].replace(/[年月]/g, '-').replace('日', ''),
        display: line.replace(dateMatch[0], '').replace(/[#*>-]/g, '').trim().substring(0, 50)
      });
    }
  });
  return resources;
}

/**
 * 生成临床洞察 (利用豆包深度推理)
 */
export const generateMedicalInsights = async (history: FHIRResource[]): Promise<Insight[]> => {
  if (history.length === 0) return [];
  const historyText = JSON.stringify(history);
  
  try {
    const prompt = `基于以下医疗历史记录，生成临床洞察。
请务必返回 JSON 格式的数组，每个对象包含: id, type (WARNING|INFO|CAUSAL), title, description, sourceIds。
数据记录：\n${historyText}`;

    const response = await callArk([
      { role: "system", content: "你是一个专业的临床医学分析师，只输出 JSON。" },
      { role: "user", content: prompt }
    ], MODEL_PRO, true);

    return JSON.parse(response || "[]");
  } catch (e) {
    return [];
  }
};

/**
 * 临床顾问问答
 */
export const askMedicalQuestion = async (question: string, context: string): Promise<string> => {
  try {
    return await callArk([
      { role: "system", content: SYSTEM_INSTRUCTION_REASONER },
      { role: "user", content: `上下文报告：\n${context}\n\n问题：${question}` }
    ], MODEL_PRO);
  } catch (e) {
    return "咨询服务暂时不可用。";
  }
};
