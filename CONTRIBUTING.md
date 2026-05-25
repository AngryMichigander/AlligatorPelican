# Contributing to alligatorpelican.com

## Editorial Review Checklist

Execute on every PR that changes prose. **Owner: project maintainer.**

1. Each factual assertion has at least one `<Cite/>` resolving to a **non-retracted** source.
2. No assertion that a **named private individual** committed a crime or misconduct without (a) a court filing, (b) a named-outlet investigation citing the same, OR (c) an on-record official statement.
3. **Public officials** may be discussed regarding **official actions** under the same standard as above; their **personal conduct** is held to the private-individual standard.
4. **Tone audit:** phrases implying criminal intent ("stole," "defrauded," "lied," etc.) are replaced with verifiable, neutral phrasing unless that exact characterization is directly sourced.
5. A **correction/takedown contact** (mailto) is present in the `/about` page footer.
6. **Correction SLA:** factual errors are fixed within 48h of a credible complaint; a correction notice is posted on `/changelog` describing the change.

## Adding a Source

All citations live in `src/data/sources.json`. Each row must conform to the schema:

```json
{
  "id": "unique-kebab-case-id",
  "title": "Article or document title",
  "publisher": "Publisher name",
  "author": "Author name or null",
  "url": "https://...",
  "publishedDate": "YYYY-MM-DD",
  "accessedDate": "YYYY-MM-DD",
  "lastVerified": "YYYY-MM-DD",
  "claimSupported": "One-sentence summary of the specific claim this source supports",
  "archiveUrl": "https://web.archive.org/...",
  "primarySource": false,
  "retracted": false,
  "retractedReason": null,
  "retractedDate": null
}
```

`primarySource: true` means government document, federal/state contract, appropriation bill, official budget doc, or court filing. Named-outlet reporting is `primarySource: false`.

To cite a source inline, use `<Cite id="your-source-id" />` in any `.astro` page. The build **fails** if the id does not exist in `sources.json`.

## Mirror Pushes

After committing, push to all remotes using `scripts/push-all.sh`:

```bash
./scripts/push-all.sh
```

This pushes all branches and tags to both `origin` (GitHub) and `mirror` (Codeberg or GitLab). See the script for details.
