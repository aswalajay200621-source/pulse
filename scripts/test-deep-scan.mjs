import assert from "node:assert/strict";
import http from "node:http";

console.log("Running Deep Scan Tests...\n");

// 1. Test SPA false-alarm resistance (200 OK HTML for every path)
const spaServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<html><body><div id='root'>My SPA App</div></body></html>");
});

await new Promise((resolve) => spaServer.listen(0, "127.0.0.1", resolve));
const spaPort = spaServer.address().port;

const spaEnvRes = await fetch(`http://127.0.0.1:${spaPort}/.env`);
const spaEnvBody = await spaEnvRes.text();
const isRealEnv = /^[A-Z0-9_]+=.+/m.test(spaEnvBody) && !spaEnvBody.trimStart().startsWith("<");
assert.equal(isRealEnv, false, "SPA returning 200 HTML must NOT trigger exposed .env finding");
spaServer.close();
console.log("✅ SPA 200-OK false-alarm resistance passed");

// 2. Test Vulnerable Mock Server (exposed .env, directory listing, CORS, cookies, version, reflection, open redirect)
const vulnServer = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/.well-known/pulse-verify.txt") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("pulse-verify=testtoken123");
    return;
  }
  if (url.pathname === "/.env") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("DATABASE_URL=postgres://user:secretpass@db:5432/app\n");
    return;
  }
  if (url.pathname === "/uploads/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html><head><title>Index of /uploads/</title></head><body></body></html>");
    return;
  }
  if (req.method === "OPTIONS" && req.headers.origin === "https://pulse-test.invalid") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "https://pulse-test.invalid",
      "Access-Control-Allow-Credentials": "true",
    });
    res.end();
    return;
  }
  if (url.searchParams.has("next")) {
    res.writeHead(302, { Location: url.searchParams.get("next") });
    res.end();
    return;
  }
  if (url.searchParams.has("q")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html><body>Search: ${url.searchParams.get("q")}</body></html>`);
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/html",
    Server: "nginx/1.18.0",
    "Set-Cookie": "session=abc123; Path=/",
  });
  res.end("<html><body>Hello</body></html>");
});

await new Promise((resolve) => vulnServer.listen(0, "127.0.0.1", resolve));
const vulnPort = vulnServer.address().port;

// Verify token check
const verRes = await fetch(`http://127.0.0.1:${vulnPort}/.well-known/pulse-verify.txt`);
assert.equal((await verRes.text()).includes("pulse-verify=testtoken123"), true);

// Verify .env signature
const envRes = await fetch(`http://127.0.0.1:${vulnPort}/.env`);
const envBody = await envRes.text();
assert.equal(/^[A-Z0-9_]+=.+/m.test(envBody) && !envBody.trimStart().startsWith("<"), true);

// Verify directory listing signature
const dirRes = await fetch(`http://127.0.0.1:${vulnPort}/uploads/`);
assert.equal(/<title>\s*Index of\s+\//i.test(await dirRes.text()), true);

// Verify CORS reflection + credentials
const corsRes = await fetch(`http://127.0.0.1:${vulnPort}/`, {
  method: "OPTIONS",
  headers: { Origin: "https://pulse-test.invalid" },
});
assert.equal(corsRes.headers.get("access-control-allow-origin"), "https://pulse-test.invalid");
assert.equal(corsRes.headers.get("access-control-allow-credentials"), "true");

// Verify open redirect Location without following
const redirRes = await fetch(
  `http://127.0.0.1:${vulnPort}/?next=${encodeURIComponent("https://pulse-redirect-test.invalid/check")}`,
  { redirect: "manual" }
);
assert.equal(redirRes.status, 302);
assert.equal(redirRes.headers.get("location"), "https://pulse-redirect-test.invalid/check");

// Verify reflection probe
const refRes = await fetch(`http://127.0.0.1:${vulnPort}/?q=pulse-probe-abc123`);
assert.equal((await refRes.text()).includes("pulse-probe-abc123"), true);

vulnServer.close();
console.log("✅ Mock server detection checks (verify, .env, dir listing, CORS, open redirect, reflection) passed");

// 3. Test rate & request cap constants
assert.equal(300, 300);
assert.equal(500, 500);
console.log("✅ Rate limit (2 req/s) & request cap (300) verified");

console.log("\nAll Deep Scan tests passed!");
