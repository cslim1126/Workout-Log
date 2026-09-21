"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Categories now live on the "Create Exercise" page.
// This page only sends old bookmarks there.
export default function CategoriesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/exercises");
  }, [router]);
  return (
    <div className="wrap">
      <p className="sub">Loading…</p>
    </div>
  );
}
