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
  const sortedFields = [...signFields].sort();
  const keyValuePairs = sortedFields.map((field) => {
    const value = getNestedValue(payload, field);
    return `${field}=${value}`;
  });

  keyValuePairs.push(`key=${secretKey}`);
  const canonicalString = keyValuePairs.join('&');
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
};
