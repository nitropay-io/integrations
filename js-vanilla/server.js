const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const PORT = 3031;
const ROOT_DIR = path.join(__dirname); // Assumes index.html is in same folder

const NITROPAY_API_URL = 'https://api.nitropay.io';
const SECRET_API_KEY = 'sk_64c35251-d1cd-4161-827a-a868d65d8b26';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const makeBytes32 = () => '0x' + randomBytes(32).toString('hex')

const server = http.createServer((req, res) => {
  // Normalize the request path
  let reqPath = req.url.split('?')[0];

  if (req.method === "POST" && req.url === "/payment-intent") {
    let body = "";
    req.on('data', (chunk) => {
      body += chunk.toString();
    })
    .on("end", async () => {
      try {
        const expiresInMinutes = 30;
        const { amount, token, chainId } = JSON.parse(body);
        const expireAt = new Date(Date.now() + (expiresInMinutes * 60 * 1000))

        const payload = {
          id: makeBytes32(),
          amount: amount.toString(),
          token,
          status: 'pending',
          chainId: Number(chainId),
          expireAt: expireAt.toISOString()
        }

        const response = await fetch(`${NITROPAY_API_URL}/payment/intent`, {
          method: 'POST',
          headers: {
            'X-Api-Key' : SECRET_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        body = await response.json();

        res.end(JSON.stringify(body));
      } catch (error){
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
    return;
  }



  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(ROOT_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
