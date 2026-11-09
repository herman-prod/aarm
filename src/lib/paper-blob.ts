/** True only for a Vercel Blob URL under this user's own paper-upload prefix. */
export function isOwnPaperBlob(fileUrl: string | null | undefined, userId: string): boolean {
  if (!fileUrl) return false;
  try {
    const u = new URL(fileUrl);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".blob.vercel-storage.com") &&
      u.pathname.startsWith(`/intercept-papers/${userId}/`)
    );
  } catch {
    return false;
  }
}
