import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  try {
    const AES_KEY_BYTES = new Uint8Array([0x6b, 0x69, 0x65, 0x6d, 0x74, 0x69, 0x65, 0x6e, 0x6d, 0x75, 0x61, 0x39, 0x31, 0x31, 0x63, 0x61]);
    
    const key = await crypto.subtle.importKey(
      "raw",
      AES_KEY_BYTES,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );

    return NextResponse.json({ ok: true, keyType: key.type });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
