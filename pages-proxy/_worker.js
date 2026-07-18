export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }

    const url = new URL(request.url);
    const targetUrl = 'https://awarded-banana-luck-waves.trycloudflare.com' + url.pathname + url.search;

    // Build headers for target (strip host, keep rest)
    const headers = new Headers();
    for (const [key, value] of request.headers) {
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    }

    // Forward body for POST/PUT/PATCH
    let body = null;
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      body = await request.arrayBuffer();
    }

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: body,
      redirect: 'follow'
    });

    const response = await fetch(modifiedRequest);

    const modifiedResponse = new Response(response.body, response);
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    modifiedResponse.headers.set('Access-Control-Allow-Headers', '*');

    return modifiedResponse;
  }
};
