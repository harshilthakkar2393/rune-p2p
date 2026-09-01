import { getPageDoc } from "@/lib/page-doc";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Plain-text preview of a page's content, read from its Y.Doc.
 * Cheap at journal scale: docs are small and session-cached; the XML-string
 * pass is a v1 shortcut shared with the planned content-search upgrade.
 */
export async function getPageExcerpt(
  pageId: string,
  maxLength = 160,
): Promise<string> {
  const handle = getPageDoc(pageId);
  await handle.whenSynced;
  const xml = handle.doc.getXmlFragment("blocknote").toString();
  const text = xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, (entity) => ENTITIES[entity] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
