const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/index.ts');
let content = fs.readFileSync(targetPath, 'utf8');

function replaceExact(searchStr, replaceStr, label) {
  const idx = content.indexOf(searchStr);
  if (idx === -1) {
    console.error(`ERROR: Could not find exact match for: ${label}`);
    process.exit(1);
  }
  content = content.slice(0, idx) + replaceStr + content.slice(idx + searchStr.length);
  console.log(`✓ Successfully replaced: ${label}`);
}

// 1. /api/register - remove auto-match
const oldRegStepB = `    // Step B: Double Verification against Incoming Bank Payments
    let initialStatus = 'PENDING';
    let qrDataUrl = '';
    let notes = 'Awaiting payment confirmation from Gmail/SMS';

    if (extractedTrx || full_name) {
      // 1. Check by exact TRX ID
      let payment = extractedTrx 
        ? await db.prepare('SELECT * FROM incoming_payments WHERE trx_id = ?').bind(extractedTrx).first<IncomingPayment>()
        : null;

      // 2. Intelligent Cross-Bank / Raast Auto-Match:
      // When paid via JazzCash / NayaPay / Bank, the sender's TID differs from Easypaisa TRX,
      // but Easypaisa notification contains student's name in raw_text / sender_name!
      if (!payment) {
        const studentNameClean = full_name.trim().toLowerCase();
        const nameParts = studentNameClean.split(/\\s+/).filter(p => p.length > 2);
        const studentPhoneDigits = phoneClean.replace(/\\D/g, '');

        const candidates = await db.prepare(\`
          SELECT * FROM incoming_payments 
          WHERE status = 'UNCLAIMED' AND amount >= ?
          ORDER BY received_at DESC LIMIT 10
        \`).bind(expected_amount).all<IncomingPayment>();

        for (const cand of (candidates.results || [])) {
          const rawLower = (cand.raw_text || '').toLowerCase();
          const senderLower = (cand.sender_name || '').toLowerCase();
          const candPhoneDigits = (cand.sender_phone || '').replace(/\\D/g, '');

          // Verify exact phone match
          const phoneMatch = candPhoneDigits.length >= 7 && studentPhoneDigits.endsWith(candPhoneDigits.slice(-7));

          const matches = nameParts.filter(p => rawLower.includes(p) || senderLower.includes(p)).length;
          const isNameMatch = (matches >= 2) || (nameParts.length === 1 && matches === 1) || (senderLower && studentNameClean.includes(senderLower));

          // Strict Security Rule: Require phone match OR explicit TRX for auto-approval.
          // Plain name similarity without phone match is flagged for manual admin review.
          if (phoneMatch) {
            payment = cand;
            extractedTrx = cand.trx_id;
            break;
          } else if (isNameMatch && !notes.includes('Potential match')) {
            notes = \`Pending review: Name similarity detected with unclaimed TRX \${cand.trx_id} (\${cand.sender_name || 'Sender'}). Requires staff verification.\`;
          }
        }
      }

      if (payment) {
        // Calculate already claimed amount for this TRX ID
        const claimedResult = await db.prepare(\`
          SELECT COALESCE(SUM(expected_amount), 0) as total_claimed 
          FROM registrations 
          WHERE trx_id = ? AND status = 'VERIFIED' AND id != ?
        \`).bind(extractedTrx, registrationId).first<{ total_claimed: number }>();

        const totalClaimed = claimedResult ? claimedResult.total_claimed : 0;
        const availableCredit = payment.amount - totalClaimed;

        if (availableCredit >= expected_amount) {
          // Sufficient credit available! Auto-approve and generate distinct V2 QR ticket
          initialStatus = 'VERIFIED';
          notes = \`Verified instantly against \${payment.source} payment (Total Paid: Rs. \${payment.amount}, Available: Rs. \${availableCredit})\`;

          const qrPayload = JSON.stringify({
            v: 2,
            channel: 'ONLINE_EASYPAISA',
            ticket_id: registrationId,
            name: full_name.trim(),
            roll_no: rollNoClean,
            trx_id: extractedTrx,
            amount_paid: expected_amount,
            type: ticket_type
          });
          qrDataUrl = await generateQRCodeSvg(qrPayload);

          const newTotalClaimed = totalClaimed + expected_amount;
          const newStatus = newTotalClaimed >= payment.amount ? 'CLAIMED' : 'UNCLAIMED';
          await db.prepare(\`
            UPDATE incoming_payments 
            SET status = ?, claimed_by = COALESCE(claimed_by || ',', '') || ?
            WHERE trx_id = ?
          \`).bind(newStatus, registrationId, extractedTrx).run();
        } else if (totalClaimed > 0) {
          notes = \`Payment record found for Rs. \${payment.amount}, but credit already fully claimed (Rs. \${totalClaimed} used). Under review.\`;
        } else {
          notes = \`Payment record found, but received amount Rs. \${payment.amount} is less than required Rs. \${expected_amount}. Under review.\`;
        }
      }
    }`;

const newRegStepB = `    // Step B: Set Pending Queue for Manual Finance Head Verification
    // (Automated bank matching disabled due to Easypaisa/Zindigi delays; Finance manually verifies slips)
    const initialStatus = 'PENDING';
    const qrDataUrl = '';
    const notes = extractedTrx 
      ? \`Awaiting manual payment slip verification by Finance Head (Stated TRX: \${extractedTrx})\`
      : 'Awaiting manual payment slip verification by Finance Head';`;

replaceExact(oldRegStepB, newRegStepB, 'api/register step B');

const oldRegMsg = `      message: initialStatus === 'VERIFIED' 
        ? 'Payment verified! Your ticket is ready.' 
        : 'Registration received! Looking up transaction in Easypaisa inbox...'`;
const newRegMsg = `      message: 'Registration submitted successfully! Your payment slip has been uploaded and queued for manual verification by Finance. Check status anytime on the portal.'`;

replaceExact(oldRegMsg, newRegMsg, 'api/register response message');

// 2. /api/status/:id late-match block
const oldStatusLateMatch = `  // If pending, attempt late match with incoming_payments
  if (reg.status === 'PENDING' && reg.trx_id) {
    const payment = await db.prepare(\`
      SELECT * FROM incoming_payments WHERE trx_id = ?
    \`).bind(reg.trx_id).first<IncomingPayment>();

    if (payment) {
      const claimedResult = await db.prepare(\`
        SELECT COALESCE(SUM(expected_amount), 0) as total_claimed 
        FROM registrations 
        WHERE trx_id = ? AND status = 'VERIFIED' AND id != ?
      \`).bind(reg.trx_id, reg.id).first<{ total_claimed: number }>();

      const totalClaimed = claimedResult ? claimedResult.total_claimed : 0;
      const availableCredit = payment.amount - totalClaimed;

      if (availableCredit >= reg.expected_amount) {
        // Auto-promote to VERIFIED!
        const qrPayload = JSON.stringify({
          v: 2,
          channel: 'ONLINE_EASYPAISA',
          ticket_id: reg.id,
          name: reg.full_name,
          roll_no: reg.roll_no,
          trx_id: reg.trx_id,
          amount_paid: reg.expected_amount,
          type: reg.ticket_type
        });
        const qrDataUrl = await generateQRCodeSvg(qrPayload);

        await db.prepare(\`
          UPDATE registrations 
          SET status = 'VERIFIED', ticket_qr = ?, verified_at = CURRENT_TIMESTAMP, verification_notes = 'Verified via live sync check'
          WHERE id = ?
        \`).bind(qrDataUrl, reg.id).run();

        await db.prepare(\`
          INSERT INTO audit_logs (event_type, reference_id, details)
          VALUES ('LIVE_SYNC_VERIFIED', ?, ?)
        \`).bind(reg.id, \`Attendee \${reg.full_name} (\${reg.roll_no}) auto-verified via live status poll with TRX \${reg.trx_id}\`).run();

        const newTotalClaimed = totalClaimed + reg.expected_amount;
        const newStatus = newTotalClaimed >= payment.amount ? 'CLAIMED' : 'UNCLAIMED';
        await db.prepare(\`
          UPDATE incoming_payments 
          SET status = ?, claimed_by = COALESCE(claimed_by || ',', '') || ?
          WHERE trx_id = ?
        \`).bind(newStatus, reg.id, reg.trx_id).run();

        return c.json({
          success: true,
          status: 'VERIFIED',
          registration: {
            ...reg,
            status: 'VERIFIED',
            ticket_qr: qrDataUrl
          }
        });
      }
    }
  }

  return c.json({
    success: true,
    status: reg.status,
    registration: reg
  });`;

const newStatusLateMatch = `  // If pending, return pending state without auto-approving
  return c.json({
    success: true,
    status: reg.status,
    registration: reg,
    message: reg.status === 'PENDING'
      ? 'Awaiting manual payment slip verification by Finance Head.'
      : \`Status: \${reg.status}\`
  });`;

replaceExact(oldStatusLateMatch, newStatusLateMatch, 'api/status/:id');

// 3. /api/ideacrux/register
const oldCruxMatch = `    // Check if TRX was provided and matches incoming bank payment
    if (cleanTrx) {
      const payment = await db.prepare(\`
        SELECT * FROM incoming_payments WHERE trx_id = ? AND status = 'UNCLAIMED'
      \`).bind(cleanTrx).first<IncomingPayment>();

      if (payment && payment.amount >= feeAmount) {
        initialStatus = 'VERIFIED';
        const qrPayload = JSON.stringify({
          v: 2,
          type: 'OFFICIAL_IDEACRUX_PITCH_PASS',
          team_id: teamId,
          team_name: cleanTeam,
          startup: cleanStartup,
          leader: cleanLeader,
          phone: cleanPhone,
          members: cleanCount,
          trx_id: cleanTrx,
          venue: 'Al-Beruni Auditorium, BSEAS H-11 Campus',
          date: '15 October 2026'
        });
        pitchPassQr = await generateQRCodeSvg(qrPayload);

        await db.prepare(\`
          UPDATE incoming_payments 
          SET status = 'CLAIMED', claimed_by = COALESCE(claimed_by || ',', '') || ?
          WHERE trx_id = ?
        \`).bind(teamId, cleanTrx).run();
      }
    }`;

const newCruxMatch = `    // Online registrations queue for Finance Head manual verification
    const adminNotes = cleanTrx
      ? \`Awaiting manual payment slip verification by Finance Head (Stated TRX: \${cleanTrx})\`
      : 'Awaiting manual payment slip verification by Finance Head';`;

replaceExact(oldCruxMatch, newCruxMatch, 'api/ideacrux/register auto match');

const oldCruxNoteBind = `      initialStatus === 'VERIFIED' ? 'Verified automatically via Zindigi / Raast match' : 'Awaiting payment verification'`;
replaceExact(oldCruxNoteBind, `      adminNotes`, 'api/ideacrux/register adminNotes bind');

const oldCruxMsg = `message: 'Your team registration is already received! Check status anytime on the portal.'`;
// Note: duplicate check already has this message, let's target the success return message at line 1555:
const oldCruxSuccessReturn = `    return c.json({
      success: true,
      team_id: teamId,
      status: initialStatus,
      pitch_pass_qr: pitchPassQr,
      message: initialStatus === 'VERIFIED'
        ? \`Payment confirmed! Official Pitch Pass generated for team '\${cleanTeam}'.\`
        : \`Registration submitted! Upload your payment screenshot to verify your slot.\`
    });`;

const newCruxSuccessReturn = `    return c.json({
      success: true,
      team_id: teamId,
      status: initialStatus,
      pitch_pass_qr: '',
      message: 'Registration submitted successfully! Your payment slip has been uploaded and queued for manual verification by Finance. Check status anytime on the portal using your phone number.'
    });`;

replaceExact(oldCruxSuccessReturn, newCruxSuccessReturn, 'api/ideacrux/register return message');

// 4. /api/ideacrux/status/:id
const oldCruxStatusBlock = `    // If pending, has TRX ID, AND has uploaded screenshot proof, check incoming_payments
    if (team.status === 'PENDING' && team.trx_id && team.screenshot_preview && team.screenshot_preview.length > 100) {
      const payment = await db.prepare(\`
        SELECT * FROM incoming_payments WHERE trx_id = ? AND status = 'UNCLAIMED'
      \`).bind(team.trx_id).first<IncomingPayment>();

      if (payment && payment.amount >= (team.fee_amount || 100)) {
        const qrPayload = JSON.stringify({
          v: 2,
          type: 'OFFICIAL_IDEACRUX_PITCH_PASS',
          team_id: team.id,
          team_name: team.team_name,
          startup: team.startup_name,
          leader: team.leader_name,
          phone: team.leader_phone,
          members: team.members_count,
          trx_id: team.trx_id,
          venue: 'Al-Beruni Auditorium, BSEAS H-11 Campus',
          date: '15 October 2026'
        });
        const qrSvg = await generateQRCodeSvg(qrPayload);

        await db.prepare(\`
          UPDATE ideacrux_teams 
          SET status = 'VERIFIED', pitch_pass_qr = ?, verified_at = CURRENT_TIMESTAMP, admin_notes = 'Auto-verified on status poll'
          WHERE id = ?
        \`).bind(qrSvg, team.id).run();

        await db.prepare(\`
          UPDATE incoming_payments 
          SET status = 'CLAIMED', claimed_by = COALESCE(claimed_by || ',', '') || ?
          WHERE trx_id = ?
        \`).bind(team.id, team.trx_id).run();

        team.status = 'VERIFIED';
        team.pitch_pass_qr = qrSvg;
      }
    }

    return c.json({
      success: true,
      team,
      pitch_pass_qr: team.pitch_pass_qr || ''
    });`;

const newCruxStatusBlock = `    // If verified but QR pass missing, generate on demand
    if (team.status === 'VERIFIED' && !team.pitch_pass_qr) {
      const qrPayload = JSON.stringify({
        v: 2,
        type: 'OFFICIAL_IDEACRUX_PITCH_PASS',
        team_id: team.id,
        team_name: team.team_name,
        startup: team.startup_name,
        leader: team.leader_name,
        phone: team.leader_phone,
        members: team.members_count,
        trx_id: team.trx_id || team.receipt_no || 'VERIFIED',
        venue: 'Al-Beruni Auditorium, BSEAS H-11 Campus',
        date: '15 October 2026'
      });
      team.pitch_pass_qr = await generateQRCodeSvg(qrPayload);
      await db.prepare('UPDATE ideacrux_teams SET pitch_pass_qr = ? WHERE id = ?').bind(team.pitch_pass_qr, team.id).run();
    }

    return c.json({
      success: true,
      status: team.status,
      team,
      pitch_pass_qr: team.pitch_pass_qr || '',
      message: team.status === 'VERIFIED'
        ? 'Your startup pitch pass is active and verified!'
        : (team.status === 'REJECTED'
          ? 'Your registration was rejected. Please contact Finance Desk.'
          : 'Your team registration is received and in the Finance manual review queue. The Finance Head will verify your payment slip shortly.')
    });`;

replaceExact(oldCruxStatusBlock, newCruxStatusBlock, 'api/ideacrux/status/:id');

// 5. /api/ideacrux/verify-payment (update to queue for manual review instead of auto-approving)
const oldCruxVerifyPayment = `    const payment = await db.prepare(\`
      SELECT * FROM incoming_payments WHERE trx_id = ?
    \`).bind(cleanTrx).first<IncomingPayment>();

    if (payment && payment.amount >= (team.fee_amount || 100)) {
      const qrPayload = JSON.stringify({
        v: 2,
        type: 'OFFICIAL_IDEACRUX_PITCH_PASS',
        team_id: team.id,
        team_name: team.team_name,
        startup: team.startup_name,
        leader: team.leader_name,
        phone: team.leader_phone,
        members: team.members_count,
        trx_id: cleanTrx,
        venue: 'Al-Beruni Auditorium, BSEAS H-11 Campus',
        date: '15 October 2026'
      });
      const qrSvg = await generateQRCodeSvg(qrPayload);

      await db.prepare(\`
        UPDATE ideacrux_teams 
        SET status = 'VERIFIED', trx_id = ?, screenshot_preview = COALESCE(?, screenshot_preview), pitch_pass_qr = ?, verified_at = CURRENT_TIMESTAMP, admin_notes = 'Auto-verified with matching bank alert'
        WHERE id = ?
      \`).bind(cleanTrx, screenshot_base64 || null, qrSvg, team.id).run();

      await db.prepare(\`
        UPDATE incoming_payments 
        SET status = 'CLAIMED', claimed_by = COALESCE(claimed_by || ',', '') || ?
        WHERE trx_id = ?
      \`).bind(team.id, cleanTrx).run();

      await db.prepare(\`
        INSERT INTO audit_logs (event_type, reference_id, details)
        VALUES ('IDEACRUX_AUTO_VERIFIED', ?, ?)
      \`).bind(team.id, \`IdeaCrux Team '\${team.team_name}' auto-verified with incoming TRX \${cleanTrx}\`).run();

      return c.json({
        success: true,
        status: 'VERIFIED',
        pitch_pass_qr: qrSvg,
        message: 'Payment confirmed! Official IdeaCrux Pitch Pass generated successfully.',
        team: {
          ...team,
          status: 'VERIFIED',
          trx_id: cleanTrx,
          pitch_pass_qr: qrSvg
        }
      });
    } else {
      await db.prepare(\`
        UPDATE ideacrux_teams 
        SET trx_id = ?, screenshot_preview = COALESCE(?, screenshot_preview), admin_notes = 'Payment submitted. Awaiting bank sync verification'
        WHERE id = ?
      \`).bind(cleanTrx, screenshot_base64 || null, team.id).run();

      return c.json({
        success: true,
        status: 'PENDING',
        message: \`TRX ID \${cleanTrx} received! Cross-matching with incoming Easypaisa alerts...\`,
        team: {
          ...team,
          trx_id: cleanTrx
        }
      });
    }`;

const newCruxVerifyPayment = `    await db.prepare(\`
      UPDATE ideacrux_teams 
      SET trx_id = ?, screenshot_preview = COALESCE(?, screenshot_preview), admin_notes = 'Payment slip submitted. Awaiting manual Finance Head verification'
      WHERE id = ?
    \`).bind(cleanTrx, screenshot_base64 || null, team.id).run();

    await db.prepare(\`
      INSERT INTO audit_logs (event_type, reference_id, details)
      VALUES ('IDEACRUX_SLIP_SUBMITTED', ?, ?)
    \`).bind(team.id, \`Payment slip / TRX \${cleanTrx} submitted for '\${team.team_name}'. Queued for manual Finance review.\`).run();

    return c.json({
      success: true,
      status: 'PENDING',
      message: \`TRX ID \${cleanTrx} and payment slip submitted successfully! Queued for manual verification by Finance Head.\`,
      team: {
        ...team,
        trx_id: cleanTrx
      }
    });`;

replaceExact(oldCruxVerifyPayment, newCruxVerifyPayment, 'api/ideacrux/verify-payment');

// 6. Add Finance Endpoints
const financeEndpoints = `
/**
 * 12b. Finance Verification Queue: Get all pending online payment slips
 */
app.get('/api/finance/pending-requests', async (c) => {
  try {
    const db = c.env.DB;

    // 1. Pending IdeaCrux Teams
    const cruxRows = await db.prepare(\`
      SELECT id, team_name, leader_name, leader_email, leader_phone,
             startup_name, members_count, fee_amount, trx_id,
             screenshot_preview, status, admin_notes, created_at
      FROM ideacrux_teams 
      WHERE status = 'PENDING'
      ORDER BY created_at DESC
    \`).all<any>();

    // 2. Pending Fiesta Registrations
    const fiestaRows = await db.prepare(\`
      SELECT id, full_name, email, phone, roll_no, department,
             ticket_type, expected_amount, trx_id, screenshot_preview,
             status, verification_notes, created_at
      FROM registrations 
      WHERE status = 'PENDING'
      ORDER BY created_at DESC
    \`).all<any>();

    const list: any[] = [];

    for (const t of (cruxRows.results || [])) {
      list.push({
        id: t.id,
        type: 'IDEACRUX',
        type_label: 'IdeaCrux Startup',
        title: t.team_name,
        applicant_name: t.leader_name,
        email: t.leader_email,
        phone: t.leader_phone,
        details: \`Startup: \${t.startup_name} (\${t.members_count} members)\`,
        amount: t.fee_amount || 100,
        trx_id: t.trx_id || 'Not Provided',
        has_screenshot: !!(t.screenshot_preview && t.screenshot_preview.length > 50),
        screenshot_preview: t.screenshot_preview || '',
        created_at: t.created_at,
        status: t.status,
        notes: t.admin_notes || ''
      });
    }

    for (const r of (fiestaRows.results || [])) {
      list.push({
        id: r.id,
        type: 'FIESTA',
        type_label: 'Fiesta Attendee',
        title: r.full_name,
        applicant_name: r.full_name,
        email: r.email,
        phone: r.phone,
        details: \`Roll: \${r.roll_no} • Dept: \${r.department || 'General'}\`,
        amount: r.expected_amount || 100,
        trx_id: r.trx_id || 'Not Provided',
        has_screenshot: !!(r.screenshot_preview && r.screenshot_preview.length > 50),
        screenshot_preview: r.screenshot_preview || '',
        created_at: r.created_at,
        status: r.status,
        notes: r.verification_notes || ''
      });
    }

    // Sort by created_at DESC
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json({
      success: true,
      total_pending: list.length,
      crux_pending_count: (cruxRows.results || []).length,
      fiesta_pending_count: (fiestaRows.results || []).length,
      requests: list
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * 12c. Finance Head: Manually Approve Payment Slip & Issue Official QR Pass
 */
app.post('/api/finance/approve-request', async (c) => {
  try {
    const db = c.env.DB;
    const staff = (c as any).get('staff') as StaffSession | undefined;
    const body = await c.req.json();
    const { type, id, notes } = body;

    if (!id || !type) {
      return c.json({ success: false, error: 'Request ID and Type (IDEACRUX or FIESTA) are required' }, 400);
    }

    const approver = staff ? \`\${staff.full_name} (\${staff.role})\` : 'Finance Head';
    const customNote = notes ? String(notes).trim() : 'Payment slip verified & confirmed';

    if (type === 'IDEACRUX') {
      const team = await db.prepare('SELECT * FROM ideacrux_teams WHERE id = ?').bind(id).first<IdeaCruxTeam>();
      if (!team) return c.json({ success: false, error: 'Team not found' }, 404);

      const qrPayload = JSON.stringify({
        v: 2,
        type: 'OFFICIAL_IDEACRUX_PITCH_PASS',
        team_id: team.id,
        team_name: team.team_name,
        startup: team.startup_name,
        leader: team.leader_name,
        phone: team.leader_phone,
        members: team.members_count,
        trx_id: team.trx_id || 'FIN-APPROVED',
        venue: 'Al-Beruni Auditorium, BSEAS H-11 Campus',
        date: '15 October 2026',
        approved_by: approver
      });
      const pitchPassQr = await generateQRCodeSvg(qrPayload);

      await db.prepare(\`
        UPDATE ideacrux_teams 
        SET status = 'VERIFIED',
            pitch_pass_qr = ?,
            admin_notes = ?,
            verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      \`).bind(
        pitchPassQr,
        \`Manually approved by \${approver}: \${customNote}\`,
        team.id
      ).run();

      await db.prepare(\`
        INSERT INTO audit_logs (event_type, reference_id, details)
        VALUES ('FINANCE_APPROVED_SLIP', ?, ?)
      \`).bind(team.id, \`\${approver} approved payment slip for IdeaCrux team '\${team.team_name}' (TRX: \${team.trx_id || 'N/A'}). Digital pass generated.\`).run();

      return c.json({
        success: true,
        id: team.id,
        status: 'VERIFIED',
        pitch_pass_qr: pitchPassQr,
        message: \`IdeaCrux team '\${team.team_name}' approved successfully! Digital pass issued.\`
      });
    } else if (type === 'FIESTA') {
      const reg = await db.prepare('SELECT * FROM registrations WHERE id = ?').bind(id).first<Registration>();
      if (!reg) return c.json({ success: false, error: 'Registration not found' }, 404);

      const qrPayload = JSON.stringify({
        v: 2,
        channel: 'ONLINE_EASYPAISA',
        ticket_id: reg.id,
        name: reg.full_name,
        roll_no: reg.roll_no,
        trx_id: reg.trx_id || 'FIN-APPROVED',
        amount_paid: reg.expected_amount,
        type: reg.ticket_type,
        approved_by: approver
      });
      const ticketQr = await generateQRCodeSvg(qrPayload);

      await db.prepare(\`
        UPDATE registrations 
        SET status = 'VERIFIED',
            ticket_qr = ?,
            verification_notes = ?,
            verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      \`).bind(
        ticketQr,
        \`Manually approved by \${approver}: \${customNote}\`,
        reg.id
      ).run();

      await db.prepare(\`
        INSERT INTO audit_logs (event_type, reference_id, details)
        VALUES ('FINANCE_APPROVED_SLIP', ?, ?)
      \`).bind(reg.id, \`\${approver} approved payment slip for Fiesta attendee '\${reg.full_name}' (TRX: \${reg.trx_id || 'N/A'}). Digital pass generated.\`).run();

      return c.json({
        success: true,
        id: reg.id,
        status: 'VERIFIED',
        ticket_qr: ticketQr,
        message: \`Attendee '\${reg.full_name}' approved successfully! Digital pass issued.\`
      });
    } else {
      return c.json({ success: false, error: 'Invalid type' }, 400);
    }
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * 12d. Finance Head: Reject Registration Slip
 */
app.post('/api/finance/reject-request', async (c) => {
  try {
    const db = c.env.DB;
    const staff = (c as any).get('staff') as StaffSession | undefined;
    const body = await c.req.json();
    const { type, id, reason } = body;

    if (!id || !type) {
      return c.json({ success: false, error: 'Request ID and Type required' }, 400);
    }

    const rejector = staff ? \`\${staff.full_name} (\${staff.role})\` : 'Finance Head';
    const rejectReason = reason ? String(reason).trim() : 'Invalid or unverified payment slip';

    if (type === 'IDEACRUX') {
      await db.prepare(\`
        UPDATE ideacrux_teams 
        SET status = 'REJECTED',
            admin_notes = ?
        WHERE id = ?
      \`).bind(\`Rejected by \${rejector}: \${rejectReason}\`, id).run();

      await db.prepare(\`
        INSERT INTO audit_logs (event_type, reference_id, details)
        VALUES ('FINANCE_REJECTED_SLIP', ?, ?)
      \`).bind(id, \`\${rejector} rejected IdeaCrux registration. Reason: \${rejectReason}\`).run();

      return c.json({ success: true, message: 'IdeaCrux registration rejected.' });
    } else if (type === 'FIESTA') {
      await db.prepare(\`
        UPDATE registrations 
        SET status = 'REJECTED',
            verification_notes = ?
        WHERE id = ?
      \`).bind(\`Rejected by \${rejector}: \${rejectReason}\`, id).run();

      await db.prepare(\`
        INSERT INTO audit_logs (event_type, reference_id, details)
        VALUES ('FINANCE_REJECTED_SLIP', ?, ?)
      \`).bind(id, \`\${rejector} rejected Fiesta registration. Reason: \${rejectReason}\`).run();

      return c.json({ success: true, message: 'Fiesta registration rejected.' });
    } else {
      return c.json({ success: false, error: 'Invalid type' }, 400);
    }
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
`;

const handoverEndMarker = `  return c.json({
    success: true,
    shift_id,
    cashier_name: shift.cashier_name,
    amount_approved: shift.total_cash_collected,
    message: \`Cash handover of Rs. \${shift.total_cash_collected} approved and balanced!\`
  });
});`;

replaceExact(handoverEndMarker, handoverEndMarker + '\n' + financeEndpoints, 'Finance endpoints insertion');

fs.writeFileSync(targetPath, content, 'utf8');
console.log('🎉 Successfully updated src/index.ts with all manual verification & finance endpoints!');
