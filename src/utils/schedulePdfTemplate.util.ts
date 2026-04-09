import type { AssignmentSchedule, WorkerAssignment } from '../models/MLPrediction';

/**
 * Builds a branded AssisTea HTML document from the generated assignment schedule.
 * Used by the PDF download feature in AssignmentGenerationScreen.
 */
export function buildScheduleHTML(
    sched: AssignmentSchedule,
    fieldGroups: Map<string, WorkerAssignment[]>,
): string {
    const generated = new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    const fieldsHTML = Array.from(fieldGroups.entries()).map(([, assignments]) => {
        const fieldAvg = assignments.reduce((s, a) => s + a.predictedEfficiency, 0) / assignments.length;
        const rowsHTML = assignments.map((a, i) =>
            `<tr class="${i % 2 !== 0 ? 'alt' : ''}">
                <td class="rank">${i + 1}</td>
                <td class="wname">${a.workerName}</td>
                <td class="eff">${a.predictedEfficiency.toFixed(2)} kg/hr</td>
                <td class="star">${a.predictedEfficiency >= 5 ? '⭐' : '✓'}</td>
            </tr>`
        ).join('');
        return `
        <div class="fb">
            <div class="fh">
                <span class="fn">${assignments[0].fieldName}</span>
                <span class="fm">${assignments.length} workers &nbsp;&middot;&nbsp; avg ${fieldAvg.toFixed(2)} kg/hr</span>
            </div>
            <table class="wt">
                <thead><tr><th>#</th><th>Worker Name</th><th>Predicted Output</th><th></th></tr></thead>
                <tbody>${rowsHTML}</tbody>
            </table>
        </div>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background:#fff}
    .hdr{background:#2d5016;padding:26px 30px}
    .logo{font-size:26px;font-weight:900;color:#fff;letter-spacing:1px}
    .logo-acc{color:#fbc02d}
    .hdr-sub{color:#a5d6a7;font-size:11px;margin-top:4px}
    .hdr-bar{width:36px;height:3px;background:#fbc02d;margin-top:10px;border-radius:2px}
    .title-row{background:#f1f8e9;padding:14px 30px;border-bottom:3px solid #7cb342;display:flex;justify-content:space-between;align-items:center}
    .sch-title{font-size:15px;font-weight:700;color:#2d5016}
    .sch-date{font-size:12px;color:#558b2f;font-weight:600;margin-top:3px}
    .gen-at{font-size:10px;color:#999;text-align:right}
    .stats{display:flex;border-bottom:1px solid #e8e8e8}
    .stat{flex:1;padding:14px 0;text-align:center;border-right:1px solid #e8e8e8}
    .stat:last-child{border-right:none}
    .sv{font-size:22px;font-weight:900;color:#7cb342}
    .sl{font-size:10px;color:#888;margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
    .content{padding:18px 30px}
    .sec-label{font-size:10px;font-weight:700;color:#7cb342;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e0e0e0}
    .fb{margin-bottom:18px;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden}
    .fh{background:#2d5016;padding:10px 14px;display:flex;justify-content:space-between;align-items:center}
    .fn{color:#fff;font-size:13px;font-weight:700}
    .fm{color:#a5d6a7;font-size:10px}
    .wt{width:100%;border-collapse:collapse}
    .wt thead tr{background:#f9f9f9}
    .wt th{font-size:10px;color:#999;text-transform:uppercase;font-weight:600;padding:7px 12px;text-align:left;border-bottom:1px solid #e8e8e8}
    .wt td{padding:9px 12px;font-size:12px;border-bottom:1px solid #f5f5f5}
    .wt tr:last-child td{border-bottom:none}
    .wt tr.alt{background:#fafafa}
    .rank{width:28px;color:#bbb;font-size:11px}
    .wname{font-weight:600;color:#333}
    .eff{color:#7cb342;font-weight:700}
    .star{color:#fbc02d;text-align:right;width:26px}
    .footer{background:#f5f5f5;border-top:1px solid #e0e0e0;padding:14px 30px;margin-top:6px}
    .ft{font-size:11px;color:#777;text-align:center}
    .ft-ml{font-size:9px;color:#bbb;margin-top:4px;text-align:center}
    .ft-acc{color:#7cb342;font-weight:600}
    </style></head><body>
    <div class="hdr">
        <div class="logo">Assis<span class="logo-acc">Tea</span></div>
        <div class="hdr-sub">Smart Plantation Management &middot; ML Labour Assignment</div>
        <div class="hdr-bar"></div>
    </div>
    <div class="title-row">
        <div><div class="sch-title">Daily Labour Assignment Schedule</div><div class="sch-date">📅 ${sched.date}</div></div>
        <div><div class="gen-at">Generated at</div><div class="gen-at">${generated}</div></div>
    </div>
    <div class="stats">
        <div class="stat"><div class="sv">${sched.totalWorkers}</div><div class="sl">Assigned Workers</div></div>
        <div class="stat"><div class="sv">${sched.totalFields}</div><div class="sl">Active Fields</div></div>
        <div class="stat"><div class="sv">${sched.averagePredictedEfficiency.toFixed(2)}</div><div class="sl">Avg kg/hr</div></div>
    </div>
    <div class="content">
        <div class="sec-label">Field Assignments</div>
        ${fieldsHTML}
    </div>
    <div class="footer">
        <div class="ft">Generated by <span class="ft-acc">AssisTea ML Labour Assignment System</span></div>
        <div class="ft-ml">Powered by TensorFlow Lite &middot; On-Device Neural Network &middot; Offline-Capable</div>
    </div>
    </body></html>`;
}
