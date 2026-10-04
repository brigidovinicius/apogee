import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../../", import.meta.url);
const source = (path) => readFile(new URL(path, repoRoot), "utf8");

function service(compose, name) {
  const marker = `  ${name}:\n`;
  const start = compose.indexOf(marker);
  assert.notEqual(start, -1, `missing Compose service ${name}`);
  const remainder = compose.slice(start + marker.length);
  const next = remainder.search(/^  [a-z0-9][a-z0-9-]*:\n/m);
  return next === -1 ? remainder : remainder.slice(0, next);
}

test("Apogee services keep distinct Compose projects, networks, volumes and databases", async () => {
  const [site, members, radar, siteEnv, radarEnv, siteDockerfile, radarDockerfile] = await Promise.all([
    source("make-it-fly-current/infra/site/docker-compose.yml"),
    source("make-it-fly-current/infra/membros/docker-compose.yml"),
    source("radar-academico/infra/vps/docker-compose.yml"),
    source("make-it-fly-current/infra/site/.env.example"),
    source("radar-academico/infra/vps/.env.example"),
    source("make-it-fly-current/Dockerfile"),
    source("radar-academico/Dockerfile"),
  ]);

  assert.match(site, /^name: apogee-site$/m);
  assert.match(members, /^name: apogee-membros$/m);
  assert.match(radar, /^name: radar-academico$/m);

  assert.match(site, /name: apogee_site_next_cache/);
  assert.match(members, /name: apogee_membros_pgdata/);
  assert.match(radar, /name: radar_academico_pgdata/);
  assert.match(members, /DB_NAME: apogee_membros/);
  assert.match(radarEnv, /^RADAR_DB_NAME=radar_academico$/m);

  assert.match(site, /name: apogee_membros_edge\n\s+external: true/);
  assert.match(site, /name: apogee_radar_bridge\n\s+external: true/);
  assert.match(members, /name: apogee_membros_edge/);
  assert.match(radar, /name: apogee_radar_bridge/);
  assert.doesNotMatch(`${site}\n${members}\n${radar}`, /name:\s+sistema-de-locacao/);

  assert.match(siteEnv, /^APPLICATION_ORIGIN=https:\/\/www\.apogee\.community$/m);
  assert.match(siteEnv, /^BETTER_AUTH_URL=https:\/\/www\.apogee\.community$/m);
  assert.match(siteEnv, /@pgbouncer:5432\/apogee_membros$/m);

  for (const env of [siteEnv, radarEnv]) assert.match(env, /^APOGEE_RELEASE_SHA=local$/m);
  assert.match(site, /image: apogee-site:\$\{APOGEE_RELEASE_SHA:-local\}/);
  assert.match(radar, /image: radar-academico:\$\{APOGEE_RELEASE_SHA:-local\}/);
  for (const dockerfile of [siteDockerfile, radarDockerfile]) {
    assert.match(dockerfile, /org\.opencontainers\.image\.revision="\$\{APOGEE_RELEASE_SHA\}"/);
  }
});

test("only the optional public proxy publishes internet-facing ports", async () => {
  const [site, members, radar] = await Promise.all([
    source("make-it-fly-current/infra/site/docker-compose.yml"),
    source("make-it-fly-current/infra/membros/docker-compose.yml"),
    source("radar-academico/infra/vps/docker-compose.yml"),
  ]);

  const siteWeb = service(site, "web");
  const caddy = service(site, "caddy");
  const membersPostgres = service(members, "postgres");
  const pgbouncer = service(members, "pgbouncer");
  const radarPostgres = service(radar, "postgres");
  const radarWeb = service(radar, "web");

  assert.doesNotMatch(siteWeb, /^\s+ports:/m);
  assert.match(siteWeb, /^\s+expose:/m);
  assert.match(caddy, /profiles: \[public\]/);
  assert.match(caddy, /- "80:80"/);
  assert.match(caddy, /- "443:443"/);

  assert.doesNotMatch(membersPostgres, /^\s+ports:/m);
  assert.match(pgbouncer, /"127\.0\.0\.1:\$\{PGBOUNCER_PORT:-6543\}:5432"/);
  assert.doesNotMatch(pgbouncer, /"(?:0\.0\.0\.0|\[::\]):/);

  assert.doesNotMatch(radarPostgres, /^\s+ports:/m);
  assert.doesNotMatch(radarWeb, /^\s+ports:/m);
  assert.match(radarWeb, /^\s+expose: \["3000"\]/m);
});
