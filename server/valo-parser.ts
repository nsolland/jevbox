import { z } from "zod";
import { buildIndex, type ParsedDocument } from "./indexing";
import { jsonRequest } from "./provider-http";
import { PermanentJobError } from "./jobs";
import type { Fetch } from "./providers";

const parserResponse = z.object({
  chunks: z.array(z.unknown()).min(1),
  metadata: z.unknown().optional(),
  parser: z.string().optional(),
  version: z.string().optional(),
});

export type ValoParserInput = {
  id: string;
  name: string;
  mime: string;
  body: Uint8Array;
};

export function valoParserURL() {
  return process.env.VALO_PARSER_URL?.trim() || undefined;
}

export function valoParserConfigured() {
  return Boolean(valoParserURL());
}

/**
 * First-party parser boundary.
 *
 * The service returns the same neutral chunk/block contract consumed by
 * buildIndex. Jevbox owns the canonical evidence model; parser-specific
 * responses never become the persisted document contract.
 */
export async function parseWithValo(
  input: ValoParserInput,
  fetcher: Fetch,
  signal?: AbortSignal,
): Promise<ParsedDocument> {
  const base = valoParserURL();
  if (!base) throw new PermanentJobError("VALO parser is not configured");
  const url = new URL("/v1/parse", base).toString();
  const form = new FormData();
  form.append(
    "file",
    new Blob([input.body], { type: input.mime }),
    input.name,
  );
  form.append("documentId", input.id);
  const response = parserResponse.parse(
    await jsonRequest(fetcher, url, {
      method: "POST",
      body: form,
      signal,
      headers: process.env.VALO_PARSER_TOKEN
        ? { Authorization: `Bearer ${process.env.VALO_PARSER_TOKEN}` }
        : undefined,
    }),
  );
  return {
    ...buildIndex(response.chunks, "valo", response.metadata),
    parser: {
      id: response.parser ?? "valo",
      version: response.version,
    },
  } as ParsedDocument & {
    parser: { id: string; version?: string };
  };
}
