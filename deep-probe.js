// Deep probe: try to find any CDN for the failing codes
// The player renders via JS so the HTML won't have CDN refs.
// Strategy: try many CDN hosts + path combos via HEAD requests

const codes = ["mowvvd", "fd9aaz", "ox899d", "dn6pif", "hen9zx", "zbiokz"];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://aniflix.rpmvid.com/",
  "Origin": "https://aniflix.rpmvid.com",
};

// Try fetching the JS bundle to find CDN patterns
async function findJsBundleCdns() {
  const pageRes = await fetch("https://aniflix.rpmvid.com/mowvvd", { headers: HEADERS });
  const html = await pageRes.text();
  
  // Get JS src links
  const jsSrcs = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]);
  console.log("JS sources found:", jsSrcs.slice(0, 10));
  
  // Also look for inline script content with CDN hosts
  const inlineMatches = html.match(/s3u\.[a-z0-9.]+/gi);
  console.log("Inline CDN hosts:", inlineMatches);
  
  // Fetch the main app bundle
  for (const src of jsSrcs.slice(0, 5)) {
    const jsUrl = src.startsWith("http") ? src : `https://aniflix.rpmvid.com${src}`;
    console.log(`\nFetching JS: ${jsUrl.substring(0, 80)}`);
    try {
      const jsRes = await fetch(jsUrl, { headers: HEADERS });
      const js = await jsRes.text();
      
      // Look for CDN host strings
      const cdnHosts = [...js.matchAll(/s3u\.[a-z0-9.\-]+/gi)].map(m => m[0]);
      const uniqueHosts = [...new Set(cdnHosts)];
      if (uniqueHosts.length > 0) {
        console.log("CDN hosts in JS:", uniqueHosts);
      }
      
      // Look for path patterns like /v4/ or /v5/
      const pathPatterns = [...js.matchAll(/\/v(\d+)\/([a-z0-9]+)\//gi)].map(m => m[0]);
      if (pathPatterns.length > 0) {
        console.log("Path patterns:", [...new Set(pathPatterns)].slice(0, 10));
      }
    } catch(e) {
      console.log("Failed:", e.message);
    }
  }
}

async function headOk(url) {
  try {
    const r = await fetch(url, { method: "HEAD", headers: HEADERS });
    return r.status;
  } catch { return 0; }
}

// Probe the actual index-f1-v1.txt across CDN variants for one code
async function probeExtended(code) {
  console.log(`\nProbing ${code}...`);
  
  // From the user's master playlist URL we know the structure: /v4/{segment}/{code}/
  // The segment for aurorapathmedia was "6hf", for wellnesssolutions was "x6b"
  // Let's try others
  const cdnHosts = [
    "s3u.wellnesssolutions.cyou",
    "s3u.aurorapathmedia.space", 
    "s3u.mediapathway.online",
    "s3u.streamvault.net",
    "s3u.videopath.cloud",
  ];
  
  const pathSegs = ["x6b", "6hf", "v4", "cdn", "hls", "s3"];
  
  const probes = [];
  for (const host of cdnHosts) {
    for (const seg of pathSegs) {
      const base = `https://${host}/v4/${seg}/${code}/`;
      probes.push({ base, probe: headOk(`${base}index-f1-v1.txt`) });
    }
    // Also try no segment
    probes.push({ base: `https://${host}/v4/${code}/`, probe: headOk(`https://${host}/v4/${code}/index-f1-v1.txt`) });
  }
  
  const results = await Promise.all(probes.map(async p => ({ base: p.base, status: await p.probe })));
  const hits = results.filter(r => r.status === 200);
  if (hits.length) {
    console.log(`✓ Found:`, hits.map(h => h.base).join(", "));
  } else {
    console.log(`✗ Not found on any known host`);
  }
}

async function run() {
  console.log("=== Finding CDN hosts from JS bundle ===\n");
  await findJsBundleCdns();
  
  console.log("\n\n=== Probing CDN for each code ===");
  for (const code of codes.slice(0, 3)) {
    await probeExtended(code);
  }
}

run().catch(console.error);
