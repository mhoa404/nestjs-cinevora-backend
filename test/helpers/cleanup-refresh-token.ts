import { DataSource } from 'typeorm';

export const DEFAULT_E2E_LOGIN_EMAILS = [
  'api_tester@gmail.com',
  'api_client@gmail.com',
];

export const cleanupRefreshTokens = async (
  dataSource: DataSource,
  emails: string[] = DEFAULT_E2E_LOGIN_EMAILS,
): Promise<void> => {
  if (!dataSource?.isInitialized) {
    return;
  }

  if (emails.length === 0) {
    return;
  }

  await dataSource.query(
    [
      'DELETE rt',
      'FROM refresh_tokens rt',
      'INNER JOIN users u ON u.id = rt.user_id',
      'WHERE u.email IN (?)',
    ].join(' '),
    [emails],
  );
};
