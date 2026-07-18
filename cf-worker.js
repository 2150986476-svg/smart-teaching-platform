export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Proxy to Railway backend
    const targetUrl = 'https://smart-teaching-platform-production.up.railway.app' + url.pathname + url.search;
    
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
      redirect: 'follow'
    });
    
    // Remove host header to avoid issues
    modifiedRequest.headers.delete('host');
    
    const response = await fetch(modifiedRequest);
    
    // Return the response with CORS headers
    const modifiedResponse = new Response(response.body, response);
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    
    return modifiedResponse;
  }
};
