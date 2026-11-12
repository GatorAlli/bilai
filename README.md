This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Listing photos

Photo bytes are saved in the shared PostgreSQL database with their listing.
Every checkout and deployment using the same database can serve the existing
`/uploads/...` URLs; no writable server disk is needed for new uploads.
Apply `drizzle/20261111020000_shared_photo_storage/migration.sql` before running
this version against an older database.

Run `npm run photos:sync` to import older local files into shared storage and
export shared photos into the Git-tracked `uploads/` directory. Run it on each
computer that previously accepted uploads to recover files missing elsewhere.
Then commit and push `uploads/` to include a snapshot on GitHub. Runtime uploads
do not automatically create GitHub commits. Do not put GitHub credentials in the
client or rely on Git pulls for live photo delivery.

Database photo storage is intended for this small prototype; base64 adds roughly
33% storage overhead. Move image bytes to shared object storage as the catalog grows.
