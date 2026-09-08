export type Edition = "self_hosted" | "cloud";

export function currentEdition(env: NodeJS.ProcessEnv = process.env): Edition {
  return env.EDITION === "cloud" ? "cloud" : "self_hosted";
}
