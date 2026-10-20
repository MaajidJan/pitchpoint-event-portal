import fs from 'node:fs';

async function run() {
  const loginRes = await fetch('https://bahria-event-portal.bahria-event-portal.workers.dev/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'maajid', password: 'admin2026' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('Login failed:', loginData);
    return;
  }

  const lbRes = await fetch('https://bahria-event-portal.bahria-event-portal.workers.dev/api/judge/leaderboard', {
    headers: { 'Authorization': 'Bearer ' + loginData.token }
  });
  const lbData = await lbRes.json();
  const leaderboard = lbData.leaderboard || [];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return '"' + s + '"';
  };

  let csv = '';

  // HEADER
  csv += '"PITCH POINT // ZINDIGI PRIZE - OFFICIAL FINAL JUDGING RESULTS & LEADERBOARD"\n';
  csv += '"Bahria University BSEAS H-11 Campus • Pitch Day: 15 October 2026"\n';
  csv += '"Export Generated:","' + new Date().toLocaleString() + '"\n';
  csv += '"Total Evaluated Teams:",' + leaderboard.length + '\n';
  csv += '"Unrated Teams:",' + (lbData.unrated_teams || 0) + '\n';
  csv += '\n';

  // SECTION 1: MASTER LEADERBOARD & FINAL RANKINGS
  csv += '"============================================================================================"\n';
  csv += '"SECTION 1: OFFICIAL FINAL LEADERBOARD & AGGREGATE RANKINGS"\n';
  csv += '"============================================================================================"\n';
  csv += [
    '"Rank"',
    '"Team ID"',
    '"Startup / Project Name"',
    '"Team Name"',
    '"Presenter / Team Leader"',
    '"Department"',
    '"Maturity Bracket"',
    '"Evaluated Judges Count"',
    '"FINAL AGGREGATE SCORE"',
    '"Avg Idea Viability (max 10)"',
    '"Avg Solution Feasibility (max 10)"',
    '"Avg Business Model (max 10)"',
    '"Avg Social / Market Impact (max 10)"',
    '"Avg Startup Pitch (max 10)"',
    '"Avg Judges Impression (max 10)"',
    '"Pitch Deck Link"'
  ].join(',') + '\n';

  leaderboard.forEach(t => {
    csv += [
      t.rank,
      escapeCsv(t.team_id),
      escapeCsv(t.startup_name),
      escapeCsv(t.team_name),
      escapeCsv(t.leader_name),
      escapeCsv(t.leader_dept),
      escapeCsv(t.startup_stage),
      t.judge_count,
      t.avg_total_score,
      t.avg_idea,
      t.avg_solution,
      t.avg_business,
      t.avg_impact,
      t.avg_startup,
      t.avg_judges,
      escapeCsv(t.pitch_deck_url || 'N/A')
    ].join(',') + '\n';
  });

  csv += '\n\n';

  // SECTION 2: JUDGE MATRIX PIVOT (SIDE-BY-SIDE JUDGE COMPARISON)
  csv += '"============================================================================================"\n';
  csv += '"SECTION 2: JUDGES MATRIX PIVOT (SIDE-BY-SIDE JUDGE SCORE COMPARISON)"\n';
  csv += '"============================================================================================"\n';

  const judgeNamesSet = new Set();
  leaderboard.forEach(t => {
    (t.scorecards || []).forEach(sc => {
      if (sc.judge_name) judgeNamesSet.add(sc.judge_name);
    });
  });
  const judgeNames = Array.from(judgeNamesSet);

  const pivotHeader = [
    '"Rank"',
    '"Startup Name"',
    '"Team Name"',
    ...judgeNames.map(j => escapeCsv(j)),
    '"FINAL AVERAGE SCORE"'
  ];
  csv += pivotHeader.join(',') + '\n';

  leaderboard.forEach(t => {
    const row = [
      t.rank,
      escapeCsv(t.startup_name),
      escapeCsv(t.team_name)
    ];
    judgeNames.forEach(jName => {
      const sc = (t.scorecards || []).find(s => s.judge_name === jName);
      row.push(sc ? sc.total_score : '"-"');
    });
    row.push(t.avg_total_score);
    csv += row.join(',') + '\n';
  });

  csv += '\n\n';

  // SECTION 3: DETAILED SCORECARDS BREAKDOWN (WHO JUDGED WHAT VALUE)
  csv += '"============================================================================================"\n';
  csv += '"SECTION 3: COMPLETE DETAILED EVALUATIONS (WHO JUDGED WHAT & INDIVIDUAL CRITERIA)"\n';
  csv += '"============================================================================================"\n';
  csv += [
    '"Rank"',
    '"Startup Name"',
    '"Team Name"',
    '"Judge Name"',
    '"TOTAL SCORE GIVEN"',
    '"Idea Viability (10)"',
    '"Solution Feasibility (10)"',
    '"Business Model (10)"',
    '"Impact (10)"',
    '"Startup Pitch (10)"',
    '"Judges Impression (10)"',
    '"Judge Feedback Notes"',
    '"Evaluated Timestamp"'
  ].join(',') + '\n';

  leaderboard.forEach(t => {
    (t.scorecards || []).forEach(sc => {
      csv += [
        t.rank,
        escapeCsv(t.startup_name),
        escapeCsv(t.team_name),
        escapeCsv(sc.judge_name),
        sc.total_score,
        sc.score_idea,
        sc.score_solution,
        sc.score_business,
        sc.score_impact,
        sc.score_startup,
        sc.score_judges,
        escapeCsv(sc.notes || 'No remarks entered'),
        escapeCsv(sc.updated_at || sc.created_at || '')
      ].join(',') + '\n';
    });
  });

  fs.writeFileSync('d:/bahria_event/OFFICIAL_JUDGING_LEADERBOARD_RESULTS.csv', csv, 'utf8');
  fs.writeFileSync('d:/bahria_event/public/OFFICIAL_JUDGING_LEADERBOARD_RESULTS.csv', csv, 'utf8');
  console.log('CSV successfully generated and written! Total size:', csv.length, 'bytes');
}

run().catch(console.error);
