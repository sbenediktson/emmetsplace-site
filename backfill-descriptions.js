#!/usr/bin/env node
// One-time script to add description field to existing videos.json entries
// Run: YOUTUBE_API_KEY=your_key node backfill-descriptions.js

const fs = require("fs");

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) { console.error("Missing YOUTUBE_API_KEY"); process.exit(1); }

async function main() {
  const existing = JSON.parse(fs.readFileSync("videos.json", "utf8"));
  const ids = Object.keys(existing.data).filter(id => !existing.data[id].description);
  console.log(`Backfilling descriptions for ${ids.length} videos...`);

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(",")}&key=${API_KEY}`);
    const data = await res.json();
    for (const item of (data.items || [])) {
      existing.data[item.id].description = item.snippet.description || "";
    }
    console.log(`  ${Math.min(i + 50, ids.length)} / ${ids.length}`);
  }

  fs.writeFileSync("videos.json", JSON.stringify(existing));
  console.log("Done.");
}

main().catch(err => { console.error(err); process.exit(1); });
