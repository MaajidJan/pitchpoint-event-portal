package com.bahria.paymentlistener;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PaymentParser {

    private static final Pattern[] AMOUNT_PATTERNS = new Pattern[]{
        Pattern.compile("(?:Total\\s+Amount|Money\\s+Transfer\\s+of|received|received\\s+Rs\\.?|Rs\\.?|PKR)\\s*([\\d,]+(?:\\.\\d+)?)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(?:Rs\\.?|PKR)\\s*([\\d,]+(?:\\.\\d+)?)\\s*(?:received|transferred|sent|mosool|credited|deposited)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(?:credited\\s+with|deposited|added)\\s*(?:Rs\\.?|PKR)?\\s*([\\d,]+(?:\\.\\d+)?)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("Amount[\\s:]*(?:Rs\\.?|PKR)?\\s*([\\d,]+(?:\\.\\d+)?)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("([\\d,]+(?:\\.\\d+)?)\\s*(?:Rs|PKR)", Pattern.CASE_INSENSITIVE)
    };

    private static final Pattern[] TRX_PATTERNS = new Pattern[]{
        Pattern.compile("(?:Transaction\\s*ID|TRX\\s*ID|TID|Txn\\s*ID|Reference\\s*No|Ref\\s*#|Ref|Reference|STAN)[:\\s#]*([A-Za-z0-9]{8,24})", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(?:with\\s+ID|ID\\s+is)[:\\s#]*([0-9]{8,18})", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\b([1-9][0-9]{9,12})\\b") // 10-13 digit TRX ID / Raast Ref
    };

    private static final Pattern[] SENDER_PATTERNS = new Pattern[]{
        Pattern.compile("(?:received\\s+from|from|se)\\s+([A-Za-z\\s]+?)(?:\\(|\\.|\\n|,|TID|TRX|New balance|to\\s+Easypaisa|via\\s+Raast)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("Sender[:\\s]+([A-Za-z\\s]+?)(?:\\n|\\r|$)", Pattern.CASE_INSENSITIVE)
    };

    private static final Pattern PHONE_PATTERN = Pattern.compile("\\b(03[0-9]{9})\\b");

    public static ParsedPayment parse(String text) {
        if (text == null) text = "";
        String clean = text.trim();

        // 1. Amount
        Double amount = null;
        for (Pattern p : AMOUNT_PATTERNS) {
            Matcher m = p.matcher(clean);
            if (m.find()) {
                String match = m.group(1);
                if (match != null) {
                    try {
                        double parsed = Double.parseDouble(match.replace(",", ""));
                        if (parsed > 0) {
                            amount = parsed;
                            break;
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // 2. TRX ID
        String trxId = null;
        for (Pattern p : TRX_PATTERNS) {
            Matcher m = p.matcher(clean);
            while (m.find()) {
                String candidate = m.group(1);
                if (candidate != null) {
                    candidate = candidate.trim().toUpperCase();
                    // Avoid phone numbers (e.g. 03175230209)
                    if (!candidate.startsWith("03") && candidate.length() >= 8) {
                        trxId = candidate;
                        break;
                    }
                }
            }
            if (trxId != null) break;
        }

        // 3. Sender Name
        String senderName = null;
        for (Pattern p : SENDER_PATTERNS) {
            Matcher m = p.matcher(clean);
            if (m.find()) {
                String candidate = m.group(1);
                if (candidate != null && candidate.trim().length() > 2) {
                    senderName = candidate.trim();
                    break;
                }
            }
        }

        // 4. Sender Phone
        String senderPhone = null;
        Matcher phoneMatcher = PHONE_PATTERN.matcher(clean);
        if (phoneMatcher.find()) {
            senderPhone = phoneMatcher.group(1);
        }

        return new ParsedPayment(trxId, amount, senderName, senderPhone, clean);
    }

    public static boolean isPaymentNotification(String packageName, String title, String text) {
        if (packageName == null) packageName = "";
        String pkg = packageName.toLowerCase();

        // Direct payment app packages
        if (pkg.contains("telenor.phoenix") || // Easypaisa
            pkg.contains("techlogix.mobilinkcustomer") || // JazzCash
            pkg.contains("zindigi") || // Zindigi (by JS Bank)
            pkg.contains("jsbl") || // JS Bank
            pkg.contains("jsbank") || // JS Bank App
            pkg.contains("nayapay") || // NayaPay
            pkg.contains("sadapay") || // SadaPay
            pkg.contains("hbl") || pkg.contains("meezan") || pkg.contains("alfalah") || pkg.contains("bank")) {
            return true;
        }

        String titleLower = (title != null ? title : "").toLowerCase();
        String textLower = (text != null ? text : "").toLowerCase();
        String combined = (titleLower + " " + textLower).trim();

        // Any banking Transaction Alert notification
        if (titleLower.contains("transaction alert") || 
            titleLower.contains("zindigi") || 
            titleLower.contains("raast") ||
            combined.contains("zindigi") ||
            combined.contains("raast payment")) {
            return true;
        }

        boolean isSmsApp = pkg.contains("messaging") || pkg.contains("mms") || pkg.contains("message") || pkg.contains("sms");

        if (isSmsApp) {
            boolean isFinancialSender = titleLower.contains("3737") || 
                                       titleLower.contains("8558") || 
                                       titleLower.contains("raast") || 
                                       titleLower.contains("zindigi") ||
                                       titleLower.contains("bank") ||
                                       titleLower.contains("meezan") ||
                                       titleLower.contains("hbl") ||
                                       titleLower.contains("ubl") ||
                                       titleLower.contains("alfalah") ||
                                       titleLower.contains("easypaisa") ||
                                       titleLower.contains("jazzcash") ||
                                       titleLower.contains("nayapay") ||
                                       titleLower.contains("sadapay");

            boolean hasPaymentWords = combined.contains("received") || 
                                      combined.contains("transferred") ||
                                      combined.contains("credited") || 
                                      combined.contains("deposit") ||
                                      combined.contains("rs.") || 
                                      combined.contains("rs ") || 
                                      combined.contains("pkr") ||
                                      combined.contains("trx") || 
                                      combined.contains("tid") ||
                                      combined.contains("ref");

            return isFinancialSender || hasPaymentWords;
        }

        return (combined.contains("easypaisa") || combined.contains("3737") || combined.contains("jazzcash") || combined.contains("raast") || combined.contains("zindigi") || combined.contains("nayapay") || combined.contains("sadapay")) &&
               (combined.contains("received") || combined.contains("credited") || combined.contains("rs") || combined.contains("trx") || combined.contains("tid") || combined.contains("ref"));
    }

    public static String detectSource(String packageName, String title, String text) {
        if (packageName == null) packageName = "";
        String pkg = packageName.toLowerCase();
        String titleLower = (title != null ? title : "").toLowerCase();
        String textLower = (text != null ? text : "").toLowerCase();

        if (pkg.contains("zindigi") || titleLower.contains("zindigi") || textLower.contains("zindigi")) {
            return "ZINDIGI_APP";
        }
        if (pkg.contains("telenor.phoenix") || titleLower.contains("easypaisa")) {
            return "EASYPAISA_APP";
        }
        if (pkg.contains("techlogix.mobilinkcustomer") || titleLower.contains("jazzcash")) {
            return "JAZZCASH_APP";
        }
        if (pkg.contains("nayapay") || titleLower.contains("nayapay")) {
            return "NAYAPAY_APP";
        }
        if (pkg.contains("sadapay") || titleLower.contains("sadapay")) {
            return "SADAPAY_APP";
        }
        if (titleLower.contains("3737") || textLower.contains("3737")) {
            return "SMS_3737";
        }
        if (titleLower.contains("8558") || textLower.contains("8558")) {
            return "SMS_8558";
        }
        if (titleLower.contains("raast") || textLower.contains("raast")) {
            return "RAAST";
        }
        if (pkg.contains("messaging") || pkg.contains("mms") || pkg.contains("sms")) {
            return "SMS_BANK";
        }
        return "PAYMENT_NOTIFICATION";
    }
}
