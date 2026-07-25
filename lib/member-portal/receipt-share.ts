import { createHmac, timingSafeEqual } from "crypto";
import { memberJwtSecret } from "@/lib/member-portal/config";

/** Signed share links stay valid for a year — receipts are proof of payment. */
export const RECEIPT_SHARE_TTL_SEC = 365 * 24 * 60 * 60;

export type ReceiptShareClaims = {
  typ: "receipt_share";
  gid: string;
  mid: number;
  pid: string;
  exp: number;
  iat: number;
};

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const s = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(s, "base64");
}

export function signReceiptShare(input: {
  gymId: string;
  memberId: number;
  paymentId: string;
  ttlSec?: number;
}): string {
  const iat = Math.floor(Date.now() / 1000);
  const payload: ReceiptShareClaims = {
    typ: "receipt_share",
    gid: String(input.gymId),
    mid: Number(input.memberId),
    pid: String(input.paymentId),
    iat,
    exp: iat + (input.ttlSec ?? RECEIPT_SHARE_TTL_SEC),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", memberJwtSecret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifyReceiptShare(token: string): ReceiptShareClaims | null {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expected = createHmac("sha256", memberJwtSecret()).update(body).digest();
    const actual = fromB64url(sig);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as ReceiptShareClaims;
    if (payload.typ !== "receipt_share") return null;
    if (!payload.gid || !payload.pid || !Number.isFinite(payload.mid)) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Pretty INR for receipts: ₹649 (no trailing .00 for whole rupees). */
export function formatReceiptAmount(value: unknown): {
  amount: string;
  amountDisplay: string;
} {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) {
    return { amount: "0.00", amountDisplay: "0" };
  }
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  const amount = n.toFixed(2);
  const amountDisplay = n.toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return { amount, amountDisplay };
}

export function formatReceiptPaidAt(value: string | null | undefined): string {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function escHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type ReceiptViewModel = {
  receiptId: string;
  memberName: string;
  memberCode: string;
  planName: string;
  branchName: string;
  paidAt: string;
  method: string;
  billingMonth: string;
  note: string;
  amount: string;
  amountDisplay: string;
  shareText: string;
  shareUrl?: string;
};

export function buildReceiptShareText(r: Omit<ReceiptViewModel, "shareText" | "shareUrl">) {
  return [
    "Action Plus Gym — Payment Receipt",
    `Receipt: ${r.receiptId}`,
    `Member: ${r.memberName} (${r.memberCode})`,
    `Amount: ₹${r.amountDisplay}`,
    `Paid: ${r.paidAt}`,
    `Method: ${r.method}`,
    `Billing month: ${r.billingMonth}`,
  ].join("\n");
}

/** Branded HTML receipt used by both authenticated and public share links. */
export function renderReceiptHtml(input: {
  receipt: ReceiptViewModel;
  shareUrl: string;
  backHref?: string | null;
  showAuthActions?: boolean;
}): string {
  const r = input.receipt;
  const esc = escHtml;
  const back =
    input.backHref != null
      ? `<a class="btn-ghost" href="${esc(input.backHref)}">← Back to Member Portal</a>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0b0d10" />
  <title>Receipt ${esc(r.receiptId)} · Action Plus Gym</title>
  <style>
    :root {
      --bg: #0b0d10;
      --card: #14181f;
      --ink: #f5f5f5;
      --muted: rgba(245, 245, 245, 0.62);
      --line: rgba(255, 255, 255, 0.12);
      --gold: #d4af37;
      --gold-deep: #b8922a;
      --ok: #22c55e;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      min-height: 100dvh;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background:
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212, 175, 55, 0.18), transparent),
        var(--bg);
      color: var(--ink);
      padding: 20px 16px 40px;
    }
    .wrap { max-width: 440px; margin: 0 auto; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 18px;
    }
    .toolbar a, .toolbar button {
      appearance: none;
      border: none;
      cursor: pointer;
      text-decoration: none;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      border-radius: 999px;
      padding: 11px 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 44px;
      flex: 1 1 auto;
    }
    .btn-gold {
      background: linear-gradient(135deg, #f0d56a, var(--gold) 45%, var(--gold-deep));
      color: #111;
    }
    .btn-outline {
      background: transparent;
      color: var(--ink);
      border: 1px solid var(--line);
    }
    .btn-ghost {
      background: rgba(255,255,255,0.06);
      color: var(--muted);
      border: 1px solid var(--line);
      flex: 1 1 100%;
    }
    .hint {
      margin: 0 0 14px;
      font-size: 12px;
      color: var(--muted);
      text-align: center;
      min-height: 1.2em;
    }
    .card {
      position: relative;
      background: linear-gradient(180deg, #1a1f28 0%, var(--card) 40%);
      border: 1px solid var(--line);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 24px 60px rgba(0,0,0,0.45);
    }
    .card-top {
      padding: 28px 24px 20px;
      border-bottom: 1px solid var(--line);
      text-align: center;
    }
    .brand-mark {
      width: 56px;
      height: 56px;
      margin: 0 auto 14px;
      border-radius: 16px;
      background: linear-gradient(145deg, #f0d56a, var(--gold-deep));
      color: #111;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.04em;
    }
    .brand {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(90deg, #f5e6a8, var(--gold), #c9a227);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .subtitle {
      margin: 6px 0 0;
      font-size: 13px;
      color: var(--muted);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .paid {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 16px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.35);
      color: #86efac;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .paid::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ok);
    }
    .amount-block {
      padding: 28px 24px 8px;
      text-align: center;
    }
    .amount-label {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .amount {
      margin: 10px 0 0;
      font-size: 44px;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: var(--gold);
      font-variant-numeric: tabular-nums;
      line-height: 1.05;
    }
    .amount .currency {
      font-size: 0.58em;
      font-weight: 600;
      margin-right: 0.12em;
      opacity: 0.92;
      vertical-align: 0.12em;
    }
    .rows {
      padding: 16px 24px 28px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
      font-size: 14px;
    }
    .row:last-child { border-bottom: none; }
    .row .k { color: var(--muted); flex-shrink: 0; }
    .row .v { text-align: right; font-weight: 500; word-break: break-word; }
    .row.total .v {
      color: var(--gold);
      font-weight: 700;
      font-size: 16px;
      font-variant-numeric: tabular-nums;
    }
    .footer {
      padding: 0 24px 24px;
      text-align: center;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }
    @media print {
      body {
        background: #fff;
        color: #111;
        padding: 0;
      }
      .toolbar, .hint, .no-print { display: none !important; }
      .card {
        box-shadow: none;
        border: 1px solid #ddd;
        border-radius: 0;
        background: #fff;
      }
      .brand {
        background: none;
        -webkit-background-clip: unset;
        background-clip: unset;
        color: #111;
      }
      .brand-mark {
        background: #d4af37;
        color: #111;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .amount, .subtitle, .row.total .v { color: #111; }
      .paid {
        color: #166534;
        border-color: #86efac;
        background: #f0fdf4;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .row .k, .footer { color: #666; }
      .row { border-bottom-color: #eee; }
      .card-top { border-bottom-color: #eee; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="toolbar no-print">
      <button type="button" class="btn-gold" id="whatsappBtn">Share on WhatsApp</button>
      <button type="button" class="btn-outline" id="shareBtn">Share</button>
      <button type="button" class="btn-outline" id="printBtn">Print / Save PDF</button>
      ${back}
    </div>
    <p class="hint" id="hint"></p>

    <article class="card" id="receipt">
      <header class="card-top">
        <div class="brand-mark" aria-hidden="true">AP</div>
        <h1 class="brand">Action Plus Gym</h1>
        <p class="subtitle">Payment receipt</p>
        <div class="paid">Paid</div>
      </header>

      <div class="amount-block">
        <p class="amount-label">Amount paid</p>
        <p class="amount"><span class="currency">₹</span>${esc(r.amountDisplay)}</p>
      </div>

      <div class="rows">
        <div class="row"><span class="k">Receipt</span><span class="v">${esc(r.receiptId)}</span></div>
        <div class="row"><span class="k">Member</span><span class="v">${esc(r.memberName)}</span></div>
        <div class="row"><span class="k">Member ID</span><span class="v">${esc(r.memberCode)}</span></div>
        <div class="row"><span class="k">Plan</span><span class="v">${esc(r.planName)}</span></div>
        <div class="row"><span class="k">Branch</span><span class="v">${esc(r.branchName)}</span></div>
        <div class="row"><span class="k">Paid at</span><span class="v">${esc(r.paidAt)}</span></div>
        <div class="row"><span class="k">Method</span><span class="v">${esc(r.method)}</span></div>
        <div class="row"><span class="k">Billing month</span><span class="v">${esc(r.billingMonth)}</span></div>
        <div class="row"><span class="k">Note</span><span class="v">${esc(r.note)}</span></div>
        <div class="row total"><span class="k">Amount</span><span class="v">₹${esc(r.amountDisplay)}</span></div>
      </div>

      <p class="footer">
        Official payment receipt from Action Plus Gym.<br />
        Contact the gym for any corrections.
      </p>
    </article>
  </div>

  <script>
    (function () {
      var shareText = ${JSON.stringify(r.shareText)};
      var shareUrl = ${JSON.stringify(input.shareUrl)};
      var hint = document.getElementById("hint");
      var shareBtn = document.getElementById("shareBtn");
      var whatsappBtn = document.getElementById("whatsappBtn");
      var printBtn = document.getElementById("printBtn");

      function setHint(msg) {
        if (hint) hint.textContent = msg || "";
      }

      function openWhatsApp() {
        var url =
          "https://wa.me/?text=" +
          encodeURIComponent(shareText + "\\n\\n" + shareUrl);
        window.open(url, "_blank", "noopener,noreferrer");
      }

      if (printBtn) {
        printBtn.addEventListener("click", function () {
          window.print();
        });
      }

      if (whatsappBtn) {
        whatsappBtn.addEventListener("click", function () {
          openWhatsApp();
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener("click", async function () {
          setHint("");
          var payload = {
            title: "Action Plus Gym receipt",
            text: shareText,
            url: shareUrl,
          };
          try {
            if (navigator.share) {
              await navigator.share(payload);
              setHint("Shared.");
              return;
            }
          } catch (err) {
            if (err && err.name === "AbortError") return;
          }
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(shareText + "\\n\\n" + shareUrl);
              setHint("Receipt details copied. Opening WhatsApp…");
            }
          } catch (_) {}
          openWhatsApp();
        });
      }
    })();
  </script>
</body>
</html>`;
}
