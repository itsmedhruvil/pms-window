import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import connectDB from '@/lib/db';
import TemplateGroupModel from '@/models/TemplateGroup';
import { withAuth } from '@/lib/auth';
import { DEPARTMENT_LABELS } from '@/types';
import type { IUserDocument } from '@/models/User';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  project: 'Project',
  need_basis: 'Need Basis',
  project_recurring: 'Project Recurring',
};

const TYPE_LABELS: Record<string, string> = {
  project: 'Project',
  internal: 'Internal',
};

// Excel has a 31-char limit on sheet names and forbids : \ / ? * [ ]
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Template').slice(0, 31);
}

// GET /api/template-groups/export - Download all template groups as an .xlsx file
async function getHandler(_req: NextRequest, _ctx: unknown, { user }: { user: IUserDocument }) {
  await connectDB();

  const groups = await TemplateGroupModel.find({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = user.email || 'PMS';
  workbook.created = new Date();

  const header = ['#', 'Task Title', 'Description', 'Department', 'Type', 'Linked to Product', 'Frequency'];
  const columnWidths = [6, 40, 60, 16, 12, 20, 16];

  if (groups.length === 0) {
    const emptySheet = workbook.addWorksheet('Template Groups');
    emptySheet.addRow([]);
    emptySheet.addRow(['No template groups found.']);
    emptySheet.getRow(2).font = { bold: true };
  }

  for (const group of groups) {
    const sheet = workbook.addWorksheet(sanitizeSheetName(group.name));

    // Title row
    const titleCell = sheet.getCell('A1');
    titleCell.value = group.name;
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF43476F' },
    };
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };

    // Description row
    if (group.description) {
      const descCell = sheet.getCell('A2');
      descCell.value = group.description;
      descCell.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
    }

    const headerRowNumber = group.description ? 4 : 3;
    const dataStartRow = headerRowNumber + 1;

    // Header row
    const headerRow = sheet.getRow(headerRowNumber);
    header.forEach((label, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF43476D' },
      };
      cell.alignment = { vertical: 'middle' };
    });
    headerRow.height = 18;

    // Data rows
    const orderedTasks = [...group.tasks].sort(
      (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)
    );
    orderedTasks.forEach((task, i) => {
      const row = sheet.getRow(dataStartRow + i);
      row.getCell(1).value = i + 1;
      row.getCell(2).value = task.title;
      row.getCell(3).value = task.description;
      row.getCell(4).value = DEPARTMENT_LABELS[task.department] || task.department;
      row.getCell(5).value = TYPE_LABELS[task.type || 'project'] || task.type;
      row.getCell(6).value = task.linkedToProduct ? 'Yes' : 'No';
      row.getCell(7).value = FREQUENCY_LABELS[task.frequency || 'project'] || task.frequency;
      row.getCell(3).alignment = { wrapText: true };
      row.height = 20;
    });

    columnWidths.forEach((width, i) => {
      sheet.getColumn(i + 1).width = width;
    });

    sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: header.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();

  const dateStr = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="task-templates-${dateStr}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const GET = withAuth(getHandler);