// @magicblock-labs/ephemeral-rollups-sdk and @coral-xyz/anchor expect the
// Node.js Buffer global at module-evaluation time; provide it before any of
// them load. This module must stay the first import in main.tsx.
import { Buffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}
