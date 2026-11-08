import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSendApplication, startOfToday, DAILY_SEND_LIMIT } from './autosend.ts';

test('canSendApplication blocks unapproved drafts', () => {
  const result = canSendApplication({ approved: false, sentToday: 0 });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /approved/i);
});

test('canSendApplication blocks once the daily limit is hit', () => {
  const result = canSendApplication({ approved: true, sentToday: DAILY_SEND_LIMIT });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /limit/i);
});

test('canSendApplication allows an approved draft under the limit', () => {
  const result = canSendApplication({ approved: true, sentToday: DAILY_SEND_LIMIT - 1 });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, undefined);
});

test('canSendApplication honours a custom limit', () => {
  assert.equal(canSendApplication({ approved: true, sentToday: 1, dailyLimit: 1 }).allowed, false);
  assert.equal(canSendApplication({ approved: true, sentToday: 0, dailyLimit: 1 }).allowed, true);
});

test('startOfToday normalises to midnight local time', () => {
  const d = startOfToday(new Date('2026-11-06T15:42:31.500Z'));
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
  assert.equal(d.getSeconds(), 0);
  assert.equal(d.getMilliseconds(), 0);
});
