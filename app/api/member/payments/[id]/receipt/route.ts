import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import { branchLabel } from "@/lib/member-portal/members";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPaidAt(value: string | null | undefined): string {
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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const { id } = await ctx.params;
  const paymentId = String(id || "").trim();
  if (!paymentId) {
    return NextResponse.json({ ok: false, error: "id-required" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const { data: row, error } = await svc.client
    .from("member_payment_history")
    .select(
      "id, external_payment_id, paid_at, amount, method, paid_month, billing_month, billing_date, note, recorded_by, source, created_at",
    )
    .eq("gym_id", portalGymId())
    .eq("member_id", session.member.id)
    .or(`external_payment_id.eq.${paymentId},id.eq.${paymentId}`)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const branch = await branchLabel(session.member.assigned_gym_code_id);
  const amountNum = Number(row.amount || 0);
  const amount = Number.isFinite(amountNum) ? amountNum.toFixed(2) : "0.00";
  const amountDisplay = Number.isFinite(amountNum)
    ? amountNum.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "0";
  const paidAt = formatPaidAt(row.paid_at);
  const receiptId = String(row.external_payment_id || row.id);
  const billingMonth = String(row.paid_month || row.billing_month || "").trim() || "—";
  const method = String(row.method || "").trim() || "—";
  const note = String(row.note || "").trim() || "—";
  const planName = String(session.member.plan_name || "").trim() || "—";
  const memberName = String(session.member.full_name || "").trim() || "—";
  const memberCode = String(session.member.member_code || "").trim() || "—";
  const branchName = String(branch || "").trim() || "—";

  const shareText = [
    "Action Plus Gym — Payment Receipt",
    `Receipt: ${receiptId}`,
    `Member: ${memberName} (${memberCode})`,
    `Amount: ₹${amountDisplay}`,
    `Paid: ${paidAt}`,
    `Method: ${method}`,
    `Billing month: ${billingMonth}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0b0d10" />
  <title>Receipt ${esc(receiptId)} · Action Plus Gym</title>
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
      margin: 8px 0 0;
      font-size: 40px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--gold);
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
      .amount, .subtitle { color: #111; }
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
      <button type="button" class="btn-gold" id="shareBtn">Share</button>
      <button type="button" class="btn-outline" id="printBtn">Print / Save PDF</button>
      <a class="btn-ghost" href="/members">← Back to Member Portal</a>
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
        <p class="amount">₹${esc(amountDisplay)}</p>
      </div>

      <div class="rows">
        <div class="row"><span class="k">Receipt</span><span class="v">${esc(receiptId)}</span></div>
        <div class="row"><span class="k">Member</span><span class="v">${esc(memberName)}</span></div>
        <div class="row"><span class="k">Member ID</span><span class="v">${esc(memberCode)}</span></div>
        <div class="row"><span class="k">Plan</span><span class="v">${esc(planName)}</span></div>
        <div class="row"><span class="k">Branch</span><span class="v">${esc(branchName)}</span></div>
        <div class="row"><span class="k">Paid at</span><span class="v">${esc(paidAt)}</span></div>
        <div class="row"><span class="k">Method</span><span class="v">${esc(method)}</span></div>
        <div class="row"><span class="k">Billing month</span><span class="v">${esc(billingMonth)}</span></div>
        <div class="row"><span class="k">Note</span><span class="v">${esc(note)}</span></div>
        <div class="row"><span class="k">Amount</span><span class="v">₹${esc(amount)}</span></div>
      </div>

      <p class="footer">
        Official payment receipt from Action Plus Gym.<br />
        Contact the gym for any corrections.
      </p>
    </article>
  </div>

  <script>
    (function () {
      var shareText = ${JSON.stringify(shareText)};
      var hint = document.getElementById("hint");
      var shareBtn = document.getElementById("shareBtn");
      var printBtn = document.getElementById("printBtn");

      function setHint(msg) {
        if (hint) hint.textContent = msg || "";
      }

      function openWhatsApp() {
        var url =
          "https://wa.me/?text=" +
          encodeURIComponent(shareText + "\\n\\n" + window.location.href);
        window.open(url, "_blank", "noopener,noreferrer");
      }

      if (printBtn) {
        printBtn.addEventListener("click", function () {
          window.print();
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener("click", async function () {
          setHint("");
          var payload = {
            title: "Action Plus Gym receipt",
            text: shareText,
            url: window.location.href,
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
              await navigator.clipboard.writeText(shareText + "\\n\\n" + window.location.href);
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

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
