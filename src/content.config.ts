import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const sources = defineCollection({
  loader: file('src/data/sources.json'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    publisher: z.string(),
    author: z.string().optional(),
    url: z.string().url(),
    publishedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    accessedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    claimSupported: z.string(),
    archiveUrl: z.string().url(),
    primarySource: z.boolean(),
    retracted: z.boolean().default(false),
    retractedReason: z.string().nullable(),
    retractedDate: z.string().nullable(),
  }),
});

export const collections = { sources };
