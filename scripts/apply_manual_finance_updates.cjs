const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/index.ts');
let lines = fs.readFileSync(targetPath, 'utf8').split('\n');

console.log('Original line count:', lines.length);

// 1. /api/register - lines 788 to 879 (1-indexed)
// Verify start
if (!lines[787].includes('Step B: Double Verification against Incoming Bank Payments')) {
  console.error('Line 788 check failed:', lines[787]);
  process.exit(1);
}
// Verify end
if (!lines[878].trim().endsWith('}')) {
  console.error('Line 879 check failed:', lines[878]);
  process.exit(1);
}

const newStepBLines = [
  '    // Step B: Set Pending Queue for Manual Finance Head Verification',
  '    // (Automated bank matching disabled due to Easypaisa/Zindigi delays; Finance manually verifies slips)',
  '    const initialStatus = \'PENDING\';',
  '    const qrDataUrl = \'\';',
  '    const notes = extractedTrx ',
  '      ? `Awaiting manual payment slip verification by Finance Head (Stated TRX: ${extractedTrx})`',
  '      : \'Awaiting manual payment slip verification by Finance Head\';'
];

lines.splice(787, 879 - 787, ...newStepBLines);
console.log('✓ Replaced /api/register Step B');

// Re-split and find /api/register return message
let content = lines.join('\n');

const oldRegMsg = `      message: initialStatus === 'VERIFIED' 
        ? 'Payment verified! Your ticket is ready.' 
        : 'Registration received! Looking up transaction in Easypaisa inbox...'`;
const newRegMsg = `      message: 'Registration submitted successfully! Your payment slip has been uploaded and queued for manual verification by Finance. Check status anytime on the portal.'`;

if (!content.includes(oldRegMsg)) {
  console.error('Could not find oldRegMsg');
  process.exit(1);
}
content = content.replace(oldRegMsg, newRegMsg);
console.log('✓ Replaced /api/register message');

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

if (!content.includes(oldStatusLateMatch)) {
  console.error('Could not find oldStatusLateMatch');
  process.exit(1);
}
content = content.replace(oldStatusLateMatch, newStatusLateMatch);
console.log('✓ Replaced /api/status/:id late-match');

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

if (!content.includes(oldCruxMatch)) {
  console.error('Could not find oldCruxMatch');
  process.exit(1);
}
content = content.replace(oldCruxMatch, newCruxMatch);
console.log('✓ Replaced /api/ideacrux/register auto match');

const oldCruxNoteBind = `      initialStatus === 'VERIFIED' ? 'Verified automatically via Zindigi / Raast match' : 'Awaiting payment verification'`;
if (!content.includes(oldCruxNoteBind)) {
  console.error('Could not find oldCruxNoteBind');
  process.exit(1);
}
content = content.replace(oldCruxNoteBind, `      adminNotes`);
console.log('✓ Replaced /api/ideacrux/register adminNotes bind');

const oldCruxSuccessReturn = `      message: initialStatus === 'VERIFIED'
        ? 'Payment verified! Your official IdeaCrux Pitch Pass is ready.'
        : 'Team registration submitted successfully! Please submit Rs. 100 via Zindigi / Raast to complete registration.'`;

const newCruxSuccessReturn = `      pitch_pass_qr: '',
      message: 'Registration submitted successfully! Your payment slip has been uploaded and queued for manual verification by Finance. Check status anytime on the portal using your phone number.'`;

// Note: line 1554 is pitch_pass_qr: pitchPassQr, line 1555-1557 is message
const oldCruxRetPart = `      pitch_pass_qr: pitchPassQr,
      message: initialStatus === 'VERIFIED'
        ? 'Payment verified! Your official IdeaCrux Pitch Pass is ready.'
        : 'Team registration submitted successfully! Please submit Rs. 100 via Zindigi / Raast to complete registration.'`;

if (!content.includes(oldCruxRetPart)) {
  console.error('Could not find oldCruxRetPart');
  process.exit(1);
}
content = content.replace(oldCruxRetPart, newCruxSuccessReturn);
console.log('✓ Replaced /api/ideacrux/register return message');

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
    }`;

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
    }`;

if (!content.includes(oldCruxStatusBlock)) {
  console.error('Could not find oldCruxStatusBlock');
  process.exit(1);
}
content = content.replace(oldCruxStatusBlock, newCruxStatusBlock);
console.log('✓ Replaced /api/ideacrux/status/:id late-match');

// Update return of /api/ideacrux/status/:id
const oldCruxStatusReturn = `    return c.json({
      success: true,
      team,
      payment_instructions: {`;

const newCruxStatusReturn = `    return c.json({
      success: true,
      status: team.status,
      team,
      pitch_pass_qr: team.pitch_pass_qr || '',
      message: team.status === 'VERIFIED'
        ? 'Your startup pitch pass is active and verified!'
        : (team.status === 'REJECTED'
          ? 'Your registration was rejected. Please contact Finance Desk.'
          : 'Your team registration is received and in the Finance manual review queue. The Finance Head will verify your payment slip shortly.'),
      payment_instructions: {`;

if (!content.includes(oldCruxStatusReturn)) {
  console.error('Could not find oldCruxStatusReturn');
  process.exit(1);
}
content = content.replace(oldCruxStatusReturn, newCruxStatusReturn);
console.log('✓ Replaced /api/ideacrux/status/:id return');

// 5. /api/ideacrux/verify-payment
const oldCruxVerifyPayment = `    // Check if matching payment exists in incoming_payments
    const payment = await db.prepare(\`
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

if (!content.includes(oldCruxVerifyPayment)) {
  console.error('Could not find oldCruxVerifyPayment');
  process.exit(1);
}
content = content.replace(oldCruxVerifyPayment, newCruxVerifyPayment);
console.log('✓ Replaced /api/ideacrux/verify-payment');

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

if (!content.includes(handoverEndMarker)) {
  console.error('Could not find handoverEndMarker');
  process.exit(1);
}
content = content.replace(handoverEndMarker, handoverEndMarker + '\n' + financeEndpoints);
console.log('✓ Appended finance endpoints');

fs.writeFileSync(targetPath, content, 'utf8');
console.log('🎉 Successfully applied all manual finance & verification updates to src/index.ts!');
