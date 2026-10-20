function parseSlipText(text) {
  // 1. TRX ID
  let trx_id = '';
  const trxMatch = text.match(/(?:Transaction\s*ID|ID)\s*#\s*([0-9]{8,15})/i) ||
                   text.match(/(?:TRX|TID|Txn|Ref)[:\s#]*([0-9]{8,15})/i) ||
                   text.match(/\b([1-9][0-9]{10})\b/);
  if (trxMatch) trx_id = trxMatch[1];

  // 2. Amount
  let amount = 0;
  const amountMatch = text.match(/Total\s+Amount[\s\S]*?(?:Rs\.?|PKR)?\s*([\d,]+(?:\.\d+)?)/i) ||
                      text.match(/Amount[\s\S]*?(?:Rs\.?|PKR)?\s*([\d,]+(?:\.\d+)?)/i) ||
                      text.match(/(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d+)?)/i);
  if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, ''));

  // 3. Receiver Phone & Name Verification
  const hasOfficialNumber = text.includes('03175230209') || text.includes('0317-5230209');
  const hasOfficialName = /majid|maajid/i.test(text);

  // 4. Sender Name
  let sender_name = '';
  const senderMatch = text.match(/Sent\s+by[\s\S]*?Name\s+([A-Za-z\s]+?)(?:\n|\r|Account)/i) ||
                      text.match(/Sent\s+by\s*\n\s*([A-Za-z\s]+?)(?:\n|\r|\d)/i);
  if (senderMatch) sender_name = senderMatch[1].trim();

  return { trx_id, amount, hasOfficialNumber, hasOfficialName, sender_name };
}

const text1 = `easypaisa
Transaction Successful
Money has been sent
15 September 2026 4:09 PM
ID#55849371125
Funding Source
[3 easypaisa Account
Sent to
Maajid Oct 2024 Hussain Market
03175230209
Account Details
Majid Ullah Jan
Sent by
NASAR ULLAH JAN
03045491038
Amount
300.00
Fee / Charge
No Charge
Total Amount
Rs. 300.00`;

const text2 = `9%
Transaction Successful
Money has been sent
Transaction ID #55932695835
Date & Time 17 September 2026, 7:03 AM
Funding Source easypaisa Account

Sent to

Name Maajid Oct 2024 Hussain Market
Account Number 03175230209
Sent by

Name NASAR ULLAH JAN
Account Number 03045491038
Charges

Amount Rs. 500.00
Fee Rs. 0.00
Total Amount Rs. 500.00`;

console.log('SLIP 1:', parseSlipText(text1));
console.log('SLIP 2:', parseSlipText(text2));
