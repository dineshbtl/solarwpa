"use client"

export default function TestEnvPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Environment Variables Test</h1>

      <div className="space-y-4">
        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">NEXT_PUBLIC_SUPABASE_URL:</h2>
          <p className="font-mono text-sm break-all bg-gray-100 p-2 rounded">
            {url || "❌ NOT SET"}
          </p>
          <p className="text-xs mt-1 text-gray-600">
            Status: {url ? "✅ Configured" : "❌ Missing"}
          </p>
        </div>

        <div className="border p-4 rounded bg-slate-50">
          <h2 className="font-semibold mb-2">SUPABASE_URL (server-only)</h2>
          <p className="text-sm text-gray-700">
            Optional internal URL for admin/service-role calls only. Middleware always uses{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> so auth cookies match the browser (see{" "}
            <code className="text-xs">.env.example</code>).
          </p>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">NEXT_PUBLIC_SUPABASE_ANON_KEY:</h2>
          <p className="font-mono text-sm break-all bg-gray-100 p-2 rounded">
            {key ? `${key.substring(0, 30)}...${key.substring(key.length - 10)} (length: ${key.length})` : "❌ NOT SET"}
          </p>
          <p className="text-xs mt-1 text-gray-600">
            Status: {key ? "✅ Configured" : "❌ Missing"}
          </p>
        </div>

        <div className="border p-4 rounded bg-blue-50">
          <h2 className="font-semibold mb-2">Client Info:</h2>
          <p className="text-sm">
            <span className="font-medium">Current Hostname:</span>{" "}
            {typeof window !== "undefined" ? window.location.hostname : "Server-side render"}
          </p>
          <p className="text-sm mt-1">
            <span className="font-medium">Current URL:</span>{" "}
            {typeof window !== "undefined" ? window.location.href : "Server-side render"}
          </p>
        </div>

        <div className="border p-4 rounded bg-green-50">
          <h2 className="font-semibold mb-2">Test Result:</h2>
          {url && key ? (
            <p className="text-green-700 font-medium">
              ✅ Public Supabase env vars are configured for the browser.
            </p>
          ) : (
            <p className="text-red-700 font-medium">
              ❌ Some environment variables are missing. Check your .env.local file.
            </p>
          )}
        </div>

        <div className="text-xs text-gray-500 mt-4">
          <p>Access this page at: /test-env</p>
        </div>
      </div>
    </div>
  )
}
