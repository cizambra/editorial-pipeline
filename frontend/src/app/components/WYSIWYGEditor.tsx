import { useRef, useState, useEffect } from "react";
import { Bold, Italic, Link as LinkIcon, Hash, Code, Download, Copy, Check, RemoveFormatting } from "lucide-react";

interface WYSIWYGEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function WYSIWYGEditor({ value, onChange, placeholder }: WYSIWYGEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [rawText, setRawText] = useState(value);
  const [editingLink, setEditingLink] = useState<{ element: HTMLElement; url: string; text: string } | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const isUpdatingRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [activeFormats, setActiveFormats] = useState<{ bold: boolean; italic: boolean }>({ bold: false, italic: false });
  const [blockStyle, setBlockStyle] = useState<string>('p');

  // Copy content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download content as markdown file
  const handleDownload = () => {
    const blob = new Blob([value], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Convert markdown to HTML
  const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    
    // Split by double newlines to get blocks (paragraphs, headings, etc.)
    const blocks = markdown.split(/\n\n+/);
    
    const htmlBlocks = blocks.map(block => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return '';
      
      // Check if it's a heading
      const headingMatch = trimmedBlock.match(/^(#{1,5}) (.+?)(\n([\s\S]*))?$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = processInline(headingMatch[2]);
        const rest = headingMatch[4]?.trim();
        const tag = `h${level}`;
        const cls = `markdown-h${level}`;
        const headingHtml = `<${tag} class="${cls}">${headingText}</${tag}>`;
        if (!rest) return headingHtml;
        // Remaining lines after the heading become a paragraph
        const restLines = rest.split('\n').map(l => processInline(l)).join('<br>');
        return `${headingHtml}<p class="markdown-p">${restLines}</p>`;
      }

      // Process lines — group consecutive lines by block type
      const lines = trimmedBlock.split('\n');
      const segments: { type: 'blockquote' | 'li' | 'p'; lines: string[] }[] = [];
      for (const line of lines) {
        const isQuoteLine = /^> ?/.test(line);
        // bullet: `* text` or `- text` with optional indentation (space after * avoids italic conflict)
        const isBulletLine = /^\s*[*-] /.test(line);
        const segType = isQuoteLine ? 'blockquote' : isBulletLine ? 'li' : 'p';
        if (segments.length > 0 && segments[segments.length - 1].type === segType) {
          segments[segments.length - 1].lines.push(line);
        } else {
          segments.push({ type: segType, lines: [line] });
        }
      }

      return segments.map(seg => {
        if (seg.type === 'blockquote') {
          const content = seg.lines
            .map(line => line.replace(/^> ?/, ''))
            .map(line => processInline(line))
            .join('<br>');
          return `<blockquote class="markdown-blockquote">${content}</blockquote>`;
        } else if (seg.type === 'li') {
          return buildNestedList(seg.lines);
        } else {
          const content = seg.lines.map(line => processInline(line)).join('<br>');
          return `<p class="markdown-p">${content}</p>`;
        }
      }).join('');
    });
    
    return htmlBlocks.filter(block => block).join('');
  };

  // Build nested <ul> HTML from indented bullet lines
  const buildNestedList = (lines: string[]): string => {
    const flat = lines.map(line => {
      const m = line.match(/^(\s*)[*-] (.*)/);
      if (!m) return { level: 0, content: m ? m[2] : line };
      return { level: Math.floor(m[1].length / 2), content: m[2] };
    });

    const render = (startIdx: number, minLevel: number): { html: string; nextIdx: number } => {
      let html = '<ul class="markdown-ul">';
      let i = startIdx;
      while (i < flat.length) {
        const item = flat[i];
        if (item.level < minLevel) break;
        if (item.level > minLevel) { i++; continue; } // skip (shouldn't happen)
        i++;
        let liHtml = processInline(item.content);
        if (i < flat.length && flat[i].level > minLevel) {
          const child = render(i, flat[i].level);
          liHtml += child.html;
          i = child.nextIdx;
        }
        html += `<li class="markdown-li">${liHtml}</li>`;
      }
      html += '</ul>';
      return { html, nextIdx: i };
    };

    if (flat.length === 0) return '';
    const minLevel = Math.min(...flat.map(f => f.level));
    return render(0, minLevel).html;
  };

  const processInline = (text: string): string => {
    let html = text;
    
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Links [text](url) - with data attribute for editing
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="markdown-link" data-link-text="$1" data-link-url="$2" contenteditable="false">$1</a>');
    
    // Strikethrough ~~text~~
    html = html.replace(/~~(.+?)~~/g, '<s class="markdown-strike">$1</s>');

    // Bold **text** (must be before italic so ** is matched first)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="markdown-bold">$1</strong>');

    // Italic *text* (only matches single *, not **)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="markdown-italic">$1</em>');
    
    return html;
  };

  // Convert HTML back to markdown using DOM walking (handles nested structures correctly)
  const htmlToMarkdown = (html: string): string => {
    if (!html) return '';

    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    const walkNode = (node: Node, listDepth: number): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent ?? '').replace(/&nbsp;/g, ' ');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const children = () => Array.from(el.childNodes).map(n => walkNode(n, listDepth)).join('');

      switch (tag) {
        case 'h1': return `# ${children()}\n\n`;
        case 'h2': return `## ${children()}\n\n`;
        case 'h3': return `### ${children()}\n\n`;
        case 'h4': return `#### ${children()}\n\n`;
        case 'h5': return `##### ${children()}\n\n`;
        case 'p': return `${children()}\n\n`;
        case 'br': return '\n';
        case 'strong': return `**${children()}**`;
        case 'em': return `*${children()}*`;
        case 's':
        case 'del': return `~~${children()}~~`;
        case 'a': {
          const href = el.getAttribute('data-link-url') || el.getAttribute('href') || '';
          const text = el.getAttribute('data-link-text') || children();
          return `[${text}](${href})`;
        }
        case 'blockquote': {
          const inner = children().trim();
          return inner.split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
        }
        case 'ul': {
          const indent = '  '.repeat(listDepth);
          let result = '';
          for (const child of Array.from(el.childNodes)) {
            if ((child as Element).tagName !== 'LI') continue;
            const li = child as Element;
            const nestedUl = li.querySelector(':scope > ul');
            let text = '';
            for (const c of Array.from(li.childNodes)) {
              if ((c as Element).tagName === 'UL') continue; // handled below
              text += walkNode(c, listDepth);
            }
            const nested = nestedUl ? walkNode(nestedUl, listDepth + 1) : '';
            result += `${indent}- ${text.trim()}\n${nested}`;
          }
          return result + (listDepth === 0 ? '\n' : '');
        }
        default: return children();
      }
    };

    let markdown = Array.from(tmp.childNodes).map(n => walkNode(n, 0)).join('');
    markdown = markdown.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
    markdown = markdown.replace(/[ \t]+\n/g, '\n');
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    return markdown.trim();
  };

  // Sync markdown value to editor HTML
  useEffect(() => {
    if (!showRawMarkdown && editorRef.current && !isUpdatingRef.current) {
      const html = markdownToHtml(value);
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = html;
      }
    }
    setRawText(value);
  }, [value, showRawMarkdown]);

  // Update active format buttons based on selection
  useEffect(() => {
    const handleSelectionChange = () => {
      if (!editorRef.current || showRawMarkdown) return;
      
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      let node = selection.anchorNode;
      if (!node) return;
      
      // Check if we're inside the editor
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }
      
      if (!editorRef.current.contains(node as Node)) return;
      
      // Check for formatting and block style
      let isBold = false;
      let isItalic = false;
      let detectedBlock = 'p';
      let current = node as HTMLElement | null;
      const blockTags = new Set(['H1','H2','H3','H4','H5','P','BLOCKQUOTE','LI']);

      while (current && current !== editorRef.current) {
        if (current.tagName === 'STRONG') isBold = true;
        if (current.tagName === 'EM') isItalic = true;
        if (blockTags.has(current.tagName)) detectedBlock = current.tagName.toLowerCase();
        current = current.parentElement;
      }

      setActiveFormats({ bold: isBold, italic: isItalic });
      setBlockStyle(detectedBlock);
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [showRawMarkdown]);

  // Save cursor as character offset from start of editor
  const saveCursor = (): number => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return 0;
    const range = selection.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(editorRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  };

  // Restore cursor from character offset
  const restoreCursor = (offset: number) => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    let remaining = offset;
    const walk = (node: Node): boolean => {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.textContent?.length ?? 0;
        if (remaining <= len) {
          const range = document.createRange();
          range.setStart(node, remaining);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= len;
      } else {
        for (const child of Array.from(node.childNodes)) {
          if (walk(child)) return true;
        }
      }
      return false;
    };
    walk(editorRef.current);
  };

  // Handle input changes in WYSIWYG mode
  const handleInput = () => {
    if (!editorRef.current || isUpdatingRef.current) return;

    isUpdatingRef.current = true;
    const html = editorRef.current.innerHTML;
    const markdown = htmlToMarkdown(html);
    onChange(markdown);

    // Immediately re-render HTML to apply block-level formatting (blockquotes, headings).
    // Save/restore cursor so the DOM update doesn't jump the caret.
    const newHtml = markdownToHtml(markdown);
    if (editorRef.current.innerHTML !== newHtml) {
      const cursorOffset = saveCursor();
      editorRef.current.innerHTML = newHtml;
      restoreCursor(cursorOffset);
    }

    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  };

  // Handle clicking on formatted elements
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check if clicking on a link
    if (target.tagName === 'A' || target.closest('a')) {
      e.preventDefault();
      const link = (target.tagName === 'A' ? target : target.closest('a')) as HTMLElement;
      const linkUrlAttr = link.getAttribute('data-link-url') || link.getAttribute('href') || '';
      const linkTextAttr = link.getAttribute('data-link-text') || link.textContent || '';
      
      setEditingLink({
        element: link,
        url: linkUrlAttr,
        text: linkTextAttr
      });
      setLinkUrl(linkUrlAttr);
      setLinkText(linkTextAttr);
    }
  };

  // Save link edit
  const saveLinkEdit = () => {
    if (!editingLink || !editorRef.current) return;
    
    const newLink = document.createElement('a');
    newLink.href = linkUrl;
    newLink.className = 'markdown-link';
    newLink.setAttribute('data-link-text', linkText);
    newLink.setAttribute('data-link-url', linkUrl);
    newLink.setAttribute('contenteditable', 'false');
    newLink.textContent = linkText;
    
    if (editingLink.element.parentElement) {
      editingLink.element.parentElement.replaceChild(newLink, editingLink.element);
    }
    
    setEditingLink(null);
    handleInput();
  };

  // Cancel link edit
  const cancelLinkEdit = () => {
    setEditingLink(null);
  };

  // Toggle formatting (bold, italic) - now removes if already applied
  const toggleFormat = (format: 'bold' | 'italic') => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    // Check if the selection or cursor is inside a formatted element
    const tagName = format === 'bold' ? 'STRONG' : 'EM';
    let node = selection.anchorNode;
    
    if (node && node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    
    // Find if we're inside a formatting element
    let formattedElement: HTMLElement | null = null;
    let current = node as HTMLElement | null;
    while (current && current !== editorRef.current) {
      if (current.tagName === tagName) {
        formattedElement = current;
        break;
      }
      current = current.parentElement;
    }
    
    if (formattedElement) {
      // Remove formatting
      const cursorOffset = selection.anchorOffset;
      
      // Replace the formatted element with its text content
      const textNode = document.createTextNode(formattedElement.textContent || '');
      if (formattedElement.parentElement) {
        formattedElement.parentElement.replaceChild(textNode, formattedElement);
        
        // Restore cursor position
        const newRange = document.createRange();
        try {
          // If there was a selection, clear it; otherwise restore cursor
          if (selectedText) {
            newRange.setStart(textNode, 0);
            newRange.setEnd(textNode, textNode.length);
          } else {
            newRange.setStart(textNode, Math.min(cursorOffset, textNode.length));
            newRange.setEnd(textNode, Math.min(cursorOffset, textNode.length));
          }
          selection.removeAllRanges();
          selection.addRange(newRange);
        } catch (err) {
          console.error('Error restoring cursor:', err);
        }
      }
      handleInput();
      return;
    }
    
    // Add formatting (only if not already formatted)
    if (!selectedText) {
      // No selection - try to format the word at cursor
      const textNode = selection.anchorNode;
      if (textNode && textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
        const offset = selection.anchorOffset;
        const text = textNode.textContent;
        
        // Find word boundaries
        let start = offset;
        let end = offset;
        
        while (start > 0 && /\S/.test(text[start - 1])) start--;
        while (end < text.length && /\S/.test(text[end])) end++;
        
        const word = text.substring(start, end);
        if (!word) return;
        
        // Create the formatted element
        let newElement: HTMLElement;
        if (format === 'bold') {
          newElement = document.createElement('strong');
          newElement.className = 'markdown-bold';
        } else {
          newElement = document.createElement('em');
          newElement.className = 'markdown-italic';
        }
        newElement.textContent = word;
        
        // Replace the word
        const textBefore = text.substring(0, start);
        const textAfter = text.substring(end);
        
        const beforeNode = document.createTextNode(textBefore);
        const afterNode = document.createTextNode(textAfter);
        
        const parent = textNode.parentElement;
        if (parent) {
          parent.insertBefore(beforeNode, textNode);
          parent.insertBefore(newElement, textNode);
          parent.insertBefore(afterNode, textNode);
          parent.removeChild(textNode);
          
          // Move cursor after the formatted element
          const newRange = document.createRange();
          newRange.setStartAfter(newElement);
          newRange.setEndAfter(newElement);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
        
        handleInput();
        return;
      }
      return;
    }
    
    // Add formatting to selection
    let newElement: HTMLElement;
    
    if (format === 'bold') {
      newElement = document.createElement('strong');
      newElement.className = 'markdown-bold';
    } else {
      newElement = document.createElement('em');
      newElement.className = 'markdown-italic';
    }
    
    newElement.textContent = selectedText;
    
    try {
      range.deleteContents();
      range.insertNode(newElement);
      
      // Move cursor after the inserted element
      range.setStartAfter(newElement);
      range.setEndAfter(newElement);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleInput();
    } catch (err) {
      console.error('Error toggling format:', err);
    }
  };

  // Clear all formatting from selection
  const clearFormatting = () => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    if (!selectedText) return;
    
    // Replace selection with plain text
    const textNode = document.createTextNode(selectedText);
    
    try {
      range.deleteContents();
      range.insertNode(textNode);
      
      // Move cursor after the inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleInput();
    } catch (err) {
      console.error('Error clearing format:', err);
    }
  };

  // Insert link
  const insertLink = () => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString() || 'link';
    
    const url = prompt('Enter URL:');
    if (!url) return;
    
    const link = document.createElement('a');
    link.href = url;
    link.className = 'markdown-link';
    link.setAttribute('data-link-text', selectedText);
    link.setAttribute('data-link-url', url);
    link.setAttribute('contenteditable', 'false');
    link.textContent = selectedText;
    
    try {
      range.deleteContents();
      range.insertNode(link);
      
      // Move cursor after the link
      range.setStartAfter(link);
      range.setEndAfter(link);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleInput();
    } catch (err) {
      console.error('Error inserting link:', err);
    }
  };

  // Enter = new paragraph, Shift+Enter = soft line break within block
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    e.preventDefault();

    // Find current block element (needed for both Enter and Shift+Enter)
    let node = selection.anchorNode as HTMLElement | null;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const headingTags = new Set(['H1','H2','H3','H4','H5']);
    const blockTags = new Set(['H1','H2','H3','H4','H5','P','BLOCKQUOTE','LI']);
    let blockEl: HTMLElement | null = null;
    let cur = node;
    while (cur && cur !== editorRef.current) {
      if (blockTags.has(cur.tagName)) { blockEl = cur; break; }
      cur = cur.parentElement;
    }

    const inHeading = blockEl ? headingTags.has(blockEl.tagName) : false;

    if (e.shiftKey && !inHeading) {
      // Shift+Enter outside a heading: insert <br> in place (stays in same block)
      range.deleteContents();
      const br = document.createElement('br');
      range.insertNode(br);
      // Trailing <br> ensures cursor is visible when at end of block
      if (!br.nextSibling) {
        br.parentNode?.appendChild(document.createElement('br'));
      }
      range.setStartAfter(br);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      // Sync markdown value but skip DOM re-render (re-render strips trailing <br>)
      isUpdatingRef.current = true;
      onChange(htmlToMarkdown(editorRef.current!.innerHTML));
      setTimeout(() => { isUpdatingRef.current = false; }, 0);
      return;
    }

    // Enter (or Shift+Enter inside a heading): create a new <p> after current block
    const newP = document.createElement('p');
    newP.className = 'markdown-p';

    if (blockEl) {
      // Move content after cursor into the new <p>
      const afterRange = document.createRange();
      afterRange.setStart(range.endContainer, range.endOffset);
      afterRange.setEndAfter(blockEl.lastChild ?? blockEl);
      const afterFragment = afterRange.extractContents();
      if (afterFragment.textContent?.trim()) {
        newP.appendChild(afterFragment);
      } else {
        newP.innerHTML = '<br>';
      }
      // If extractContents emptied blockEl (e.g. cursor was in empty <p><br></p>),
      // restore the <br> so the paragraph keeps its height and cursor visibility.
      if (!blockEl.firstChild) {
        blockEl.innerHTML = '<br>';
      }
      blockEl.parentElement?.insertBefore(newP, blockEl.nextSibling);
    } else {
      newP.innerHTML = '<br>';
      editorRef.current?.appendChild(newP);
    }

    const newRange = document.createRange();
    newRange.setStart(newP, 0);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    // Sync markdown value without re-rendering the DOM.
    // Re-rendering would strip the empty <p> (no markdown representation),
    // collapsing the new paragraph back into the heading.
    isUpdatingRef.current = true;
    onChange(htmlToMarkdown(editorRef.current!.innerHTML));
    setTimeout(() => { isUpdatingRef.current = false; }, 0);
  };

  // Apply block-level style (heading or paragraph) to the block under cursor
  const applyBlockStyle = (style: string) => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let node = selection.anchorNode as HTMLElement | null;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;

    // Walk up to find the nearest block element inside the editor
    const blockTags = new Set(['H1','H2','H3','H4','H5','P','BLOCKQUOTE','LI']);
    let blockEl: HTMLElement | null = null;
    let current = node;
    while (current && current !== editorRef.current) {
      if (blockTags.has(current.tagName)) { blockEl = current; break; }
      current = current.parentElement;
    }
    if (!blockEl) return;

    const tagMap: Record<string, string> = { p: 'p', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5' };
    const classMap: Record<string, string> = {
      p: 'markdown-p', h1: 'markdown-h1', h2: 'markdown-h2',
      h3: 'markdown-h3', h4: 'markdown-h4', h5: 'markdown-h5',
    };

    const newEl = document.createElement(tagMap[style] ?? 'p');
    newEl.className = classMap[style] ?? 'markdown-p';
    newEl.innerHTML = blockEl.innerHTML;
    blockEl.parentElement?.replaceChild(newEl, blockEl);

    // Place cursor at end of new element
    const range = document.createRange();
    range.selectNodeContents(newEl);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    setBlockStyle(style);
    handleInput();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2" style={{ borderBottom: '1px solid rgba(var(--border-rgb), 0.12)', background: 'var(--secondary)' }}>
        <button
          onClick={() => setShowRawMarkdown(!showRawMarkdown)}
          className="p-2 rounded hover:bg-white/50 transition-colors"
          style={{ background: showRawMarkdown ? '#fff' : 'transparent' }}
          title={showRawMarkdown ? "Switch to WYSIWYG" : "Switch to Raw Markdown"}
        >
          <Code size={16} style={{ color: 'var(--primary)' }} />
        </button>
        
        <div style={{ width: '1px', height: '20px', background: 'rgba(var(--border-rgb), 0.12)' }} />
        
        {!showRawMarkdown ? (
          <>
            <select
              value={blockStyle}
              onChange={(e) => applyBlockStyle(e.target.value)}
              className="text-xs rounded px-1.5 py-1 outline-none cursor-pointer"
              style={{
                background: 'white',
                border: '1px solid rgba(var(--border-rgb),0.14)',
                color: 'var(--muted-foreground)',
                fontWeight: 600,
                minWidth: '90px',
              }}
            >
              <option value="p">Normal</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
              <option value="h5">Heading 5</option>
            </select>

            <div style={{ width: '1px', height: '20px', background: 'rgba(var(--border-rgb), 0.12)' }} />

            <button
              onClick={() => toggleFormat('bold')}
              className="p-2 rounded hover:bg-white/50 transition-colors"
              style={{ background: activeFormats.bold ? '#fff' : 'transparent' }}
              title="Bold (Ctrl/Cmd+B)"
            >
              <Bold size={16} style={{ color: activeFormats.bold ? 'var(--primary)' : 'var(--muted-foreground)' }} />
            </button>
            
            <button
              onClick={() => toggleFormat('italic')}
              className="p-2 rounded hover:bg-white/50 transition-colors"
              style={{ background: activeFormats.italic ? '#fff' : 'transparent' }}
              title="Italic (Ctrl/Cmd+I)"
            >
              <Italic size={16} style={{ color: activeFormats.italic ? 'var(--primary)' : 'var(--muted-foreground)' }} />
            </button>
            
            <button
              onClick={insertLink}
              className="p-2 rounded hover:bg-white/50 transition-colors"
              title="Insert Link"
            >
              <LinkIcon size={16} style={{ color: 'var(--muted-foreground)' }} />
            </button>

            <div style={{ width: '1px', height: '20px', background: 'rgba(var(--border-rgb), 0.12)' }} />

            <button
              onClick={clearFormatting}
              className="p-2 rounded hover:bg-white/50 transition-colors"
              title="Clear formatting"
            >
              <RemoveFormatting size={16} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </>
        ) : null}
        
        <div className="flex-1" />
        
        <button
          onClick={handleCopy}
          className="p-2 rounded hover:bg-white/50 transition-colors"
          title={copied ? "Copied!" : "Copy all content"}
        >
          {copied ? (
            <Check size={16} style={{ color: '#22c55e' }} />
          ) : (
            <Copy size={16} style={{ color: 'var(--muted-foreground)' }} />
          )}
        </button>
        
        <button
          onClick={handleDownload}
          className="p-2 rounded hover:bg-white/50 transition-colors"
          title="Download as .md file"
        >
          <Download size={16} style={{ color: 'var(--muted-foreground)' }} />
        </button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-auto flex flex-col" style={{ background: '#fff' }}>
        {showRawMarkdown ? (
          // Raw Markdown Mode
          <textarea
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              onChange(e.target.value);
            }}
            className="w-full flex-1 p-4 outline-none resize-none"
            style={{
              background: '#fff',
              color: 'var(--foreground)',
              fontSize: '13px',
              lineHeight: '1.7',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              border: 'none'
            }}
            placeholder={placeholder || 'Type markdown here...'}
            spellCheck={false}
          />
        ) : (
          // WYSIWYG Mode
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onClick={handleEditorClick}
            className="wysiwyg-editor p-4 outline-none flex-1"
            data-placeholder={placeholder || 'Start typing...'}
            style={{
              background: '#fff',
              fontSize: '14px',
              lineHeight: '1.7',
              minHeight: '300px',
              cursor: 'text'
            }}
            suppressContentEditableWarning
          />
        )}
      </div>

      {/* Link Edit Modal */}
      {editingLink && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000 }}
          onClick={cancelLinkEdit}
        >
          <div 
            className="p-6 rounded-xl shadow-lg max-w-md w-full"
            style={{ background: 'var(--card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-4" style={{ color: 'var(--foreground)' }}>Edit Link</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  Link Text
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{ 
                    background: '#fff',
                    border: '1px solid rgba(var(--border-rgb), 0.12)',
                    color: 'var(--foreground)'
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  URL
                </label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{ 
                    background: '#fff',
                    border: '1px solid rgba(var(--border-rgb), 0.12)',
                    color: 'var(--foreground)'
                  }}
                  placeholder="https://example.com"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={saveLinkEdit}
                className="flex-1 px-4 py-2 rounded-lg font-semibold"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                Save
              </button>
              <button
                onClick={cancelLinkEdit}
                className="flex-1 px-4 py-2 rounded-lg font-semibold"
                style={{ background: '#efe3cf', color: 'var(--foreground)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .wysiwyg-editor .markdown-h2 {
          font-size: 20px;
          font-weight: 700;
          color: #20180f;
          margin: 0 0 12px 0;
          line-height: 1.3;
        }

        .wysiwyg-editor .markdown-h2:not(:first-child) {
          margin-top: 24px;
        }
        
        .wysiwyg-editor .markdown-h3 {
          font-size: 17px;
          font-weight: 700;
          color: #20180f;
          margin: 0 0 10px 0;
          line-height: 1.3;
        }

        .wysiwyg-editor .markdown-h3:not(:first-child) {
          margin-top: 20px;
        }

        .wysiwyg-editor .markdown-h4 {
          font-size: 15px;
          font-weight: 700;
          color: #20180f;
          margin: 0 0 8px 0;
          line-height: 1.3;
        }

        .wysiwyg-editor .markdown-h4:not(:first-child) {
          margin-top: 16px;
        }

        .wysiwyg-editor .markdown-h5 {
          font-size: 13px;
          font-weight: 700;
          color: #6e6256;
          margin: 0 0 6px 0;
          line-height: 1.3;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .wysiwyg-editor .markdown-h5:not(:first-child) {
          margin-top: 14px;
        }
        
        .wysiwyg-editor .markdown-h1 {
          font-size: 24px;
          font-weight: 700;
          color: #20180f;
          margin: 0 0 16px 0;
          line-height: 1.3;
        }

        .wysiwyg-editor .markdown-h1:not(:first-child) {
          margin-top: 32px;
        }
        
        .wysiwyg-editor .markdown-p {
          color: #20180f;
          line-height: 1.7;
          margin: 0 0 12px 0;
        }

        .wysiwyg-editor .markdown-p:last-child {
          margin-bottom: 0;
        }
        
        .wysiwyg-editor .markdown-bold,
        .wysiwyg-editor strong {
          font-weight: 700 !important;
        }
        
        .wysiwyg-editor .markdown-italic,
        .wysiwyg-editor em {
          font-style: italic !important;
        }
        
        .wysiwyg-editor .markdown-link {
          color: #c4522a;
          text-decoration: underline;
          cursor: pointer;
        }
        
        .wysiwyg-editor .markdown-link:hover {
          color: #a03d1e;
        }

        .wysiwyg-editor .markdown-ul {
          margin: 0 0 12px 0;
          padding-left: 22px;
          list-style-type: disc;
        }

        .wysiwyg-editor .markdown-ul .markdown-ul {
          margin: 2px 0 2px 0;
          list-style-type: circle;
        }

        .wysiwyg-editor .markdown-ul .markdown-ul .markdown-ul {
          list-style-type: square;
        }

        .wysiwyg-editor .markdown-li {
          color: #20180f;
          line-height: 1.7;
          margin-bottom: 2px;
        }

        .wysiwyg-editor .markdown-strike {
          text-decoration: line-through;
          color: #9e8f7f;
        }

        .wysiwyg-editor .markdown-blockquote {
          border-left: 3px solid #c4522a;
          margin: 0 0 12px 0;
          padding: 8px 16px;
          background: rgba(var(--primary-rgb), 0.05);
          color: #6e6256;
          font-style: italic;
          border-radius: 0 6px 6px 0;
        }

        .wysiwyg-editor .markdown-blockquote:not(:first-child) {
          margin-top: 12px;
        }

        .wysiwyg-editor:empty:before {
          content: attr(data-placeholder);
          color: #9e8f7f;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}