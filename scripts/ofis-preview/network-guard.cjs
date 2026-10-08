// Local preview only. No cloud or production socket can be opened by this process
// or inherited Node workers. Fonts are supplied from the local cache.
const net = require('node:net');
const dns = require('node:dns');
const allowed = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
function assertHost(host) {
  if (host && !allowed.has(String(host))) throw new Error('OFIS_PREVIEW_NETWORK_BLOCKED');
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = args[0];
  if (Array.isArray(first)) {
    const v=first[0]; if (v && typeof v==='object') assertHost(v.host);
  } else if (first && typeof first === 'object') {
    if (first.path && !String(first.path).startsWith('/tmp/')) throw new Error('OFIS_PREVIEW_SOCKET_BLOCKED');
    assertHost(first.host);
  } else if (typeof args[1] === 'string') assertHost(args[1]);
  return connect.apply(this, args);
};
const lookup=dns.lookup;
dns.lookup=function(host,...args){assertHost(host);return lookup.call(this,host,...args)};
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assertHost(url.hostname);
  return originalFetch(input, init);
};
