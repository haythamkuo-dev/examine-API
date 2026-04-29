import crypto from 'crypto';

/**
 * 根據路徑從物件中挖出深層的值 (例如挖出 'amount.amount' 裡面的 '99.00')
 */
const getNestedValue = (obj: any, path: string): string => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * 泛用的 SHA-256 簽章產生器
 */
export const generateSign = (
  payload: any, 
  signFields: string[], 
  secretKey: string
): string => {
  // 1. 將需要簽名的欄位名稱進行升序排列 (A-Z)
  const sortedFields = [...signFields].sort();

  // 2. 提取對應的值，並組裝成 key=value 陣列
  const keyValuePairs = sortedFields.map(field => {
    const value = getNestedValue(payload, field);
    // 假設 field 是 "amount.amount"，組出來就是 "amount.amount=99.00"
    return `${field}=${value}`;
  });

  // 3. 在陣列最後補上環境變數設定的 key
  keyValuePairs.push(`key=${secretKey}`);

  // 4. 用 '&' 串接成 Canonical String (標準化字串)
  const canonicalString = keyValuePairs.join('&');
  // console.log("🔍 [Debug] Canonical String:", canonicalString);

  // 5. 放入 SHA-256 算出 Hex 字串
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
};