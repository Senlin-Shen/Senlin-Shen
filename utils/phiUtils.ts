
/**
 * 医疗隐私脱敏模块
 */

export const deidentifyText = (text: string): string => {
  if (!text) return "";
  
  // 简单的正则表达式脱敏（实际生产需更复杂的 NLP）
  let masked = text;
  
  // 1. 脱敏姓名 (假设中文名 2-4 字)
  masked = masked.replace(/[\u4e00-\u9fa5]{2,4}(?=先生|女士|患者)/g, "***");
  
  // 2. 脱敏手机号
  masked = masked.replace(/1[3-9]\d{9}/g, "1**********");
  
  // 3. 脱敏身份证号
  masked = masked.replace(/\d{15}(\d{2}[0-9xX])?/g, "******************");
  
  return masked;
};

export const deidentifyName = (name: string): string => {
  if (!name) return "匿名患者";
  if (name.length <= 1) return "*";
  return name[0] + "*".repeat(name.length - 1);
};
