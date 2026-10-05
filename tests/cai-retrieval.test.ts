import assert from "node:assert/strict";
import test from "node:test";
import { createCaiRetrieval } from "../server/cai-retrieval";

test("CAI retrieval ranks matching evidence without external credentials", async () => {
  const cai = createCaiRetrieval();
  const routes = await cai.choose("fresh authority decision", [
    {
      id: "root",
      choices: [
        { id: "a", text: "weather forecast and precipitation" },
        { id: "b", text: "fresh authority decision evidence" },
      ],
    },
  ]);
  const root = routes.get("root")!;
  assert.ok(root.b > root.a);
  assert.ok(root.b > root.none);

  const scores = await cai.scorePassages("document provenance", [
    "unrelated weather report",
    "document provenance links the derived passage to source evidence",
  ]);
  assert.ok(scores[1] > scores[0]);
});
