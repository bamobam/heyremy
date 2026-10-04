/** A blob as base64, with no `data:` prefix, which is what the check endpoint takes. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  // String.fromCharCode takes its arguments on the stack, so feed it in chunks.
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
