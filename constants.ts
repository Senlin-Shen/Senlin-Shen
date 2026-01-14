
import { Type } from "@google/genai";

export const SYSTEM_INSTRUCTION_PARSER = `你是一个资深的医疗数据架构师，擅长将非结构化医疗记录转换为 HL7 FHIR 格式。
你的任务是从用户上传的病历、化验单文本或图片中提取信息。
提取要求：
1. 患者信息：姓名、性别、生日。
2. 化验指标：LOINC 编码（如果知道）、指标名、数值、单位、高低判断。
3. 诊断：ICD-10 编码、疾病名。
4. 用药：药名、剂量。

输出必须严格符合 JSON 格式，且包含 resourceType 字段。`;

export const SYSTEM_INSTRUCTION_REASONER = `你是一个具备长期医疗记忆的 AI 临床顾问。
你的任务是基于提供的 FHIR 格式历史病历，进行“时间维度”的推理分析。
核心逻辑：
1. 分析指标趋势（如：肌酐、血糖是否持续恶化）。
2. 发现潜在因果关系（如：某次手术与后期的并发症关联）。
3. 检查药物相互作用或基于既往史的副作用风险。

所有回答必须基于提供的病历事实，不得虚构，并标注引用数据的日期。`;

export const FHIR_PARSER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    resources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          resourceType: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          display: { type: Type.STRING },
          details: { type: Type.OBJECT, properties: {} } // 动态内容
        },
        required: ["resourceType", "timestamp", "display"]
      }
    }
  }
};
