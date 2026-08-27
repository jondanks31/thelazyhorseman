import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const issues = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/issues' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    issueNumber: z.string(),
    publishedAt: z.coerce.date(),
    readMinutes: z.number().int().positive(),
    topic: z.string(),
    highlightWord: z.string(),
    figureLineOne: z.string(),
    figureLineTwo: z.string(),
  }),
});

export const collections = { issues };
