# FILE: test/helpers/excel-reporter.ts

path: test/helpers/excel-reporter.ts
module: test
kind: file
language: ts
line_count: 71
size_bytes: 2231
sha256: 3c00731c3070a4f26f4caf4b685052abfabb3fb7cb3419685ac72e5fa7bd8c9b
updated_at: 2026-04-02T08:59:54.827Z

## SYMBOLS
- exportTestReport

## CODE

````ts
import ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

export interface TestCaseRecord {
  id: string;
  scope: 'Web' | 'Mobile' | 'All';
  testCase: string;
  description: string;
  procedure: string;
  expectedResult: number;
  actualResult: number | null;
  preconditions: string;
  passed: boolean;
  testDate: Date;
}

export async function exportTestReport(
  records: TestCaseRecord[],
  prefix: string,
  feature: string,
): Promise<string> {
  const resultsDir = path.join(process.cwd(), 'test', 'results');

  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const filePath = path.join(
    resultsDir,
    `${prefix}_${feature}_${timestamp}.xlsx`,
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Test Results');

  worksheet.columns = [
    { header: 'Test Case ID', key: 'id', width: 16 },
    { header: 'Scope', key: 'scope', width: 12 },
    { header: 'Test Case', key: 'testCase', width: 30 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Test Case Procedure', key: 'procedure', width: 45 },
    { header: 'Expected Results', key: 'expectedResult', width: 18 },
    { header: 'Actual Results', key: 'actualResult', width: 18 },
    { header: 'Pre-conditions', key: 'preconditions', width: 35 },
    { header: 'Pass / Failed', key: 'passFail', width: 15 },
    { header: 'Test date', key: 'testDate', width: 24 },
  ];

  records.forEach((record) => {
    worksheet.addRow({
      id: record.id,
      scope: record.scope,
      testCase: record.testCase,
      description: record.description,
      procedure: record.procedure,
      expectedResult: `HTTP ${record.expectedResult}`,
      actualResult:
        record.actualResult !== null ? `HTTP ${record.actualResult}` : 'N/A',
      preconditions: record.preconditions,
      passFail: record.passed ? 'Pass' : 'Failed',
      testDate: record.testDate.toLocaleString('vi-VN'),
    });
  });

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

````
