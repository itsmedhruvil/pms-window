'use client';

import { useState } from 'react';
import { Share2, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoogleSheetsExportProps {
  projectId: string;
  projectTitle: string;
  excelFileName?: string;
}

export function GoogleSheetsExport({ projectId, projectTitle, excelFileName }: GoogleSheetsExportProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Instructions for manual export to Google Sheets
  const handleCopyInstructions = () => {
    const instructions = `To sync your Excel data to Google Sheets:

1. Open Google Drive (https://drive.google.com)
2. Click "New" → "File upload" and upload your Excel file
3. Right-click the uploaded file → "Open with" → "Google Sheets"
4. Google Sheets will automatically convert your Excel format
5. To import data programmatically, share the sheet link in project notes

For automatic syncing, we can add two-way sync using:
- Google Sheets API
- IFTTT or Zapier integration
- Direct API connectivity`;

    navigator.clipboard.writeText(instructions);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportToGoogleSheets = async () => {
    setLoading(true);
    try {
      // This endpoint will handle creating/updating a Google Sheet
      const response = await fetch('/api/projects/export-to-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectTitle,
          fileName: excelFileName || `${projectTitle}-data`,
        }),
      });

      const data = await response.json();
      if (data.success && data.sheetsUrl) {
        // Open the Google Sheet in a new window
        window.open(data.sheetsUrl, '_blank');
      } else {
        alert(data.error || 'Failed to export to Google Sheets');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting to Google Sheets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-primary-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-transparent">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
            <Share2 className="w-3.5 h-3.5" />
            Google Sheets Sync
          </h3>
          <p className="text-[11px] text-blue-700 mt-1">
            Export your Excel data to Google Sheets for easy online collaboration
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleExportToGoogleSheets}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase border rounded-md transition-all',
              loading
                ? 'border-primary-300 text-primary-400 bg-primary-50 cursor-not-allowed'
                : 'border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-600'
            )}
          >
            <ExternalLink className="w-3 h-3" />
            {loading ? 'Exporting...' : 'Export'}
          </button>
          <button
            onClick={handleCopyInstructions}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase border rounded-md transition-all',
              copied
                ? 'border-green-400 text-green-700 bg-green-50'
                : 'border-primary-200 text-primary-500 bg-white hover:bg-primary-50'
            )}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Instructions
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
