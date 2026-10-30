// Process-scoped name mapping for the loopback-only integrated acceptance server.
// The production editorial URL contract and the system's hosts file stay intact.
import assert from 'node:assert/strict';
import dns from 'node:dns';
assert.equal(process.env.APOGEE_LOCAL_PREVIEW, '1');
assert.equal(process.env.RADAR_LOCAL_EDITORIAL, '1');
assert.equal(process.env.RADAR_ACADEMICO_ADMIN_API_URL, 'http://radar-academico:3000/api/internal/editorial/sources');
const lookup = dns.lookup.bind(dns);
dns.lookup = (hostname, ...args) => lookup(hostname === 'radar-academico' ? '127.0.0.1' : hostname, ...args);
