import { redirect } from "next/navigation";

/**
 * The archive listing has been merged into the main /cp-arena page.
 * Redirect any bookmarked or cached /cp-arena/archive URLs there.
 */
export default function ArchiveRedirect() {
  redirect("/cp-arena");
}
