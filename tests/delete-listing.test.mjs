import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { PgDialect } from "drizzle-orm/pg-core";

const runtimeRequire = createRequire(import.meta.url);

function load(file, mocks = {}, globals = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module: testModule,
    exports: testModule.exports,
    console: { error() {} },
    ...globals,
    require: (name) => (name in mocks ? mocks[name] : runtimeRequire(name)),
  });
  return testModule.exports;
}

const schema = load("db/schema.ts");
const publicIdModule = load("lib/public-id.ts");
const uploadsModule = load(
  "lib/uploads.ts",
  {
    "./cat-limits": { MAX_IMAGES: 5 },
  },
  { process },
);
const ID = "gj34jfxk";

function setup({
  loggedIn = true,
  deleted = [{ id: 1 }],
  fail = false,
  images = [],
} = {}) {
  const conditions = [];
  const removed = [];
  const refreshed = [];
  const dialect = new PgDialect();
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async (condition) => {
            conditions.push(dialect.sqlToQuery(condition));
            return images;
          },
        }),
      }),
    }),
    delete: () => ({
      where: (condition) => {
        conditions.push(dialect.sqlToQuery(condition));
        return {
          returning: async () => {
            if (fail) throw new Error("Database unavailable");
            return deleted;
          },
        };
      },
    }),
  };
  const { deleteCatListing } = load(
    "app/(pages)/find_a_cat/[publicId]/delete-actions.ts",
    {
      "@/db": { db },
      "@/db/schema": schema,
      "@/lib/auth": {
        getSession: async () => (loggedIn ? { user: { id: "owner" } } : null),
      },
      "@/lib/cloudflareR2": {
        deleteCatPhotos: async (keys) => removed.push(...keys),
      },
      "@/lib/public-id": publicIdModule,
      "@/lib/uploads": uploadsModule,
      "next/cache": { revalidatePath: (url) => refreshed.push(url) },
    },
  );
  return { deleteCatListing, conditions, removed, refreshed };
}

test("anonymous callers cannot query or delete listings", async () => {
  const state = setup({ loggedIn: false });
  assert.equal((await state.deleteCatListing(ID)).ok, false);
  assert.equal(state.conditions.length, 0);
});

test("invalid listing IDs cannot reach the database", async () => {
  const state = setup();
  for (const id of [
    0,
    1,
    12345678,
    "",
    "1",
    "gj34jfx",
    "gj34jfxkk",
    "GJ34JFXK",
    "../../..",
    "gj34%fxk",
    null,
    undefined,
  ]) {
    assert.equal((await state.deleteCatListing(id)).ok, false);
  }
  assert.equal(state.conditions.length, 0);
});

test("both photo lookup and delete are constrained by public ID AND authenticated owner", async () => {
  const state = setup();
  assert.equal((await state.deleteCatListing(ID)).ok, true);
  assert.equal(state.conditions.length, 2);
  for (const condition of state.conditions) {
    assert.match(
      condition.sql.replace(/[()]/g, ""),
      /"cats"\."public_id" = \$1 and "cats"\."user_id" = \$2/,
    );
    assert.deepEqual(condition.params, [ID, "owner"]);
  }
});

test("missing, non-owned, or concurrently deleted listings do not delete photos", async () => {
  const state = setup({ deleted: [], images: [{ key: `cats/${ID}-1.webp` }] });
  assert.equal((await state.deleteCatListing(ID)).ok, false);
  assert.equal(state.removed.length, 0);
  assert.equal(state.refreshed.length, 0);
});

test("failed database mutation preserves uploaded photos", async () => {
  const state = setup({ fail: true, images: [{ key: `cats/${ID}-1.webp` }] });
  assert.equal((await state.deleteCatListing(ID)).ok, false);
  assert.equal(state.removed.length, 0);
});

test("successful deletion removes only this listing's R2 photos and refreshes affected pages", async () => {
  const state = setup({
    images: [
      { key: `cats/${ID}-1.webp` },
      { key: `cats/${ID}-2.webp` },
      { key: "cats/other123-1.webp" },
      { key: `cats/../${ID}-1.webp` },
      { key: `cats/${ID}-1.png` },
      { key: "owner/legacy.webp" },
      { key: "other/legacy.webp" },
    ],
  });
  assert.equal((await state.deleteCatListing(ID)).ok, true);
  assert.deepEqual(state.removed, [`cats/${ID}-1.webp`, `cats/${ID}-2.webp`]);
  assert.deepEqual(state.refreshed, ["/", "/find_a_cat", `/find_a_cat/${ID}`]);
});

// Index 0 is "Mark adopted", index 1 is "Remove listing" — both are wired to
// the same removal flow for now, so both are exercised identically here.
for (const confirmed of [false, true]) {
  for (const [buttonIndex, buttonLabel] of [
    [0, "Mark adopted"],
    [1, "Remove listing"],
  ]) {
    test(`${buttonLabel} button: confirmation ${confirmed ? "accepts deletion and returns to directory" : "cancels without deleting"}`, async () => {
      let calls = 0;
      const navigations = [];
      const pending = [];
      const Component = load(
        "components/view/cat/DeleteListingButton.tsx",
        {
          react: {
            useState: () => [null, () => {}],
            useTransition: () => [
              false,
              (callback) => pending.push(callback()),
            ],
          },
          "next/navigation": {
            useRouter: () => ({
              replace: (url) => navigations.push(url),
              refresh() {},
            }),
          },
          "@/components/ui/button": { Button: () => null },
          "@/app/(pages)/find_a_cat/[publicId]/delete-actions": {
            deleteCatListing: async (id) => {
              assert.equal(id, ID);
              calls++;
              return { ok: true };
            },
          },
        },
        { window: { confirm: () => confirmed } },
      ).default;
      const tree = Component({ publicId: ID });
      tree.props.children[buttonIndex].props.onClick();
      await Promise.all(pending);
      assert.equal(calls, confirmed ? 1 : 0);
      assert.deepEqual(navigations, confirmed ? ["/find_a_cat"] : []);
    });
  }
}
