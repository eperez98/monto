import { expect, it } from 'vitest';
import { freshEngine } from '../test/helpers';
import { verifySecret } from '../db/crypto';
import { editCurrentProfile, profilePinHash } from './profiles';

it('requires six digits, keeps a leading zero and preserves the PIN when renaming', async () => {
  const { e, actor } = await freshEngine();
  await expect(editCurrentProfile(e, actor, 'Hogar', '12345')).rejects.toThrow();
  await editCurrentProfile(e, actor, 'Hogar', '012345');
  const stored = profilePinHash(e);
  expect(stored).not.toBe('012345');
  expect(await verifySecret('012345', stored)).toBe(true);
  expect(await verifySecret('123456', stored)).toBe(false);
  const list = await editCurrentProfile(e, actor, 'Casa', null);
  expect(list.some(p => p.name === 'Casa')).toBe(true);
  expect(profilePinHash(e)).toBe(stored);
  await editCurrentProfile(e, actor, 'Casa', '');
  expect(profilePinHash(e)).toBe('');
  e.close();
});
