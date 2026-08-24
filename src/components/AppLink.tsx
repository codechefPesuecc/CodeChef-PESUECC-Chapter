import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * Drop-in replacement for next/link's <Link> that defaults `prefetch` to false.
 *
 * WHY: Next 16's client segment-cache prefetch loops on the OpenNext/Cloudflare
 * edge. Every visible <Link> re-prefetches endlessly (~20-60 req/s per open tab)
 * because the client never registers the RSC prefetch as "satisfied" on the edge
 * (it works fine on local `next start`). One tab left open burned ~285k requests
 * in ~6h and blew the Cloudflare free-tier daily limit. Disabling automatic
 * prefetch stops the loop; navigation still fetches on click.
 *
 * The default is overridable — pass an explicit `prefetch` prop to re-enable it
 * for a specific link (the spread below lets caller props win).
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
