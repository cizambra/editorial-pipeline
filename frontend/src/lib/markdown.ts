/** Minimal markdown → HTML renderer used for display-only contexts. */

function processInline(text: string): string {
  let html = text;
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;">$1</a>');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong style=\"font-weight:700;\">$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em style=\"font-style:italic;\">$1</em>");
  return html;
}

export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  return markdown
    .split("\n")
    .map(line => {
      if (line.startsWith("### ")) return `<h3 style="font-size:1em;font-weight:700;margin:0.5em 0 0.25em;">${processInline(line.slice(4))}</h3>`;
      if (line.startsWith("## "))  return `<h2 style="font-size:1.1em;font-weight:700;margin:0.5em 0 0.25em;">${processInline(line.slice(3))}</h2>`;
      if (line.trim() === "")      return `<p style="margin:0;line-height:1.6;"><br></p>`;
      return `<p style="margin:0;line-height:1.6;">${processInline(line)}</p>`;
    })
    .join("");
}
