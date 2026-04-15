import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_MR    = ['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];

// ── Helpers ─────────────────────────────────────────────────────────────────
async function fetchAll(year) {
  const [summary, outstanding, ledger, monthly, monthlyDetail] = await Promise.all([
    axios.get(`/api/maintenance/summary/${year}`),
    axios.get(`/api/outstanding?year=${year}`),
    axios.get(`/api/ledger?year=${year}`),
    axios.get(`/api/ledger/monthly-summary/${year}`),
    axios.get(`/api/ledger/monthly-detail/${year}`),
  ]);
  return {
    summary: summary.data,
    outstanding: outstanding.data,
    ledger: ledger.data,
    monthly: monthly.data,
    monthlyDetail: monthlyDetail.data,
  };
}

function bufToB64(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fmt(n) { return `₹${(n || 0).toLocaleString('en-IN')}`; }

// ── HTML Page Renderers (each returns an HTML string for one PDF page) ──────
function styleBlock(fontFace) {
  return `<style>
    ${fontFace}
    * { margin:0; padding:0; box-sizing:border-box; }
    body, div, td, th, p, span {
      font-family: 'NotoSansDevanagari', 'Noto Sans Devanagari', 'Mangal', Arial, sans-serif !important;
    }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1e40af; color: #fff; font-size: 11px; padding: 5px 6px; text-align: left; }
    td { font-size: 10px; padding: 4px 6px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f8fafc; }
    .page { width:1122px; min-height:793px; background:#fff; padding:30px; }
    .page-title { font-size:20px; font-weight:700; color:#1e3a8a; margin-bottom:16px; border-bottom:3px solid #1e3a8a; padding-bottom:8px; }
    .footer { position:absolute; bottom:16px; left:30px; right:30px; font-size:9px; color:#9ca3af; display:flex; justify-content:space-between; }
  </style>`;
}

function renderCover(year, totalCollected, totalOutstanding, totalReceipts, netBalance, fontFace) {
  return `${styleBlock(fontFace)}
  <div style="width:1122px;height:793px;background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 60%,#3b82f6 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;padding:40px;">
    <div style="font-size:13px;letter-spacing:3px;color:#bfdbfe;margin-bottom:8px;">CENTRAL PARK HOUSING SOCIETY</div>
    <div style="font-size:36px;font-weight:700;margin-bottom:6px;">सेंट्रल पार्क सोसायटी</div>
    <div style="font-size:22px;color:#dbeafe;margin-bottom:4px;">वार्षिक देखभाल अहवाल</div>
    <div style="font-size:18px;color:#bfdbfe;margin-bottom:40px;">Annual Maintenance Report — ${year}</div>
    <div style="width:80%;height:2px;background:rgba(255,255,255,0.3);margin-bottom:40px;"></div>
    <div style="display:flex;gap:24px;width:90%;justify-content:center;">
      ${[
        { mr:'एकूण जमा', en:'Total Collected', val:fmt(totalCollected), color:'#bbf7d0', bg:'rgba(22,163,74,0.2)', border:'rgba(22,163,74,0.5)' },
        { mr:'एकूण थकबाकी', en:'Total Outstanding', val:fmt(totalOutstanding), color:'#fecaca', bg:'rgba(220,38,38,0.2)', border:'rgba(220,38,38,0.5)' },
        { mr:'एकूण उत्पन्न', en:'Total Income', val:fmt(totalReceipts), color:'#bae6fd', bg:'rgba(14,165,233,0.2)', border:'rgba(14,165,233,0.5)' },
        { mr:'निव्वळ शिल्लक', en:'Net Balance', val:fmt(netBalance), color:'#e9d5ff', bg:'rgba(109,40,217,0.2)', border:'rgba(109,40,217,0.5)' },
      ].map(b => `
        <div style="flex:1;background:${b.bg};border:1px solid ${b.border};border-radius:12px;padding:20px;text-align:center;">
          <div style="font-size:13px;color:${b.color};font-weight:600;margin-bottom:4px;">${b.mr}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.6);margin-bottom:10px;">${b.en}</div>
          <div style="font-size:22px;font-weight:700;color:#fff;">${b.val}</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:40px;font-size:11px;color:rgba(255,255,255,0.5);">
      Generated: ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
    </div>
  </div>`;
}

function renderMaintenance(year, summary, fontFace) {
  const totalPaid    = summary.reduce((s,f)=>s+(f.total_paid||0),0);
  const totalPending = summary.filter(f=>f.pending_months>0).length;
  return `${styleBlock(fontFace)}
  <div class="page" style="position:relative;">
    <div class="page-title">📋 देखभाल संकलन — Maintenance Collection ${year}</div>
    <div style="display:flex;gap:16px;margin-bottom:16px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 20px;text-align:center;">
        <div style="font-size:11px;color:#15803d;">एकूण जमा / Total Collected</div>
        <div style="font-size:20px;font-weight:700;color:#166534;">${fmt(totalPaid)}</div>
      </div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 20px;text-align:center;">
        <div style="font-size:11px;color:#dc2626;">थकित सदस्य / Pending Members</div>
        <div style="font-size:20px;font-weight:700;color:#991b1b;">${totalPending} flats</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:70px;">फ्लॅट / Flat</th>
          <th>मालकाचे नाव / Owner Name</th>
          <th style="width:80px;text-align:right;">एकूण जमा</th>
          <th style="width:80px;text-align:right;">थकित महिने</th>
          <th style="width:80px;text-align:center;">स्थिती</th>
        </tr>
      </thead>
      <tbody>
        ${summary.map(f => `
          <tr>
            <td style="font-weight:700;color:#1e40af;">${f.flat_no}</td>
            <td>${f.owner_name || '—'}</td>
            <td style="text-align:right;color:#15803d;font-weight:600;">${fmt(f.total_paid)}</td>
            <td style="text-align:right;color:${(f.pending_months||0)>0?'#dc2626':'#15803d'};">${f.pending_months || 0}</td>
            <td style="text-align:center;">
              <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:600;
                background:${(f.pending_months||0)===0?'#dcfce7':'#fef2f2'};
                color:${(f.pending_months||0)===0?'#166534':'#dc2626'}">
                ${(f.pending_months||0)===0?'✅ Clear':'⚠ Pending'}
              </span>
            </td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#eff6ff;">
          <td colspan="2" style="font-weight:700;color:#1e40af;">एकूण TOTAL</td>
          <td style="text-align:right;font-weight:700;color:#166534;">${fmt(totalPaid)}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <span>सेंट्रल पार्क सोसायटी — Maintenance Collection Report ${year}</span>
      <span>Page 2</span>
    </div>
  </div>`;
}

function renderOutstanding(year, outstanding, fontFace) {
  const total = outstanding.reduce((s,r)=>s+(r.total_outstanding||0),0);
  return `${styleBlock(fontFace)}
  <div class="page" style="position:relative;">
    <div class="page-title">⚠️ थकबाकी — Outstanding Dues ${year}</div>
    <table>
      <thead>
        <tr>
          <th style="width:70px;">फ्लॅट</th>
          <th>मालक / Owner</th>
          <th style="text-align:right;">देखभाल</th>
          <th style="text-align:right;">Audit Fee</th>
          <th style="text-align:right;">3Ph Motor</th>
          <th style="text-align:right;">Conv.Deed</th>
          <th style="text-align:right;">Toilet Tank</th>
          <th style="text-align:right;width:90px;">एकूण थकबाकी</th>
        </tr>
      </thead>
      <tbody>
        ${outstanding.map(r => `
          <tr>
            <td style="font-weight:700;color:#1e40af;">${r.flat_no}</td>
            <td>${r.owner_name || '—'}</td>
            <td style="text-align:right;">${(r.maintenance_outstanding||0)>0?fmt(r.maintenance_outstanding):'—'}</td>
            <td style="text-align:right;">${(r.audit_fee||0)>0?fmt(r.audit_fee):'—'}</td>
            <td style="text-align:right;">${(r.three_phase_motor||0)>0?fmt(r.three_phase_motor):'—'}</td>
            <td style="text-align:right;">${(r.conveyance_deed_fee||0)>0?fmt(r.conveyance_deed_fee):'—'}</td>
            <td style="text-align:right;">${(r.toilet_tank_cleaning||0)>0?fmt(r.toilet_tank_cleaning):'—'}</td>
            <td style="text-align:right;font-weight:700;color:${(r.total_outstanding||0)>0?'#dc2626':'#15803d'};">
              ${(r.total_outstanding||0)>0?fmt(r.total_outstanding):'✅ Clear'}
            </td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#fff1f2;">
          <td colspan="2" style="font-weight:700;color:#dc2626;">एकूण TOTAL</td>
          <td style="text-align:right;font-weight:600;">${fmt(outstanding.reduce((s,r)=>s+(r.maintenance_outstanding||0),0))}</td>
          <td style="text-align:right;font-weight:600;">${fmt(outstanding.reduce((s,r)=>s+(r.audit_fee||0),0))}</td>
          <td style="text-align:right;font-weight:600;">${fmt(outstanding.reduce((s,r)=>s+(r.three_phase_motor||0),0))}</td>
          <td style="text-align:right;font-weight:600;">${fmt(outstanding.reduce((s,r)=>s+(r.conveyance_deed_fee||0),0))}</td>
          <td style="text-align:right;font-weight:600;">${fmt(outstanding.reduce((s,r)=>s+(r.toilet_tank_cleaning||0),0))}</td>
          <td style="text-align:right;font-weight:700;color:#dc2626;">${fmt(total)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <span>सेंट्रल पार्क सोसायटी — Outstanding Dues Report ${year}</span>
      <span>Page 3</span>
    </div>
  </div>`;
}

function renderLedger(year, ledger, totalReceipts, totalPayments, fontFace) {
  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${styleBlock(fontFace)}
  <div class="page" style="position:relative;">
    <div class="page-title">📒 जमा-खर्च — Income &amp; Expense Ledger ${year}</div>
    <table>
      <thead>
        <tr>
          <th style="width:70px;">दिनांक/Date</th>
          <th style="width:70px;">Flat/Ref</th>
          <th>तपशील / Details</th>
          <th style="width:60px;">Mode</th>
          <th style="width:55px;">प्रकार</th>
          <th style="text-align:right;width:90px;">जमा (Receipt)</th>
          <th style="text-align:right;width:90px;">खर्च (Payment)</th>
        </tr>
      </thead>
      <tbody>
        ${ledger.map(e => `
          <tr>
            <td style="color:#6b7280;">${e.entry_date || (MONTH_SHORT[(e.month||1)-1]+' '+year)}</td>
            <td style="font-weight:600;color:#1e40af;">${e.voucher_no||'—'}</td>
            <td>${e.details||'—'}</td>
            <td style="color:#6b7280;font-size:9px;">${e.payment_mode||'—'}</td>
            <td style="text-align:center;">
              <span style="display:inline-block;padding:1px 6px;border-radius:10px;font-size:8px;font-weight:600;
                background:${e.type==='receipt'?'#dcfce7':'#fee2e2'};
                color:${e.type==='receipt'?'#166534':'#dc2626'}">
                ${e.type==='receipt'?'REC':'PAY'}
              </span>
            </td>
            <td style="text-align:right;color:#15803d;font-weight:600;">${e.type==='receipt'?fmt(e.amount):''}</td>
            <td style="text-align:right;color:#dc2626;font-weight:600;">${e.type==='payment'?fmt(e.amount):''}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#f0fdf4;">
          <td colspan="5" style="font-weight:700;">एकूण TOTAL</td>
          <td style="text-align:right;font-weight:700;color:#15803d;">${fmt(totalReceipts)}</td>
          <td style="text-align:right;font-weight:700;color:#dc2626;">${fmt(totalPayments)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <span>सेंट्रल पार्क सोसायटी — Ledger Report ${year}</span>
      <span>Page 4</span>
    </div>
  </div>`;
}

function renderMonthly(year, monthly, totalReceipts, totalPayments, fontFace) {
  const netBalance = totalReceipts - totalPayments;
  return `${styleBlock(fontFace)}
  <div class="page" style="position:relative;">
    <div class="page-title">📅 मासिक सारांश — Monthly Summary ${year}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <table>
        <thead>
          <tr>
            <th>महिना / Month</th>
            <th style="text-align:right;">मागील शिल्लक</th>
            <th style="text-align:right;">जमा (Receipt)</th>
            <th style="text-align:right;">खर्च (Payment)</th>
            <th style="text-align:right;">समाप्ती शिल्लक</th>
          </tr>
        </thead>
        <tbody>
          ${monthly.map(m => {
            const mIdx = (m.month||1) - 1;
            return `<tr>
              <td style="font-weight:600;">${MONTH_MR[mIdx]} / ${MONTH_NAMES[mIdx]}</td>
              <td style="text-align:right;color:#6b7280;">${fmt(m.opening_balance||0)}</td>
              <td style="text-align:right;color:#15803d;font-weight:600;">${fmt(m.total_receipts||0)}</td>
              <td style="text-align:right;color:#dc2626;font-weight:600;">${fmt(m.total_payments||0)}</td>
              <td style="text-align:right;font-weight:700;color:${(m.closing_balance||0)>=0?'#1d4ed8':'#ea580c'};">${fmt(m.closing_balance||0)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#eff6ff;">
            <td style="font-weight:700;color:#1e40af;">एकूण TOTAL</td>
            <td></td>
            <td style="text-align:right;font-weight:700;color:#15803d;">${fmt(totalReceipts)}</td>
            <td style="text-align:right;font-weight:700;color:#dc2626;">${fmt(totalPayments)}</td>
            <td style="text-align:right;font-weight:700;color:${netBalance>=0?'#1d4ed8':'#ea580c'};">${fmt(netBalance)}</td>
          </tr>
        </tfoot>
      </table>
      <div>
        <div style="background:#f0fdf4;border-radius:12px;padding:24px;margin-bottom:16px;border:2px solid #bbf7d0;">
          <div style="font-size:13px;color:#15803d;margin-bottom:4px;">एकूण जमा / Total Receipts</div>
          <div style="font-size:28px;font-weight:700;color:#166534;">${fmt(totalReceipts)}</div>
        </div>
        <div style="background:#fef2f2;border-radius:12px;padding:24px;margin-bottom:16px;border:2px solid #fecaca;">
          <div style="font-size:13px;color:#dc2626;margin-bottom:4px;">एकूण खर्च / Total Payments</div>
          <div style="font-size:28px;font-weight:700;color:#991b1b;">${fmt(totalPayments)}</div>
        </div>
        <div style="background:${netBalance>=0?'#eff6ff':'#fff7ed'};border-radius:12px;padding:24px;border:2px solid ${netBalance>=0?'#bfdbfe':'#fed7aa'};">
          <div style="font-size:13px;color:${netBalance>=0?'#1d4ed8':'#ea580c'};margin-bottom:4px;">निव्वळ शिल्लक / Net Balance</div>
          <div style="font-size:28px;font-weight:700;color:${netBalance>=0?'#1e3a8a':'#c2410c'};">${fmt(netBalance)}</div>
        </div>
      </div>
    </div>
    <div class="footer">
      <span>सेंट्रल पार्क सोसायटी — Monthly Summary Report ${year}</span>
      <span>Page 5</span>
    </div>
  </div>`;
}

// ── Month-wise Excel-style page (receipts left | payments right) ─────────────
function renderMonthWise(year, monthData, pageNum, fontFace) {
  const mIdx = (monthData.month || 1) - 1;
  const monthName = MONTH_NAMES[mIdx];
  const monthMr = MONTH_MR[mIdx];
  const flatCount = monthData.receipts.filter(r => r.voucher_no && r.voucher_no.startsWith('FLAT')).length;
  const maintenancePerFlat = flatCount > 0
    ? Math.round((monthData.total_receipts - (monthData.opening_balance || 0)) / flatCount)
    : 0;

  const maxRows = Math.max(monthData.receipts.length, monthData.payments.length);
  const rows = Array.from({ length: maxRows }, (_, i) => ({
    r: monthData.receipts[i] || null,
    p: monthData.payments[i] || null,
  }));

  return `${styleBlock(fontFace)}
  <div class="page" style="position:relative;">
    <!-- Header -->
    <div style="background:#1e3a8a;color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:14px;font-weight:700;">सेंट्रल पार्क सहकारी गृहनिर्माण संस्था</div>
      <div style="display:flex;gap:24px;font-size:11px;">
        <span>महिना: <strong>${monthMr} / ${monthName}</strong></span>
        <span>वर्ष: <strong>${year}</strong></span>
      </div>
    </div>

    <!-- Two-column table: Receipts | Payments -->
    <table style="table-layout:fixed;">
      <colgroup>
        <col style="width:28px;"><col style="width:50px;"><col style="width:85px;"><col style="width:"><col style="width:55px;"><col style="width:65px;">
        <col style="width:12px;">
        <col style="width:28px;"><col style="width:50px;"><col style="width:85px;"><col style="width:"><col style="width:55px;"><col style="width:65px;">
      </colgroup>
      <thead>
        <tr>
          <th colspan="6" style="background:#16a34a;text-align:center;font-size:12px;padding:6px;">📥 जमा (RECEIPTS — जमा वसुली)</th>
          <th style="background:#e5e7eb;padding:0;"></th>
          <th colspan="6" style="background:#dc2626;text-align:center;font-size:12px;padding:6px;">📤 खर्च (PAYMENTS — खर्च वसुली)</th>
        </tr>
        <tr style="background:#f0fdf4;">
          <th style="font-size:9px;background:#dcfce7;color:#166534;">क्र.</th>
          <th style="font-size:9px;background:#dcfce7;color:#166534;">तारीख</th>
          <th style="font-size:9px;background:#dcfce7;color:#166534;">फ्लॅट/Ref</th>
          <th style="font-size:9px;background:#dcfce7;color:#166534;">तपशील</th>
          <th style="font-size:9px;background:#dcfce7;color:#166534;">Mode</th>
          <th style="font-size:9px;background:#dcfce7;color:#166534;text-align:right;">रक्कम</th>
          <th style="background:#e5e7eb;"></th>
          <th style="font-size:9px;background:#fee2e2;color:#991b1b;">क्र.</th>
          <th style="font-size:9px;background:#fee2e2;color:#991b1b;">तारीख</th>
          <th style="font-size:9px;background:#fee2e2;color:#991b1b;">Ref</th>
          <th style="font-size:9px;background:#fee2e2;color:#991b1b;">खर्च तपशील</th>
          <th style="font-size:9px;background:#fee2e2;color:#991b1b;">Mode</th>
          <th style="font-size:9px;background:#fee2e2;color:#991b1b;text-align:right;">रक्कम</th>
        </tr>
        <!-- Opening Balance row -->
        <tr>
          <td style="background:#f0fdf4;font-size:9px;color:#6b7280;">—</td>
          <td style="background:#f0fdf4;font-size:9px;color:#6b7280;">—</td>
          <td colspan="2" style="background:#f0fdf4;font-size:9px;font-weight:700;color:#1e40af;">मागील शिल्लक / Opening Balance</td>
          <td style="background:#f0fdf4;font-size:9px;">—</td>
          <td style="background:#f0fdf4;font-size:9px;font-weight:700;color:#1e40af;text-align:right;">${fmt(monthData.opening_balance||0)}</td>
          <td style="background:#e5e7eb;"></td>
          <td colspan="6" style="background:#fff7ed;font-size:9px;color:#6b7280;text-align:center;">—</td>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, i) => {
          const r = row.r, p = row.p;
          return `<tr>
            <td style="font-size:9px;color:#6b7280;">${r ? i+1 : ''}</td>
            <td style="font-size:9px;">${r ? (r.entry_date || (monthName.slice(0,3)+' '+year)) : ''}</td>
            <td style="font-size:9px;font-weight:600;color:#1e40af;">${r ? (r.voucher_no||'—') : ''}</td>
            <td style="font-size:9px;">${r ? (r.details||'—') : ''}</td>
            <td style="font-size:9px;color:#6b7280;">${r ? (r.payment_mode||'—') : ''}</td>
            <td style="font-size:9px;font-weight:600;color:#15803d;text-align:right;">${r ? fmt(r.amount) : ''}</td>
            <td style="background:#e5e7eb;"></td>
            <td style="font-size:9px;color:#6b7280;">${p ? i+1 : ''}</td>
            <td style="font-size:9px;">${p ? (p.entry_date || (monthName.slice(0,3)+' '+year)) : ''}</td>
            <td style="font-size:9px;font-weight:600;color:#dc2626;">${p ? (p.voucher_no||'—') : ''}</td>
            <td style="font-size:9px;">${p ? (p.details||'—') : ''}</td>
            <td style="font-size:9px;color:#6b7280;">${p ? (p.payment_mode||'—') : ''}</td>
            <td style="font-size:9px;font-weight:600;color:#dc2626;text-align:right;">${p ? fmt(p.amount) : ''}</td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#f0fdf4;">
          <td colspan="5" style="font-weight:700;color:#166534;font-size:10px;">एकूण Total</td>
          <td style="font-weight:700;color:#166534;text-align:right;font-size:11px;">${fmt(monthData.total_receipts + (monthData.opening_balance||0))}</td>
          <td style="background:#e5e7eb;"></td>
          <td colspan="5" style="font-weight:700;color:#991b1b;font-size:10px;">एकूण Total</td>
          <td style="font-weight:700;color:#991b1b;text-align:right;font-size:11px;">${fmt(monthData.total_payments)}</td>
        </tr>
        <tr style="background:#eff6ff;">
          <td colspan="5" style="font-weight:700;color:#1e40af;font-size:10px;">समाप्ती शिल्लक / Closing Balance</td>
          <td style="font-weight:700;color:#1e40af;text-align:right;font-size:12px;">${fmt(monthData.closing_balance)}</td>
          <td style="background:#e5e7eb;"></td>
          <td colspan="5" style="font-size:10px;color:#6b7280;">
            ${flatCount > 0 ? `देखभाल प्रति फ्लॅट / Maintenance Per Flat` : ''}
          </td>
          <td style="font-weight:700;color:#7c3aed;text-align:right;font-size:11px;">
            ${flatCount > 0 ? fmt(maintenancePerFlat) : ''}
          </td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <span>सेंट्रल पार्क सोसायटी — ${monthMr} ${year} जमा-खर्च अहवाल</span>
      <span>Page ${pageNum}</span>
    </div>
  </div>`;
}

// ── Shared: load font + create doc + addHtmlPage helper ─────────────────────
async function loadFont(onProgress) {
  onProgress('Loading Devanagari font…');
  let fontFace = '';
  try {
    const res = await fetch('/fonts/NotoSansDevanagari-Regular.ttf');
    if (res.ok) {
      const b64 = bufToB64(await res.arrayBuffer());
      fontFace = `@font-face { font-family: 'NotoSansDevanagari'; src: url(data:font/truetype;base64,${b64}) format('truetype'); }`;
    }
  } catch (e) { console.warn('Font load failed:', e); }
  return fontFace;
}

function makeDoc() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210;
  let first = true;

  // autoHeight=true → captures full table height and splits into multiple A4 pages if needed
  async function addPage(html, { autoHeight = false } = {}) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:-99999px;left:-99999px;width:1122px;background:#fff;z-index:-1;';
    div.innerHTML = html;
    document.body.appendChild(div);
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 300));

    const renderH = autoHeight ? Math.max(793, div.scrollHeight + 20) : 793;

    const canvas = await html2canvas(div, {
      scale: 1.5, width: 1122, height: renderH,
      backgroundColor: '#ffffff', useCORS: true, logging: false, allowTaint: true,
    });
    document.body.removeChild(div);

    // One A4 page = 793px × 1.5 scale = 1190px on canvas
    const pageH = Math.round(793 * 1.5);
    const totalPages = Math.ceil(canvas.height / pageH);

    for (let p = 0; p < totalPages; p++) {
      if (!first) doc.addPage();
      first = false;

      const srcY = p * pageH;
      const srcH = Math.min(pageH, canvas.height - srcY);

      // Create a full-A4 canvas slice (white-padded on last partial page)
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = pageH;
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
    }
  }
  return { doc, addPage };
}

// ── Annual Report PDF (Cover + Maintenance + Outstanding + Monthly Summary) ──
async function generateAnnualPDF(year, data, onProgress) {
  const { summary, outstanding, ledger, monthly } = data;
  const totalCollected   = summary.reduce((s, f) => s + (f.total_paid || 0), 0);
  const totalOutstanding = outstanding.reduce((s, r) => s + (r.total_outstanding || 0), 0);
  const totalReceipts    = ledger.filter(e => e.type === 'receipt').reduce((s, e) => s + e.amount, 0);
  const totalPayments    = ledger.filter(e => e.type === 'payment').reduce((s, e) => s + e.amount, 0);
  const netBalance       = totalReceipts - totalPayments;

  const fontFace = await loadFont(onProgress);
  const { doc, addPage } = makeDoc();

  onProgress('Rendering cover page…');
  await addPage(renderCover(year, totalCollected, totalOutstanding, totalReceipts, netBalance, fontFace));

  onProgress('Rendering maintenance page…');
  await addPage(renderMaintenance(year, summary, fontFace));

  onProgress('Rendering outstanding dues page…');
  await addPage(renderOutstanding(year, outstanding, fontFace));

  onProgress('Rendering monthly summary page…');
  await addPage(renderMonthly(year, monthly, totalReceipts, totalPayments, fontFace));

  onProgress('Saving PDF…');
  doc.save(`CentralPark_AnnualReport_${year}.pdf`);
}

// ── Monthly जमा-खर्च PDF (one Excel-style page per month) ───────────────────
async function generateMonthlyPDF(year, data, onProgress) {
  const { monthlyDetail } = data;

  if (!monthlyDetail || monthlyDetail.length === 0) {
    throw new Error('No monthly data available for ' + year);
  }

  const fontFace = await loadFont(onProgress);
  const { doc, addPage } = makeDoc();

  for (let i = 0; i < monthlyDetail.length; i++) {
    const mData = monthlyDetail[i];
    const mName = MONTH_NAMES[(mData.month||1)-1];
    onProgress(`Rendering ${mName} जमा-खर्च… (${i+1}/${monthlyDetail.length})`);
    // autoHeight: true — captures all rows, splits into multiple A4 pages if needed
    await addPage(renderMonthWise(year, mData, i + 1, fontFace), { autoHeight: true });
  }

  onProgress('Saving PDF…');
  doc.save(`CentralPark_MasikReport_${year}.pdf`);
}

// ── React Component ──────────────────────────────────────────────────────────
export default function Reports() {
  const { t } = useTranslation();
  const [year, setYear]           = useState(2024);
  const [month, setMonth]         = useState(0); // 0 = all months
  const [loading, setLoading]     = useState(false);
  const [loadingType, setLType]   = useState(''); // 'fetch' | 'annual' | 'monthly'
  const [progress, setProgress]   = useState('');
  const [preview, setPreview]     = useState(null);

  const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  const handleGenerate = async () => {
    setLoading(true); setLType('fetch'); setPreview(null);
    setProgress('Fetching data…');
    try {
      const data = await fetchAll(year);
      setPreview(data);
      toast.success('Data loaded! आता PDF download करा.');
    } catch { toast.error('Error loading data'); }
    finally { setLoading(false); setLType(''); setProgress(''); }
  };

  const handleAnnualDownload = async () => {
    setLoading(true); setLType('annual');
    try {
      const data = preview || await fetchAll(year);
      if (!preview) setPreview(data);
      await generateAnnualPDF(year, data, (msg) => setProgress(msg));
      toast.success('वार्षिक अहवाल PDF downloaded! ✅');
    } catch (e) {
      console.error(e);
      toast.error('PDF generation failed: ' + e.message);
    }
    finally { setLoading(false); setLType(''); setProgress(''); }
  };

  const handleMonthlyDownload = async () => {
    setLoading(true); setLType('monthly');
    try {
      const data = preview || await fetchAll(year);
      if (!preview) setPreview(data);

      // Filter to selected month if user picked one, else all months
      const filteredDetail = month > 0
        ? (data.monthlyDetail || []).filter(m => m.month === month)
        : (data.monthlyDetail || []);

      if (filteredDetail.length === 0) {
        const mLabel = month > 0 ? MONTH_MR[month - 1] : '';
        toast.error(`${mLabel} ${year} साठी डाटा नाही!`);
        return;
      }

      await generateMonthlyPDF(year, { ...data, monthlyDetail: filteredDetail }, (msg) => setProgress(msg));
      const label = month > 0 ? `${MONTH_MR[month-1]} ${year}` : `${year} (सर्व महिने)`;
      toast.success(`मासिक जमा-खर्च PDF downloaded — ${label} ✅`);
    } catch (e) {
      console.error(e);
      toast.error('PDF generation failed: ' + e.message);
    }
    finally { setLoading(false); setLType(''); setProgress(''); }
  };

  const totalCollected   = preview?.summary.reduce((s,f)=>s+(f.total_paid||0),0) || 0;
  const totalOutstanding = preview?.outstanding.reduce((s,r)=>s+(r.total_outstanding||0),0) || 0;
  const totalReceipts    = preview?.ledger.filter(e=>e.type==='receipt').reduce((s,e)=>s+e.amount,0) || 0;
  const totalPayments    = preview?.ledger.filter(e=>e.type==='payment').reduce((s,e)=>s+e.amount,0) || 0;
  const netBalance       = totalReceipts - totalPayments;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Controls */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-800 mb-1">📄 {t('annual_report')}</h2>
        <p className="text-sm text-gray-500 mb-4">
          वर्ष आणि महिना निवडा → <strong>Load Data</strong> → नंतर हवा तो PDF download करा
        </p>

        {/* Year + Month selectors */}
        <div className="flex gap-3 items-end flex-wrap mb-4">
          <div>
            <label className="label">{t('year')} — वर्ष</label>
            <select value={year} onChange={e => { setYear(Number(e.target.value)); setPreview(null); }} className="input w-28">
              {[2023, 2024, 2025].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">महिना (मासिक PDF साठी)</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input w-40">
              <option value={0}>📅 सर्व महिने</option>
              {MONTH_KEYS.map((mk, i) => (
                <option key={i} value={i + 1}>{MONTH_MR[i]} ({MONTH_NAMES[i]})</option>
              ))}
            </select>
          </div>
          <button onClick={handleGenerate} disabled={loading} className="btn-secondary">
            {loading && loadingType === 'fetch' ? '⏳ Loading...' : '📊 Load Data'}
          </button>
        </div>

        {/* PDF Download Buttons — shown after data loads */}
        {preview && (
          <div className="flex gap-3 flex-wrap p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-full text-xs text-gray-500 mb-1 font-medium">
              ✅ Data loaded for {year} — PDF निवडा:
            </div>
            <button
              onClick={handleAnnualDownload}
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              {loading && loadingType === 'annual'
                ? <><span className="animate-spin inline-block">⏳</span> Generating...</>
                : <>📊 वार्षिक अहवाल PDF — {year}</>
              }
            </button>
            <button
              onClick={handleMonthlyDownload}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition flex items-center gap-2"
            >
              {loading && loadingType === 'monthly'
                ? <><span className="animate-spin inline-block">⏳</span> Generating...</>
                : <>📅 {month > 0 ? `${MONTH_MR[month-1]} ${year}` : `सर्व महिने ${year}`} — जमा-खर्च PDF</>
              }
            </button>
          </div>
        )}

        {/* Progress bar */}
        {loading && progress && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-700 font-medium">{progress}</span>
            </div>
            <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3"></div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {preview && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon:'💰', label:t('total_collected'),   val:`₹${totalCollected.toLocaleString('en-IN')}`,   color:'border-green-500 bg-green-50 text-green-800'  },
              { icon:'⚠️', label:t('total_outstanding'), val:`₹${totalOutstanding.toLocaleString('en-IN')}`, color:'border-red-500 bg-red-50 text-red-800'    },
              { icon:'📈', label:'Total Income',         val:`₹${totalReceipts.toLocaleString('en-IN')}`,    color:'border-blue-500 bg-blue-50 text-blue-800'   },
              { icon:'💵', label:t('net_balance'),       val:`₹${netBalance.toLocaleString('en-IN')}`,       color:'border-purple-500 bg-purple-50 text-purple-800' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border-l-4 p-4 ${s.color}`}>
                <p className="text-xs opacity-70">{s.icon} {s.label}</p>
                <p className="text-xl font-bold mt-1">{s.val}</p>
              </div>
            ))}
          </div>

          {/* Monthly Table Preview */}
          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-3">{t('monthly_summary')} — {year}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header">{t('month')}</th>
                    <th className="table-header text-right text-gray-500">मागील शिल्लक</th>
                    <th className="table-header text-right text-green-700">📥 {t('receipt')}</th>
                    <th className="table-header text-right text-red-600">📤 {t('payment')}</th>
                    <th className="table-header text-right text-blue-700">💰 समाप्ती शिल्लक</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.monthly.map(m => {
                    const mIdx = (m.month||1) - 1;
                    return (
                      <tr key={m.month} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">
                          {MONTH_MR[mIdx]} / {MONTH_NAMES[mIdx]}
                        </td>
                        <td className="table-cell text-right text-gray-400 text-xs">
                          ₹{(m.opening_balance||0).toLocaleString('en-IN')}
                        </td>
                        <td className="table-cell text-right text-green-700 font-semibold">
                          ₹{(m.total_receipts||0).toLocaleString('en-IN')}
                        </td>
                        <td className="table-cell text-right text-red-600 font-semibold">
                          ₹{(m.total_payments||0).toLocaleString('en-IN')}
                        </td>
                        <td className={`table-cell text-right font-bold ${(m.closing_balance||0)>=0?'text-blue-700':'text-orange-600'}`}>
                          ₹{(m.closing_balance||0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Outstanding */}
          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-3">🔴 Top Outstanding Dues — {year}</h3>
            <div className="space-y-2">
              {[...preview.outstanding]
                .filter(r => r.total_outstanding > 0)
                .sort((a,b) => b.total_outstanding - a.total_outstanding)
                .slice(0, 10)
                .map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="font-semibold text-blue-700">{r.flat_no}</span>
                    <span className="text-gray-600 text-sm ml-2">{r.owner_name}</span>
                  </div>
                  <span className="text-red-700 font-bold">₹{r.total_outstanding.toLocaleString('en-IN')}</span>
                </div>
              ))}
              {preview.outstanding.filter(r=>r.total_outstanding>0).length === 0 && (
                <div className="text-center py-4 text-green-600 font-medium">✅ No outstanding dues!</div>
              )}
            </div>
          </div>
        </>
      )}

      {!preview && (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">📊</div>
          <p className="text-lg font-medium">वर्ष निवडा आणि <strong className="text-gray-600">Load Data</strong> क्लिक करा</p>
          <p className="text-sm mt-2">PDF मध्ये मराठी नावे बरोबर दिसतील ✅</p>
        </div>
      )}
    </div>
  );
}
