export async function POST(req: Request) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function GET() {
  return new Response('Use POST', { status: 200 })
}
