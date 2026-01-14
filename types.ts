
/**
 * 核心医疗数据模型 - 遵循 HL7 FHIR 简化版
 */

export enum ResourceType {
  PATIENT = 'Patient',
  OBSERVATION = 'Observation', // 化验指标
  CONDITION = 'Condition',     // 诊断
  MEDICATION_REQUEST = 'MedicationRequest', // 处方
  PROCEDURE = 'Procedure'      // 手术/处置
}

export interface FHIRResource {
  resourceType: ResourceType;
  id: string;
  timestamp: string; // ISO 格式，用于时间轴对齐
  display: string;   // 摘要显示文本
  rawText?: string;  // 原始提取文本
}

export interface PatientResource extends FHIRResource {
  resourceType: ResourceType.PATIENT;
  name: string;
  gender: string;
  birthDate: string;
}

export interface ObservationResource extends FHIRResource {
  resourceType: ResourceType.OBSERVATION;
  code: string; // LOINC 编码
  value: number;
  unit: string;
  interpretation: 'H' | 'L' | 'N'; // 高、低、正常
  referenceRange?: string;
}

export interface ConditionResource extends FHIRResource {
  resourceType: ResourceType.CONDITION;
  code: string; // ICD-10 编码
  clinicalStatus: string;
}

export interface Insight {
  id: string;
  type: 'WARNING' | 'INFO' | 'CAUSAL';
  title: string;
  description: string;
  sourceIds: string[]; // 关联的资源 ID
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
