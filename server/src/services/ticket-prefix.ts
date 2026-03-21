import { randomInt } from "node:crypto";

const fallbackTicketPrefixLetters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const fallbackTicketPrefixLength = 4;
const totalFallbackTicketPrefixCount = fallbackTicketPrefixLetters.length ** fallbackTicketPrefixLength;

export function normalizeProjectTicketPrefixSource(name: string) {
  return name.normalize("NFKD").replace(/[^A-Za-z]/g, "").toUpperCase();
}

function createRandomTicketPrefix(length = fallbackTicketPrefixLength) {
  let prefix = "";

  for (let index = 0; index < length; index += 1) {
    prefix += fallbackTicketPrefixLetters[randomInt(0, fallbackTicketPrefixLetters.length)];
  }

  return prefix;
}

function findAvailableRandomTicketPrefix(usedPrefixes: Set<string>) {
  if (usedPrefixes.size >= totalFallbackTicketPrefixCount) {
    throw new Error("No unique project ticket prefix is available.");
  }

  for (let attempt = 0; attempt < 256; attempt += 1) {
    const candidate = createRandomTicketPrefix();
    if (!usedPrefixes.has(candidate)) {
      return candidate;
    }
  }

  for (const firstLetter of fallbackTicketPrefixLetters) {
    for (const secondLetter of fallbackTicketPrefixLetters) {
      for (const thirdLetter of fallbackTicketPrefixLetters) {
        for (const fourthLetter of fallbackTicketPrefixLetters) {
          const candidate = `${firstLetter}${secondLetter}${thirdLetter}${fourthLetter}`;
          if (!usedPrefixes.has(candidate)) {
            return candidate;
          }
        }
      }
    }
  }

  throw new Error("No unique project ticket prefix is available.");
}

export function listProjectTicketPrefixCandidates(name: string) {
  const normalized = normalizeProjectTicketPrefixSource(name);
  const candidates: string[] = [];
  const seenCandidates = new Set<string>();

  function addCandidate(candidate: string) {
    if (candidate.length < 2 || candidate.length > 4 || seenCandidates.has(candidate)) {
      return;
    }

    seenCandidates.add(candidate);
    candidates.push(candidate);
  }

  function addCombinations(targetLength: number) {
    if (targetLength > normalized.length) {
      return;
    }

    const letters = [...normalized];

    function visit(nextIndex: number, current: string) {
      if (current.length === targetLength) {
        addCandidate(current);
        return;
      }

      for (let index = nextIndex; index < letters.length; index += 1) {
        if (current.length === 0 && index !== 0) {
          continue;
        }

        visit(index + 1, current + letters[index]);
      }
    }

    visit(0, "");
  }

  if (normalized.length === 1) {
    addCandidate(`${normalized}X`);
  } else {
    if (normalized.length <= 4) {
      addCandidate(normalized);
    }

    if (normalized.length >= 4) {
      addCombinations(4);
    }
    if (normalized.length >= 3) {
      addCombinations(3);
    }
    addCombinations(2);
  }

  return candidates;
}

export function resolveProjectTicketPrefix(name: string, usedPrefixes: Set<string>) {
  const prefixFromName = listProjectTicketPrefixCandidates(name).find(
    (candidate) => !usedPrefixes.has(candidate)
  );

  return prefixFromName ?? findAvailableRandomTicketPrefix(usedPrefixes);
}
