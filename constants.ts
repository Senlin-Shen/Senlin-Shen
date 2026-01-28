
import { Type } from "@google/genai";

export const SYSTEM_INSTRUCTION_PARSER = `# 专业级AI病历梳理可视化Prompt
请基于患者全量病历资料（含门诊病历、住院病案、检查检验报告、医嘱单、病程记录、影像报告、检验化验单、既往病史/过敏史/家族史等所有相关医疗文书），完成**标准化病历模板的梳理与可视化呈现**。

梳理逻辑需贴合临床主任、医学统计学家、临床健康营养师多科室专业团队的核心工作需求。

### 一、核心梳理要求
1. 临床主任视角：按「一般情况-主诉-现病史-既往史-个人史-家族史-体格检查-辅助检查-诊断结论-诊疗经过-目前病情-诊疗建议」梳理；
2. 医学统计学家视角：对所有量化数据标准化提取，异常数据标注参考范围；
3. 临床健康营养师视角：提取基础身体数据（BMI等）、饮食史、用药禁忌、营养相关检验指标。

### 二、标准化病历模板框架（必须包含以下五个模块）
1. 核心信息区：基本信息（脱敏）、过敏/禁忌史（红标重点）；
2. 临床诊疗区：完整诊疗脉络、医嘱执行情况；
3. 量化数据区：表格化呈现检验/检查指标，异常指标标红；
4. 多科室适配区：分「临床建议、统计重点、营养要点」三栏；
5. 风险提示区：临床高风险点、并发症风险、营养禁忌。

### 三、可视化表达要求
- 使用 Markdown 表格展示量化数据。
- 使用标题层级划分子模块。
- 关键风险项使用加粗或特殊符号。

请输出一套完整的标准化可视化病历，达到「直接可用、无需二次加工」的标准。`;

export const SYSTEM_INSTRUCTION_REASONER = `你是一个具备长期医疗记忆的 AI 临床顾问。
你的任务是基于提供的 FHIR 格式历史病历或结构化报告，进行时间维度的趋势分析和因果推理。`;

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
          display: { type: Type.STRING }
        }
      }
    }
  }
};
