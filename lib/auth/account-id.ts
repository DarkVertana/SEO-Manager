// Display-only formatting for the per-user `accountNumber` column.
// Storage in the DB is a plain `Int @default(autoincrement())` starting at 1.
// We add an offset before formatting so the first user reads as SEMG2723051,
// the second as SEMG2723052, etc. — never expose the raw counter publicly.

const PREFIX = "SEMG";
const BASE_OFFSET = 2_723_050;

export function formatAccountId(accountNumber: number): string {
  if (!Number.isFinite(accountNumber) || accountNumber < 1) return `${PREFIX}-PENDING`;
  return `${PREFIX}${BASE_OFFSET + accountNumber}`;
}
