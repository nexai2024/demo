/** Split the knowledge document into blocks the help page can render and deep-link. */

function headingId(text, explicit) {
  if (explicit) return explicit;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseKnowledge(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  const push = (block) => blocks.push(block);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    const heading = /^(#{1,3})\s+(.+?)(?:\s+\{#([A-Za-z0-9-]+)\})?\s*$/.exec(line);
    if (heading) {
      const text = heading[2].replace(/\s+\{#[A-Za-z0-9-]+\}\s*$/, "");
      push({ type: "heading", level: heading[1].length, text, id: headingId(text, heading[3]) });
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) { body.push(lines[i]); i += 1; }
      i += 1;
      push({ type: "code", text: body.join("\n") });
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) {
        if (!/^\s*\|?\s*:?-{3,}/.test(lines[i])) rows.push(splitRow(lines[i]));
        i += 1;
      }
      push({ type: "table", header: rows[0] || [], rows: rows.slice(1) });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      push({ type: "list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      push({ type: "steps", items });
      continue;
    }

    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\s*[-*]\s+|\d+\.\s+)/.test(lines[i]) && !(lines[i].includes("|") && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] || ""))) {
      para.push(lines[i]);
      i += 1;
    }
    push({ type: "paragraph", text: para.join(" ") });
  }
  return blocks;
}

function splitRow(line) {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => cell.trim());
}

export function knowledgeNav(blocks) {
  return blocks.filter((block) => block.type === "heading" && block.level === 2);
}
