import { ParsedReceipt } from './types';

/**
 * Parses raw email body or SMS from Easypaisa into structured payment data.
 * Supports:
 * - Easypaisa transaction notification emails
 * - Easypaisa 3737 SMS formats
 * - Direct JSON or simulated inputs
 */
export function parseEasypaisaMessage(rawContent: string, subject?: string): ParsedReceipt | null {
  const combined = `${subject || ''}\n${rawContent}`.trim();
  if (!combined) return null;

  // Filter out WhatsApp reaction notifications and non-financial chat messages
  if (/Reacted\s+[^\w\s]+\s+to/i.test(combined) || /Winner Prize:\s*PKR/i.test(combined) && !/received|credited|transferred|TID|TRX/i.test(combined)) {
    return null;
  }

  // 1. Extract Amount
  let amount = 0;
  const amountPatterns = [
    /Total\s+Amount[\s\S]*?(?:Rs\.?|PKR)?\s*([\d,]+(?:\.\d+)?)/i,
    /Money\s+Transfer\s+of\s+Rs\.?\s*([\d,]+(?:\.\d+)?)/i,
    /received\s+(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d+)?)/i,
    /(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d+)?)\s*(?:received|transferred|sent)/i,
    /credited\s+(?:with\s+)?(?:Rs\.?|PKR)?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d+)?)\s*(?:credited|deposited|added)/i,
    /Amount[\s:]*(?:Rs\.?|PKR)?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d+)?)/i
  ];

  for (const pattern of amountPatterns) {
    const match = combined.match(pattern);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  // 2. Extract Transaction ID (TRX ID / TID / Raast Reference)
  let trx_id = '';
  const trxPatterns = [
    /(?:Transaction\s*ID|ID)\s*#\s*([0-9]{8,18})/i,
    /(?:Transaction\s*ID|TRX\s*ID|TID|Txn\s*ID|Reference\s*No|Ref\s*#|Ref|Reference|STAN)[:\s#]*([A-Za-z0-9]{8,24})/i,
    /(?:TRX|TID)[:\s#]*([0-9]{8,18})/i,
    /(?:with\s+ID|ID\s+is)[:\s#]*([0-9]{8,18})/i,
    /TRX\s*#\s*([0-9]{8,18})/i,
    /\b([1-9][0-9]{9,12})\b/
  ];

  for (const pattern of trxPatterns) {
    const match = combined.match(pattern);
    if (match && match[1]) {
      trx_id = match[1].trim().toUpperCase();
      break;
    }
  }

  // If no labeled TRX ID found, look for standard 10-13 digit sequence that looks like TRX / Raast Ref
  if (!trx_id) {
    const digitMatch = combined.match(/\b([1-9][0-9]{9,12})\b/);
    if (digitMatch && digitMatch[1]) {
      trx_id = digitMatch[1];
    }
  }

  // 3. Extract Sender Name
  let sender_name = 'Unknown Sender';
  const senderPatterns = [
    /from\s+([A-Za-z\s]{2,35}?)(?:\s+PK\*\*|\s+with|\s+via|\(|\.|\n|,|TID|TRX|New balance|to\s+Easypaisa)/i,
    /received\s+(?:Rs\.?|PKR)?\s*[\d,.]*\s+from\s+([A-Za-z\s]{2,35}?)(?:\s+PK\*\*|\s+with|\s+via|\(|\.|\n|,|TID|TRX)/i,
    /received\s+from\s+([A-Za-z\s]{2,35}?)(?:\(|\.|\n|,|TID|TRX|New balance)/i,
    /from\s+([A-Za-z\s]{2,35}?)(?:\(|\.|\n|,|TID|TRX|to\s+Easypaisa)/i,
    /Sender[:\s]+([A-Za-z\s]{2,35}?)(?:\n|\r|$)/i
  ];

  for (const pattern of senderPatterns) {
    const match = combined.match(pattern);
    if (match && match[1] && match[1].trim().length > 1) {
      const candidate = match[1].trim();
      if (!/^(dear|account|easypaisa|telenor|pakistan)/i.test(candidate)) {
        sender_name = candidate;
        break;
      }
    }
  }

  // 4. Extract Sender Phone
  let sender_phone = '';
  const phoneMatch = combined.match(/\b(03[0-9]{9})\b/);
  if (phoneMatch && phoneMatch[1]) {
    sender_phone = phoneMatch[1];
  }

  // 5. Extract Date/Timestamp
  let timestamp = new Date().toISOString();
  const dateMatch = combined.match(/on\s+(\d{1,2}-[A-Za-z]{3}-\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?)/i);
  if (dateMatch && dateMatch[1]) {
    timestamp = dateMatch[1];
  }

  if (!trx_id && amount <= 0) {
    return null;
  }

  return {
    trx_id: trx_id || `TRX-${Date.now()}`,
    amount: amount || 0,
    sender_name,
    sender_phone,
    timestamp,
    raw_text: combined
  };
}
