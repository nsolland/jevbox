/**
 * Provider-independent CAI retrieval evaluator.
 *
 * This is the deterministic local path used when no external JEV evaluator is
 * configured. It keeps the existing hierarchical traversal contract intact,
 * so CAI can use the corpus without TypeSafe credentials. A richer CAI model
 * adapter can replace these scoring functions without changing evidence state.
 */
function terms(text: string) {
  return new Set(
    text
      .toLocaleLowerCase()
      .normalize("NFKC")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length > 1),
  );
}

function overlap(query: string, evidence: string) {
  const q = terms(query);
  if (!q.size) return 0;
  const e = terms(evidence);
  let hits = 0;
  for (const term of q) if (e.has(term)) hits++;
  return hits / q.size;
}

export function createCaiRetrieval() {
  return {
    async decide(
      state: unknown,
      choices: { id: string; text: string }[],
      _instructions: string,
    ) {
      const query = JSON.stringify(state);
      const scores = choices.map((choice) => ({
        id: choice.id,
        score: Math.max(0.0001, overlap(query, choice.text)),
      }));
      const total = scores.reduce((sum, item) => sum + item.score, 0);
      return Object.fromEntries(
        scores.map((item) => [item.id, item.score / total]),
      );
    },

    async choose(
      query: string,
      menus: { id: string; choices: { id: string; text: string }[] }[],
    ) {
      return new Map(
        menus.map((menu) => {
          const scores = menu.choices.map((choice) => ({
            id: choice.id,
            score: overlap(query, choice.text),
          }));
          const none = scores.every((item) => item.score === 0) ? 0.8 : 0.05;
          const raw = scores.map((item) => ({
            ...item,
            score: Math.max(0.0001, item.score),
          }));
          const total = raw.reduce((sum, item) => sum + item.score, none);
          return [
            menu.id,
            {
              ...Object.fromEntries(
                raw.map((item) => [item.id, item.score / total]),
              ),
              none: none / total,
            },
          ] as const;
        }),
      );
    },

    async score(query: string, content: string) {
      return Math.min(3, overlap(query, content) * 4);
    },

    async scorePassages(query: string, contents: string[]) {
      return contents.map((content) => Math.min(3, overlap(query, content) * 4));
    },
  };
}
