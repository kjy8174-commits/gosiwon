// ─────────────────────────────────────────────────────────────
//  goshiwon.html 안의 sendK 함수를 아래 코드로 교체하세요
//  (기존 시뮬레이션 → 실제 Solapi 발송으로 전환)
// ─────────────────────────────────────────────────────────────

const sendK = async (t) => {
  const room = rooms.find(r => r.id === t.roomId);
  const s = getPS(t);
  const mt = s.urgency === 3 ? 'overdue' : s.urgency === 2 ? 'today' : 'remind';

  // 발송할 메시지 내용
  const msgs = {
    remind:  `[고시원 납부 안내]\n안녕하세요 ${t.name}님!\n${room?.id}호 ${rentLabel(t, room)} 납부일이 ${Math.abs(new Date().getDate() - t.payDay)}일 남았습니다.\n계좌: 국민 123-456-789\n감사합니다 🙏`,
    today:   `[고시원 납부 안내]\n${t.name}님, 오늘이 납부일입니다!\n${room?.id}호 납부 부탁드립니다.\n계좌: 국민 123-456-789`,
    overdue: `[고시원 납부 알림]\n${t.name}님, ${s.label} 상태입니다.\n빠른 납부 부탁드립니다. 문의: 010-XXXX-XXXX`,
  };

  const message = msgs[mt];

  // ── 로그 먼저 추가 (발송 중 표시) ──
  const logId = Date.now();
  setKlog(prev => [{
    id: logId,
    tenantName: t.name,
    roomId: room?.id,
    message,
    time: new Date().toLocaleTimeString('ko-KR'),
    status: '발송 중...',
  }, ...prev]);

  try {
    // ── Netlify Function 호출 ──
    const res = await fetch('/.netlify/functions/sendKakao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:          t.phone,          // 수신번호
        name:        t.name,
        roomId:      t.roomId,
        message,
        messageType: 'SMS',            // 알림톡 템플릿 있으면 'ALIMTALK'
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // 성공
      setKlog(prev => prev.map(l => l.id === logId
        ? { ...l, status: '✅ 전송 완료' }
        : l
      ));
      showToast(`${t.name}님께 카카오톡 전송 완료`);
    } else {
      // 실패
      setKlog(prev => prev.map(l => l.id === logId
        ? { ...l, status: `❌ 실패: ${data.error || '오류'}` }
        : l
      ));
      showToast(`${t.name} 발송 실패: ${data.error}`, 'error');
    }

  } catch (err) {
    setKlog(prev => prev.map(l => l.id === logId
      ? { ...l, status: `❌ 네트워크 오류` }
      : l
    ));
    showToast('네트워크 오류가 발생했습니다', 'error');
  }
};
