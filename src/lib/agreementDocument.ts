import {
  RECRUITER_AGREEMENT_TITLE,
  KEY_CLAUSES,
  FULL_TERMS,
} from './recruiterAgreement';

// Builds a printable copy of the signed Recruiter Terms and Conditions,
// including the recruiter's initials, typed signature, and signing date,
// then hands it to the browser's print dialog (where "Save as PDF" is the
// usual choice). Rendered into a hidden iframe rather than a popup window
// so it is never blocked by a popup blocker.

export interface SignedRecord {
  signature?: string | null;
  initialsFee?: string | null;
  initialsComms?: string | null;
  acceptedAt?: string | null;
  recruiterName?: string | null;
  company?: string | null;
  email?: string | null;
}

const esc = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function buildAgreementDocumentHtml(record: SignedRecord): string {
  const signedDate = record.acceptedAt
    ? new Date(record.acceptedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  // Sections in document order, with the two initialed clauses rendered in
  // their numbered place so the printed copy is the complete agreement.
  const before = FULL_TERMS.filter(s => s.number === '' || Number(s.number) <= 4);
  const after = FULL_TERMS.filter(s => Number(s.number) >= 7);

  const renderSection = (s: { number: string; title: string; paragraphs: string[] }) => `
    <section>
      <h2>${s.number ? esc(s.number) + '. ' : ''}${esc(s.title)}</h2>
      ${s.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}
    </section>`;

  const renderKeyClause = (c: typeof KEY_CLAUSES[number], initials?: string | null) => `
    <section>
      <h2>${esc(c.number)}. ${esc(c.title)}${initials ? ` <span class="init">Initialed: ${esc(initials)}</span>` : ''}</h2>
      <ul>${c.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    </section>`;

  const partyRows = [
    record.recruiterName ? `<tr><td>Name</td><td>${esc(record.recruiterName)}</td></tr>` : '',
    record.company ? `<tr><td>Company</td><td>${esc(record.company)}</td></tr>` : '',
    record.email ? `<tr><td>Email</td><td>${esc(record.email)}</td></tr>` : '',
    signedDate ? `<tr><td>Date signed</td><td>${esc(signedDate)}</td></tr>` : '',
  ].filter(Boolean).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>${esc(RECRUITER_AGREEMENT_TITLE)}</title>
<style>
  @page { margin: 22mm 18mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.55; font-size: 11pt; }
  h1 { font-size: 17pt; margin: 0 0 4px; }
  h2 { font-size: 11.5pt; margin: 18px 0 6px; page-break-after: avoid; }
  p, li { margin: 0 0 8px; }
  ul { padding-left: 18px; margin: 0 0 8px; }
  .brand { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: #008037; font-weight: bold; }
  .init { font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #008037; border: 1px solid #008037; border-radius: 3px; padding: 1px 6px; margin-left: 6px; white-space: nowrap; }
  table { border-collapse: collapse; margin: 10px 0 0; font-family: Helvetica, Arial, sans-serif; font-size: 10pt; }
  td { padding: 3px 18px 3px 0; vertical-align: top; }
  td:first-child { color: #666; }
  .sig { margin-top: 26px; padding-top: 14px; border-top: 1px solid #ccc; page-break-inside: avoid; }
  .signame { font-size: 20pt; font-style: italic; margin: 6px 0 2px; }
  .rule { border-bottom: 1px solid #333; width: 62%; margin-bottom: 4px; }
  .note { font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #666; }
</style></head>
<body>
  <div class="brand">SFC Talent</div>
  <h1>${esc(RECRUITER_AGREEMENT_TITLE)}</h1>
  ${partyRows ? `<table>${partyRows}</table>` : ''}

  ${before.map(renderSection).join('')}
  ${renderKeyClause(KEY_CLAUSES[0], record.initialsFee)}
  ${renderKeyClause(KEY_CLAUSES[1], record.initialsComms)}
  ${after.map(renderSection).join('')}

  <div class="sig">
    <h2 style="margin-top:0">Signature</h2>
    <div class="signame">${esc(record.signature || '')}</div>
    <div class="rule"></div>
    <div class="note">
      Signed electronically${signedDate ? ` on ${esc(signedDate)}` : ''}.
      Initials recorded: Placement Fee ${esc(record.initialsFee || '')}, Communications ${esc(record.initialsComms || '')}.
    </div>
  </div>
</body></html>`;
}

/** Renders the document into a hidden iframe and opens the print dialog. */
export function printAgreementDocument(record: SignedRecord): void {
  const html = buildAgreementDocumentHtml(record);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow!;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => { try { iframe.remove(); } catch { /* already gone */ } }, 300);
  };
  win.onafterprint = cleanup;
  setTimeout(() => { try { win.focus(); win.print(); } catch { cleanup(); } }, 250);
  // Backstop for browsers that never fire onafterprint.
  setTimeout(cleanup, 60000);
}
