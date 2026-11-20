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

You can upload HEIC/HEIF, JPEG, PNG, WebP, AVIF, GIF, or BMP photos up to 25 MiB each. The browser converts them to WebP before upload.

Photos are stored in a Cloudflare R2 bucket as `cats/<publicId>-<n>.webp` and
loaded straight from the bucket's public domain (`R2_PUBLIC_URL`). Postgres keeps
only each photo's key, caption and order. Every listing has a random
8-character public id that is used in its URL (`/find_a_cat/gj34jfxk`) and in its
photo keys.

See the [listing photo storage guide](docs/image_storage/README.md) for the full
flow, R2 bucket setup, environment variables and the `npm run r2:check` smoke
test. [Browse all project docs](docs/README.md).
