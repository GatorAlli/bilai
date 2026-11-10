import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PgDialect } from 'drizzle-orm/pg-core';

const runtimeRequire = createRequire(import.meta.url);

function load(file, mocks = {}, globals = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    module: testModule, exports: testModule.exports, console: { error() {} }, ...globals,
    require: (name) => name in mocks ? mocks[name] : runtimeRequire(name),
  });
  return testModule.exports;
}

const schema = load('db/schema.ts');
function setup({ loggedIn = true, deleted = [{ id: 1 }], fail = false, images = [] } = {}) {
  const conditions = [];
  const removed = [];
  const refreshed = [];
  const dialect = new PgDialect();
  const db = {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: async (condition) => {
      conditions.push(dialect.sqlToQuery(condition));
      return images;
    } }) }) }),
    delete: () => ({ where: (condition) => {
      conditions.push(dialect.sqlToQuery(condition));
      return { returning: async () => {
        if (fail) throw new Error('Database unavailable');
        return deleted;
      } };
    } }),
  };
  const { deleteCatListing } = load('app/(pages)/find_a_cat/[id]/delete-actions.ts', {
    '@/db': { db }, '@/db/schema': schema,
    '@/lib/auth': { getSession: async () => loggedIn ? { user: { id: 'owner' } } : null },
    '@/lib/uploads': { UPLOAD_ROOT: path.resolve('/tmp/bilai-delete-test') },
    'node:fs/promises': { unlink: async (file) => removed.push(file) },
    'next/cache': { revalidatePath: (url) => refreshed.push(url) },
  });
  return { deleteCatListing, conditions, removed, refreshed };
}

test('anonymous callers cannot query or delete listings', async () => {
  const state = setup({ loggedIn: false });
  assert.equal((await state.deleteCatListing(1)).ok, false);
  assert.equal(state.conditions.length, 0);
});

test('invalid listing IDs cannot reach the database', async () => {
  const state = setup();
  for (const id of [0, -1, 1.5, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await state.deleteCatListing(id)).ok, false);
  }
  assert.equal(state.conditions.length, 0);
});

test('both photo lookup and delete are constrained by ID AND authenticated owner', async () => {
  const state = setup();
  assert.equal((await state.deleteCatListing(1)).ok, true);
  assert.equal(state.conditions.length, 2);
  for (const condition of state.conditions) {
    assert.match(condition.sql.replace(/[()]/g, ''), /"cats"\."id" = \$1 and "cats"\."user_id" = \$2/);
    assert.deepEqual(condition.params, [1, 'owner']);
  }
});

test('missing, non-owned, or concurrently deleted listings do not delete files', async () => {
  const state = setup({ deleted: [], images: [{ key: 'owner/photo.webp' }] });
  assert.equal((await state.deleteCatListing(1)).ok, false);
  assert.equal(state.removed.length, 0);
  assert.equal(state.refreshed.length, 0);
});

test('failed database mutation preserves uploaded files', async () => {
  const state = setup({ fail: true, images: [{ key: 'owner/photo.webp' }] });
  assert.equal((await state.deleteCatListing(1)).ok, false);
  assert.equal(state.removed.length, 0);
});

test('successful deletion cleans only owner WebP files and refreshes affected pages', async () => {
  const state = setup({ images: [
    { key: 'owner/photo.webp' }, { key: '../secret.webp' },
    { key: 'other/photo.webp' }, { key: 'owner/../../secret.webp' },
    { key: 'owner/document.txt' },
  ] });
  assert.equal((await state.deleteCatListing(1)).ok, true);
  assert.deepEqual(state.removed, [path.resolve('/tmp/bilai-delete-test/owner/photo.webp')]);
  assert.deepEqual(state.refreshed, ['/', '/find_a_cat', '/find_a_cat/1']);
});

for (const confirmed of [false, true]) {
  test(`confirmation ${confirmed ? 'accepts deletion and returns to directory' : 'cancels without deleting'}`, async () => {
    let calls = 0;
    const navigations = [];
    const pending = [];
    const Component = load('components/view/cat/DeleteListingButton.tsx', {
      react: {
        useState: () => [null, () => {}],
        useTransition: () => [false, (callback) => pending.push(callback())],
      },
      'next/navigation': { useRouter: () => ({
        replace: (url) => navigations.push(url), refresh() {},
      }) },
      '@/components/ui/button': { Button: () => null },
      '@/app/(pages)/find_a_cat/[id]/delete-actions': {
        deleteCatListing: async (id) => { assert.equal(id, 1); calls++; return { ok: true }; },
      },
    }, { window: { confirm: () => confirmed } }).default;
    const tree = Component({ catId: 1 });
    tree.props.children[0].props.onClick();
    await Promise.all(pending);
    assert.equal(calls, confirmed ? 1 : 0);
    assert.deepEqual(navigations, confirmed ? ['/find_a_cat'] : []);
  });
}
