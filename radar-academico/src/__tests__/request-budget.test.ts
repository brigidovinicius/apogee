import { expect, it } from 'vitest';
import { officialRequestSignal, waitForOfficialRequest, withOfficialRequestDeadline } from '@/lib/ingestion/request-budget';
import { safeRequest } from '@/lib/ingestion/safe-request';

it('refuses any new HTTP request once the shared chain deadline has elapsed', async () => {
  await expect(withOfficialRequestDeadline(Date.now() - 1,
    () => safeRequest('https://official.example.org/call', {}, 1024))).rejects.toMatchObject({ name: 'TimeoutError' });
});

it('applies the remaining chain budget to rate waits instead of granting each wait a fresh deadline', async () => {
  await expect(withOfficialRequestDeadline(Date.now() + 20,
    () => waitForOfficialRequest(10_000))).rejects.toMatchObject({ name: 'TimeoutError' });
  expect(officialRequestSignal().aborted).toBe(false);
});
