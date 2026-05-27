export function escapeHtml(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function isWeekend(dateStr: string): boolean {
	const d = new Date(dateStr + 'T00:00:00');
	return d.getDay() === 0 || d.getDay() === 6;
}

export function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch (_e) { return null; }
}

// ===== Simple Markdown Renderer =====
export function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    // Bold & Italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
    // Unordered list
    .replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Ordered list
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-indigo-300 pl-3 text-slate-600 italic my-1">$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-3 border-slate-200" />')
    // Links (block non-http protocols to prevent javascript: XSS)
    .replace(/\[(.+?)\]\((.+?)\)/g, (_: string, text: string, url: string) => {
      if (!/^https?:\/\//i.test(url)) return text;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 underline">${text}</a>`;
    })
    // Line breaks: double newline = paragraph break, single = <br>
    .replace(/\n\n/g, '</p><p class="my-1">')
    .replace(/\n/g, '<br/>');
  return '<p class="my-1">' + html + '</p>';
}