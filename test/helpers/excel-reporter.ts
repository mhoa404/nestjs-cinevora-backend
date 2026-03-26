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
