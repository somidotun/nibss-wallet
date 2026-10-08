import PDFDocument from "pdfkit";
import { ITransaction } from "../types/transaction.types.js";

export const generateTransactionReceipt = (
  transaction: ITransaction,
  senderName: string,
  receiverName: string,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ─── Header ──────────────────────────────────────────────
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Nibss Wallet", { align: "center" });

    doc
      .fontSize(14)
      .font("Helvetica")
      .text("Transaction Receipt", { align: "center" });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // ─── Transaction details ──────────────────────────────────
    const details = [
      ["Reference", transaction.reference],
      ["Status", transaction.status.toUpperCase()],
      ["Type", transaction.type.toUpperCase()],
      ["Amount", `NGN ${transaction.amount.toLocaleString()}`],
      ["From", senderName],
      ["To", receiverName],
      ["Description", transaction.description || "Transfer"],
      ["Balance Before", `NGN ${transaction.balanceBefore.toLocaleString()}`],
      ["Balance After", `NGN ${transaction.balanceAfter.toLocaleString()}`],
      [
        "Date",
        new Date(transaction.createdAt).toLocaleString("en-NG", {
          dateStyle: "full",
          timeStyle: "short",
        }),
      ],
    ];

    details.forEach(([label, value]) => {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(`${label}:`, { continued: true })
        .font("Helvetica")
        .text(` ${value}`);
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // ─── Footer ───────────────────────────────────────────────
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        "This is an auto-generated receipt. For support contact support@nibsswallet.com",
        { align: "center" },
      );

    doc.end();
  });
};
