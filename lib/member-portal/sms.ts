/**
 * SMS OTP sender — MSG91 (India) with Twilio fallback.
 * Without credentials, uses console/dev mode when MEMBER_PORTAL_OTP_DEV=1.
 */

export type SendOtpResult =
  | { ok: true; provider: string; messageId?: string }
  | { ok: false; error: string; provider: string };

function clean(value: string | undefined) {
  return String(value || "").trim();
}

async function sendMsg91(mobile10: string, otp: string): Promise<SendOtpResult> {
  const authKey = clean(process.env.MSG91_AUTH_KEY);
  const templateId = clean(process.env.MSG91_OTP_TEMPLATE_ID);
  const sender = clean(process.env.MSG91_SENDER_ID) || "APGYMS";

  if (!authKey || !templateId) {
    return { ok: false, error: "MSG91 not configured", provider: "msg91" };
  }

  const url = new URL("https://control.msg91.com/api/v5/flow/");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify({
      template_id: templateId,
      sender,
      short_url: "0",
      recipients: [
        {
          mobiles: `91${mobile10}`,
          otp,
          VAR1: otp,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("MSG91 OTP send failed", res.status, text);
    return { ok: false, error: "SMS send failed", provider: "msg91" };
  }

  const json = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
  if (json.type && json.type !== "success") {
    return {
      ok: false,
      error: json.message || "SMS send failed",
      provider: "msg91",
    };
  }

  return { ok: true, provider: "msg91", messageId: json.message };
}

async function sendTwilio(mobile10: string, otp: string): Promise<SendOtpResult> {
  const sid = clean(process.env.TWILIO_ACCOUNT_SID);
  const token = clean(process.env.TWILIO_AUTH_TOKEN);
  const from = clean(process.env.TWILIO_FROM_NUMBER);

  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio not configured", provider: "twilio" };
  }

  const body = new URLSearchParams({
    To: `+91${mobile10}`,
    From: from,
    Body: `Action Plus Gym OTP: ${otp}. Valid for 10 minutes. Do not share.`,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Twilio OTP send failed", res.status, text);
    return { ok: false, error: "SMS send failed", provider: "twilio" };
  }

  const json = (await res.json().catch(() => ({}))) as { sid?: string };
  return { ok: true, provider: "twilio", messageId: json.sid };
}

export async function sendMemberOtpSms(
  mobile10: string,
  otp: string,
): Promise<SendOtpResult> {
  const preferred = clean(process.env.MEMBER_OTP_SMS_PROVIDER).toLowerCase();

  if (preferred === "twilio") {
    const tw = await sendTwilio(mobile10, otp);
    if (tw.ok) return tw;
  } else if (preferred === "msg91" || !preferred) {
    const m = await sendMsg91(mobile10, otp);
    if (m.ok) return m;
    if (preferred === "msg91") return m;
  }

  // Try the other provider if preferred failed / unset
  if (preferred !== "twilio") {
    const tw = await sendTwilio(mobile10, otp);
    if (tw.ok) return tw;
  }
  if (preferred === "twilio") {
    const m = await sendMsg91(mobile10, otp);
    if (m.ok) return m;
  }

  const dev =
    process.env.MEMBER_PORTAL_OTP_DEV === "1" ||
    process.env.NODE_ENV !== "production";

  if (dev) {
    console.info(`[member-portal OTP DEV] +91${mobile10} => ${otp}`);
    return { ok: true, provider: "dev", messageId: "dev" };
  }

  return {
    ok: false,
    error:
      "SMS provider not configured. Set MSG91_AUTH_KEY + MSG91_OTP_TEMPLATE_ID (or Twilio vars).",
    provider: "none",
  };
}
