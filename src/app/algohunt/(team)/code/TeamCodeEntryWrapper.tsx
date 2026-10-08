"use client";

import { useRouter } from "next/navigation";
import CodeEntry, { type CodeEntryProps } from "@/components/algohunt/code/CodeEntry";

export function TeamCodeEntryWrapper(props: Omit<CodeEntryProps, "onResult">) {
  const router = useRouter();

  return (
    <CodeEntry
      {...props}
      onResult={() => {
        router.refresh();
      }}
    />
  );
}
