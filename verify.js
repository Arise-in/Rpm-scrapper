const codes = ["mowvvd", "fd9aaz", "ox899d", "dn6pif", "cmgspm", "hen9zx", "zbiokz", "cmg5ld"];

async function run() {
  console.log("Testing via dev server API...\n");
  for (const code of codes) {
    process.stdout.write(`[${code}] `);
    try {
      const r = await fetch(`http://localhost:3008/api/${code}`);
      const d = await r.json();
      if (d.error) {
        console.log(`✗ ${d.error}`);
      } else {
        console.log(`✓ CDN=${d.cdnBase?.replace("https://","").substring(0,45)} | q=${d.qualities?.length} | a=${d.audioTracks?.length} | subs=${d.subtitles?.length}`);
      }
    } catch(e) {
      console.log(`✗ Fetch error: ${e.message}`);
    }
  }
}
run();
