
/**
 * 医疗隐私处理模块 - 已根据需求移除脱敏逻辑
 */

export const deidentifyText = (text: string): string => {
  return text; // 直接返回原文本
};

export const deidentifyName = (name: string): string => {
  return name; // 直接返回原姓名，不再生成 "张*"
};
