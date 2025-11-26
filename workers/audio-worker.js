/**
 * Cloudflare Worker: Audio Streaming with Range Support
 * Phase A: Core zero-cost streaming with 206 Partial Content, edge caching, HEAD support
 * Phase B: HMAC signed URL security
 */

const BLOCK_SIZE = 64 * 1024; // 64KB normalized blocks for cache efficiency
const CACHE_TTL = 3600; // 1 hour cache
const DEBUG_TOKEN = 'your-debug-token-here'; // Change this!

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://444radio.vercel.app',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, If-None-Match, If-Modified-Since',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: /audio/:key - Main audio streaming endpoint
    if (url.pathname.startsWith('/audio/')) {
      const key = url.pathname.replace('/audio/', '');
      return handleAudioRequest(request, env, key, corsHeaders, ctx);
    }

    // Route: /static/:hash - Static hashed assets with immutable cache
    if (url.pathname.startsWith('/static/')) {
      const key = url.pathname.replace('/static/', '');
      return handleStaticAsset(request, env, key, corsHeaders);
    }

    // Route: /debug/audio-stats/:key - Protected debug endpoint
    if (url.pathname.startsWith('/debug/audio-stats/')) {
      const token = url.searchParams.get('token');
      if (token !== DEBUG_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
      const key = url.pathname.replace('/debug/audio-stats/', '');
      return handleDebugStats(request, env, key);
    }

    return new Response('Not Found', { status: 404 });
  }
};

/**
 * Main audio streaming handler with Range support and edge caching
 */
async function handleAudioRequest(request, env, key, corsHeaders, ctx) {
  // Phase B: Verify signed URL
  const url = new URL(request.url);
  const exp = url.searchParams.get('exp');
  const sig = url.searchParams.get('sig');
  
  if (exp && sig) {
    const isValid = await verifySignedUrl(key, exp, sig, env);
    if (!isValid) {
      return new Response('Invalid or expired signature', { status: 401, headers: corsHeaders });
    }
  }

  // Handle HEAD request for metadata
  if (request.method === 'HEAD') {
    return handleHeadRequest(env, key, corsHeaders);
  }

  const rangeHeader = request.headers.get('Range');
  
  try {
    // Get object metadata first
    const object = await env.AUDIO_BUCKET.head(key);
    if (!object) {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    const fileSize = object.size;
    const contentType = object.httpMetadata?.contentType || 'audio/mpeg';

    // No range request - return full file
    if (!rangeHeader) {
      const objectData = await env.AUDIO_BUCKET.get(key);
      return new Response(objectData.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        }
      });
    }

    // Parse range header
    const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!rangeMatch) {
      return new Response('Invalid Range', { status: 416, headers: corsHeaders });
    }

    let start = parseInt(rangeMatch[1], 10);
    let end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

    // Normalize to 64KB blocks for better cache hits
    const normalizedStart = Math.floor(start / BLOCK_SIZE) * BLOCK_SIZE;
    const normalizedEnd = Math.min(
      Math.ceil((end + 1) / BLOCK_SIZE) * BLOCK_SIZE - 1,
      fileSize - 1
    );

    // Try cache first
    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/audio/${key}?start=${normalizedStart}&end=${normalizedEnd}`, {
      method: 'GET',
    });
    
    let cachedResponse = await cache.match(cacheKey);
    let cacheStatus = 'MISS';
    
    if (cachedResponse) {
      cacheStatus = 'HIT';
      // Extract the requested range from cached normalized block
      const cachedArrayBuffer = await cachedResponse.arrayBuffer();
      const offsetInBlock = start - normalizedStart;
      const length = end - start + 1;
      const responseData = cachedArrayBuffer.slice(offsetInBlock, offsetInBlock + length);
      
      return new Response(responseData, {
        status: 206,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': length.toString(),
          'Cache-Control': 'public, max-age=3600',
          'CF-Cache-Status': cacheStatus,
        }
      });
    }

    // Cache miss - fetch from R2
    const r2Range = `bytes=${normalizedStart}-${normalizedEnd}`;
    const objectData = await env.AUDIO_BUCKET.get(key, {
      range: { offset: normalizedStart, length: normalizedEnd - normalizedStart + 1 }
    });

    if (!objectData) {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    const arrayBuffer = await objectData.arrayBuffer();

    // Cache the normalized block
    const cacheResponse = new Response(arrayBuffer.slice(0), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      }
    });
    ctx.waitUntil(cache.put(cacheKey, cacheResponse));

    // Return the requested range
    const offsetInBlock = start - normalizedStart;
    const length = end - start + 1;
    const responseData = arrayBuffer.slice(offsetInBlock, offsetInBlock + length);

    return new Response(responseData, {
      status: 206,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'CF-Cache-Status': cacheStatus,
      }
    });

  } catch (error) {
    console.error('Error fetching audio:', error);
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
  }
}

/**
 * Handle HEAD requests for quick metadata
 */
async function handleHeadRequest(env, key, corsHeaders) {
  try {
    const object = await env.AUDIO_BUCKET.head(key);
    if (!object) {
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    const contentType = object.httpMetadata?.contentType || 'audio/mpeg';
    
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': object.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      }
    });
  } catch (error) {
    return new Response(null, { status: 500, headers: corsHeaders });
  }
}

/**
 * Serve static hashed assets with immutable cache
 */
async function handleStaticAsset(request, env, key, corsHeaders) {
  try {
    const object = await env.AUDIO_BUCKET.get(key);
    if (!object) {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';

    return new Response(object.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': object.size.toString(),
      }
    });
  } catch (error) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
}

/**
 * Debug endpoint with cache stats and timings
 */
async function handleDebugStats(request, env, key) {
  const startTime = Date.now();
  
  try {
    const object = await env.AUDIO_BUCKET.head(key);
    const headTime = Date.now() - startTime;

    if (!object) {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check cache status
    const url = new URL(request.url);
    const cacheKey = new Request(`${url.origin}/audio/${key}?start=0&end=65535`, {
      method: 'GET',
    });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    const cacheStatus = cached ? 'HIT' : 'MISS';

    const stats = {
      key,
      size: object.size,
      contentType: object.httpMetadata?.contentType || 'audio/mpeg',
      uploaded: object.uploaded,
      headRequestTime: `${headTime}ms`,
      cacheStatus,
      blockSize: BLOCK_SIZE,
      estimatedBlocks: Math.ceil(object.size / BLOCK_SIZE),
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(stats, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Phase B: Verify HMAC signed URLs
 */
async function verifySignedUrl(key, exp, sig, env) {
  // Check expiration
  const expTime = parseInt(exp, 10);
  const now = Math.floor(Date.now() / 1000);
  
  if (now > expTime) {
    return false; // Expired
  }

  // Verify signature
  const message = `${key}:${exp}`;
  const secret = env.SIGNING_SECRET || 'default-secret-change-me';
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const expectedSig = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return sig === expectedSig;
}
