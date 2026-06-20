import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-xs tracking-[0.2em] uppercase opacity-60 mb-3">
          Error 404
        </div>
        <h1 className="text-3xl font-semibold mb-3">Page not found</h1>
        <p className="opacity-75 leading-relaxed mb-8">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}