// netlify/functions/sendKakao.js
// ─────────────────────────────────────────────────
// Solapi 알림톡 발송 Netlify Function
// 환경변수: SOLAPI_KEY, SOLAPI_SECRET, SENDER_PHONE
// ─────────────────────────────────────────────────

const crypto = require("crypto");

// HMAC-SHA256 서명 생성
function makeSignature(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 22);
  const hmac = crypto.createHmac("sha256", apiSecret);
  hmac.update(date + salt);
  const signature = hmac.digest("hex");
  return {
    authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
  };
}

exports.handler = async (event) => {
  // CORS 헤더 (모든 origin 허용 — 본인 도메인으로 좁혀도 됩니다)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // OPTIONS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { to, name, roomId, message, messageType } = JSON.parse(event.body);

    if (!to || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "수신번호(to)와 메시지(message)가 필요합니다" }),
      };
    }

    const apiKey    = process.env.SOLAPI_KEY;
    const apiSecret = process.env.SOLAPI_SECRET;
    const sender    = process.env.SENDER_PHONE; // 발신번호 (예: 01012345678, 하이픈 없이)

    if (!apiKey || !apiSecret || !sender) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "환경변수 SOLAPI_KEY / SOLAPI_SECRET / SENDER_PHONE 확인 필요" }),
      };
    }

    const { authorization } = makeSignature(apiKey, apiSecret);

    // ── 메시지 타입 분기 ──────────────────────────
    // 카카오 알림톡 템플릿이 심사 통과된 경우 → ALIMTALK
    // 템플릿 없으면 일반 SMS/LMS로 폴백
    const isAlimtalk = messageType === "ALIMTALK";

    const payload = {
      message: {
        to:   to.replace(/-/g, ""),   // 하이픈 제거
        from: sender,
        text: message,
        type: isAlimtalk ? "ATA" : message.length > 45 ? "LMS" : "SMS",
        ...(isAlimtalk && {
          kakaoOptions: {
            pfId:       process.env.KAKAO_PF_ID       || "", // 카카오 채널 pfId
            templateId: process.env.KAKAO_TEMPLATE_ID || "", // 템플릿 ID
            variables: { "#{name}": name, "#{roomId}": String(roomId) },
          },
        }),
      },
    };

    const response = await fetch("https://api.solapi.com/messages/v4/send", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": authorization,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Solapi 오류:", result);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: result.errorMessage || "발송 실패", detail: result }),
      };
    }

    console.log(`✅ 발송 완료 → ${to} (${name}, ${roomId}호)`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, messageId: result.messageId }),
    };

  } catch (err) {
    console.error("Function 오류:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "서버 오류", detail: err.message }),
    };
  }
};
