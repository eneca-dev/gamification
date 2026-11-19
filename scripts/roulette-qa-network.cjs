// Preloaded only by the isolated QA copy. Never reads application env files.
/* eslint-disable @typescript-eslint/no-require-imports -- Node --require preload must run synchronously before application imports. */
const net = require('node:net')
const http = require('node:http')
const https = require('node:https')
const { syncBuiltinESMExports } = require('node:module')
const hosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
const ports = new Set([3011, 55438, 55441])
function check(host, port) {
  if (!hosts.has(host) || !ports.has(Number(port))) {
    throw new Error('QA_OUTBOUND_DENIED: ' + host + ':' + port)
  }
}
function checkUrl(input) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  check(url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80))
}
const fetchOriginal = globalThis.fetch
globalThis.fetch = function (input, options) { checkUrl(input); return fetchOriginal(input, options) }
for (const transport of [http, https]) {
  for (const method of ['request', 'get']) {
    const original = transport[method]
    transport[method] = function (input, ...rest) {
      if (typeof input === 'string' || input instanceof URL) checkUrl(input)
      else check(input.hostname || input.host || 'localhost', input.port || (transport === https ? 443 : 80))
      return original.call(this, input, ...rest)
    }
  }
}
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args
  const options = normalized[0]
  if (options && typeof options === 'object') {
    if (!options.path) check(options.host || options.hostname || 'localhost', options.port)
  } else if (typeof options === 'number' || /^\d+$/.test(String(options))) {
    check(typeof normalized[1] === 'string' ? normalized[1] : 'localhost', options)
  } else if (typeof options !== 'string' || !options.startsWith('\\\\.\\pipe\\')) {
    throw new Error('QA_OUTBOUND_DENIED: unexpected socket destination')
  }
  return connect.apply(this, args)
}
syncBuiltinESMExports()
