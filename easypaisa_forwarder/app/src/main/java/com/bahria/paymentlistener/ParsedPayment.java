package com.bahria.paymentlistener;

public class ParsedPayment {
    public final String trxId;
    public final Double amount;
    public final String senderName;
    public final String senderPhone;
    public final String rawText;

    public ParsedPayment(String trxId, Double amount, String senderName, String senderPhone, String rawText) {
        this.trxId = trxId;
        this.amount = amount;
        this.senderName = senderName;
        this.senderPhone = senderPhone;
        this.rawText = rawText;
    }
}
