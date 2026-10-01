import { test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Execute the actual deployment shell, but NEVER allow git, Docker or curl to reach production.
function deploy(scenario: string) {
  const dir = mkdtempSync(join(tmpdir(), "evnelo-deploy-test-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const trace = join(dir, "trace");
  const shim = `#!${process.execPath}
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const name = require('node:path').basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TRACE, JSON.stringify({name,args})+'\\n');
if (name === 'git') {
  if (args[0] === 'rev-parse') console.log('testsha');
} else if (name === 'docker') {
  if (args.includes('--build') && process.env.SCENARIO === 'readiness-fail') process.exit(1);
  if (args.includes('ps')) console.log('caddy-test-id');
  if (args[0] === 'inspect') console.log(process.env.SCENARIO === 'proxy-stopped' ? 'exited none' : process.env.SCENARIO === 'proxy-unhealthy' ? 'running unhealthy' : 'running none');
  if (args.includes('exec')) {
    const at = args.indexOf('node');
    const child = spawnSync(process.execPath, args.slice(at+1), {env: {...process.env, EVNELO_URL: process.env.SCENARIO === 'http-origin' ? 'http://public.example' : 'https://public.example'}, stdio: 'inherit'});
    process.exit(child.status ?? 1);
  }
} else if (name === 'curl') {
  if (process.env.SCENARIO === 'https-fail') process.exit(60);
  if (process.env.SCENARIO === 'rpc-error') console.log(JSON.stringify({jsonrpc:'2.0',id:1,error:{code:-32603,message:'failed'}}));
  else if (process.env.SCENARIO === 'invalid-json') console.log('<html>proxy error</html>');
  else if (process.env.SCENARIO === 'wrong-id') console.log(JSON.stringify({jsonrpc:'2.0',id:2,result:{protocolVersion:'2025-03-26',capabilities:{},serverInfo:{name:'evnelo',version:'1'}}}));
  else if (process.env.SCENARIO === 'empty-result') console.log(JSON.stringify({jsonrpc:'2.0',id:1,result:{}}));
  else console.log(JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-03-26',capabilities:{},serverInfo:{name:'evnelo',version:'1'}}}));
}
`;
  for (const name of ["git", "docker", "curl"]) writeFileSync(join(bin, name), shim, { mode: 0o755 });
  try {
    const result = spawnSync("/bin/sh", [new URL("../../../deploy/deploy.sh", import.meta.url).pathname], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TRACE: trace, SCENARIO: scenario }, encoding: "utf8", timeout: 10000,
    });
    const calls = readFileSync(trace, "utf8").trim().split("\n").map(line => JSON.parse(line) as { name: string; args: string[] });
    return { ...result, calls };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test.each(["https-fail", "rpc-error", "invalid-json", "wrong-id", "empty-result", "http-origin"])("deployment rejects public initialize failure: %s", scenario => {
  const result = deploy(scenario);
  expect(result.status).not.toBe(0);
  expect(result.stdout).not.toContain("deployed ");
  expect(result.calls.some(c => c.args.includes("prune"))).toBe(false);
});

test("deployment reports success only after readiness, proxy and validated HTTPS initialize", () => {
  const result = deploy("success");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("deployed testsha");
  const at = (predicate: (c: {name: string; args: string[]}) => boolean) => result.calls.findIndex(predicate);
  const ready = at(c => c.args.includes("--wait"));
  const proxy = at(c => c.args.includes("--force-recreate"));
  const inspect = at(c => c.args[0] === "inspect");
  const request = at(c => c.name === "curl");
  const validate = result.calls.findIndex((c, i) => i > request && c.args.includes("exec"));
  const prune = at(c => c.args.includes("prune"));
  expect(ready).toBeGreaterThan(-1);
  expect(proxy).toBeGreaterThan(ready);
  expect(inspect).toBeGreaterThan(proxy);
  expect(request).toBeGreaterThan(inspect);
  expect(validate).toBeGreaterThan(request);
  expect(prune).toBeGreaterThan(validate);
  const curl = result.calls[request]!.args;
  expect(curl).toContain("https://public.example/mcp");
  expect(curl).toContain("--fail");
  expect(curl).not.toContain("--insecure");
  expect(curl).not.toContain("-k");
  for (const flag of ["--connect-timeout", "--max-time", "--retry-max-time"]) {
    const index = curl.indexOf(flag);
    expect(index).toBeGreaterThan(-1);
    expect(Number(curl[index + 1])).toBeGreaterThan(0);
    expect(Number(curl[index + 1])).toBeLessThanOrEqual(60);
  }
  const body = JSON.parse(curl[curl.indexOf("--data") + 1]!);
  expect(body).toMatchObject({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "evnelo-deploy" } } });
  expect(curl).toContain("Accept: application/json, text/event-stream");
});

test.each(["proxy-stopped", "proxy-unhealthy"])("deployment rejects %s before reporting success", scenario => {
  const result = deploy(scenario);
  expect(result.status).not.toBe(0);
  expect(result.stdout).not.toContain("deployed ");
  expect(result.calls.some(c => c.name === "curl")).toBe(false);
  expect(result.calls.some(c => c.args.includes("prune"))).toBe(false);
});

test("deployment stops before proxy recreation when bounded app/MCP readiness fails", () => {
  const result = deploy("readiness-fail");
  expect(result.status).not.toBe(0);
  expect(result.stdout).not.toContain("deployed ");
  expect(result.calls.some(c => c.args.includes("--force-recreate"))).toBe(false);
  const up = result.calls.find(c => c.args.includes("--build"))!;
  expect(up.args).toContain("--wait");
  const timeout = up.args.indexOf("--wait-timeout");
  expect(timeout).toBeGreaterThan(-1);
  expect(Number(up.args[timeout + 1])).toBeGreaterThan(0);
  expect(Number(up.args[timeout + 1])).toBeLessThanOrEqual(300);
});
