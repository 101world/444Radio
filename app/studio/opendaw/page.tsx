"use client"

import React from "react"
import Link from "next/link"

export default function OpenDAWPage() {
  return (
    <div className="min-h-screen w-full bg-black text-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">444Radio Studio — OpenDAW</h1>
          <span className="text-xs text-gray-500 border border-gray-800 rounded px-2 py-0.5">Preview</span>
          <div className="flex-1" />
          <Link href="/studio" className="text-sm text-cyan-300 hover:underline">Try 444 Studio (MVP)</Link>
        </div>

        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <div className="p-3 bg-gray-900/60 border-b border-gray-800 text-sm text-gray-400">
            Embedded OpenDAW for rapid iteration. Note: OpenDAW is GPLv3 — forking and branding will require compliance. We can later fork, brand, and wire per-user save/load to Supabase.
          </div>
          <iframe
            src="https://opendaw.studio"
            title="OpenDAW"
            className="w-full h-[80vh] bg-black"
            sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
          />
        </div>

        <div className="mt-4 text-xs text-gray-500 space-y-2">
          <p>Planned wiring:</p>
          <ul className="list-disc pl-6">
            <li>Fork OpenDAW (GPLv3) into a sub-app for full branding and offline hosting.</li>
            <li>Add project import/export bridge and persist to <code>/api/studio/projects</code>.</li>
            <li>Gate access behind Clerk and hydrate recent projects per user.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
