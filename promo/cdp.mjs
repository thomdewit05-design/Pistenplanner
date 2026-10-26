// Kleine helper om Chrome zonder venster te besturen (Chrome DevTools Protocol), zonder extra pakketten.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch(port = 9333){
  const dir = join(tmpdir(), "skipiloot-chrome-" + Date.now()); mkdirSync(dir, {recursive:true});
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-first-run",
    "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding", "--window-size=1080,1920", "about:blank"], {stdio:"ignore"});
  let ver;
  for(let i = 0; i < 50 && !ver; i++){ try{ ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); }catch(e){ await sleep(200); } }
  if(!ver) throw new Error("Chrome start niet");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = tabs.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(), listeners = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if(m.id && pending.has(m.id)){ const {res, rej} = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if(m.method) listeners.forEach(l => l(m));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, {res, rej}); ws.send(JSON.stringify({id:i, method, params})); });
  const evaluate = async (expr, timeout = 120000) => {
    const r = await send("Runtime.evaluate", {expression:expr, awaitPromise:true, returnByValue:true, timeout});
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const navigate = async url => {
    const loaded = new Promise(res => { const l = m => { if(m.method === "Page.loadEventFired"){ listeners.splice(listeners.indexOf(l), 1); res(); } }; listeners.push(l); });
    await send("Page.navigate", {url}); await loaded;
  };
  await send("Page.enable"); await send("Runtime.enable");
  return {send, evaluate, navigate, sleep, close:() => { try{ ws.close(); }catch(e){} proc.kill(); }};
}
