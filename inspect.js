// Fetch master playlist for cmgspm and inspect all content
async function inspect() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://aniflix.rpmvid.com/",
    "Origin": "https://aniflix.rpmvid.com",
  };

  const masterUrl = "https://s3u.aurorapathmedia.space/v4/6hf/cmgspm/cf-master.1773984716.txt";
  console.log("Fetching master playlist:", masterUrl);
  const res = await fetch(masterUrl, { headers });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Master M3U8 content:\n", text);
  
  // Now try to fetch a quality playlist and inspect its structure
  const q1Url = "https://s3u.aurorapathmedia.space/v4/6hf/cmgspm/index-f1-v1.txt";
  console.log("\n\nFetching quality playlist:", q1Url);
  const qRes = await fetch(q1Url, { headers });
  console.log("Status:", qRes.status);
  const qText = await qRes.text();
  // Just show first 30 lines
  console.log("Quality playlist (first 30 lines):\n", qText.split('\n').slice(0, 30).join('\n'));
}

inspect().catch(console.error);
