'use client';

import { useMemo, useRef, useState } from 'react';
import {
  buildResumeDocument,
  buildWordDocument,
  RESUME_TEMPLATES,
  type ResumeTemplate,
} from '@/lib/resume-html';

interface ResumeDocumentProps {
  resumeText: string;
  name?: string | null;
  contact?: string | null;
  targetRole?: string | null;
  defaultTemplateId?: string;
}

/**
 * Live preview of the tailored resume, with PDF and Word export.
 *
 * The tailored resume used to exist only as a block of text, so a user could
 * not see how it would look on paper or take a copy away with them before
 * approving it. This renders it as a real A4 document and lets them export it
 * as a PDF (via the browser's print-to-PDF) or an editable Word file.
 */
export default function ResumeDocument({
  resumeText,
  name,
  contact,
  targetRole,
  defaultTemplateId = 'ats',
}: ResumeDocumentProps) {
  const [templateId, setTemplateId] = useState(defaultTemplateId);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const html = useMemo(
    () => buildResumeDocument({ resumeText, name, contact, targetRole, templateId }),
    [resumeText, name, contact, targetRole, templateId],
  );

  const template: ResumeTemplate =
    RESUME_TEMPLATES.find((t) => t.id === templateId) ?? RESUME_TEMPLATES[0];

  if (!resumeText || !resumeText.trim()) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-xs text-slate-500">
        No tailored resume yet.
      </div>
    );
  }

  /**
   * Prints the document from a hidden iframe. The browser's print dialog is
   * where "Save as PDF" lives, so this produces a proper vector PDF rather
   * than a screenshot.
   */
  const downloadPdf = () => {
    const frame = printFrameRef.current;
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      if (!doc) throw new Error('preview not ready');
      doc.open();
      doc.write(html);
      doc.close();
      // Give the iframe a moment to lay the document out before printing.
      window.setTimeout(() => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          setNotice('Your browser blocked the print dialog. Allow popups for this site and try again.');
        }
      }, 250);
    } catch {
      setNotice('Could not open the print dialog. Use "Export Word" instead.');
    }
  };

  const exportWord = () => {
    try {
      const blob = new Blob(['﻿' + buildWordDocument(html)], {
        type: 'application/msword;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(name || 'candidate').trim().replace(/\s+/g, '-')}-Resume.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setNotice('Word export failed in this browser. Try the PDF download instead.');
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-950/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Tailored resume
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            {expanded ? 'Hide preview' : 'Preview'}
          </button>
          <button
            onClick={downloadPdf}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            ⬇ PDF
          </button>
          <button
            onClick={exportWord}
            className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            ⬇ Word
          </button>
        </div>
      </div>

      {/* Template picker */}
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Resume template">
        {RESUME_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemplateId(t.id)}
            title={t.description}
            aria-pressed={templateId === t.id}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
              templateId === t.id
                ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
                : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-[11px] text-slate-500">{template.description}</p>

      {notice && (
        <p role="alert" className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {notice}
        </p>
      )}

      {expanded && (
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/40">
          <iframe
            title="Resume preview"
            srcDoc={html}
            sandbox="allow-same-origin"
            className="h-[520px] w-full border-0 bg-white"
          />
        </div>
      )}

      {/* Hidden frame used only for printing. */}
      <iframe
        ref={printFrameRef}
        title="Print frame"
        aria-hidden="true"
        sandbox="allow-same-origin allow-modals"
        className="pointer-events-none absolute h-0 w-0 border-0 opacity-0"
      />
    </div>
  );
}
