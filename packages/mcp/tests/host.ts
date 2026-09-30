import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

const frame = document.querySelector<HTMLIFrameElement>("iframe")!;
const result = await fetch("/result").then(r => r.json());
const bridge = new AppBridge(null, { name: "Deterministic test host (not ChatGPT)", version: "1" }, { openLinks: {} }, {
  hostContext: { theme: "light", locale: "en-US", displayMode: "inline", availableDisplayModes: ["inline"] },
});
Object.assign(window, { bridge, openedLinks: [] });
bridge.onopenlink = async ({ url }) => {
  (window as any).openedLinks.push(url);
  window.open(url, "_blank", "noopener");
  return {};
};
bridge.oninitialized = async () => { await bridge.sendToolResult(result); };
await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
frame.src = "/resource";
