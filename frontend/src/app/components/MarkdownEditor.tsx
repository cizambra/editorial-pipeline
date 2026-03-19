import { useRef, useState, useEffect } from "react";
import { Bold, Italic, Link as LinkIcon, Hash } from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(value);

  // Sync with parent value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Convert markdown to HTML for preview
  const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    
    const lines = markdown.split('\n');
    const htmlLines = lines.map(line => {
      // Headings
      if (line.startsWith('## ')) {
        const content = processInline(line.substring(3));
        return `<h2 class="markdown-h2">${content}</h2>`;
      }
      if (line.startsWith('### ')) {
        const content = processInline(line.substring(4));
        return `<h3 class="markdown-h3">${content}</h3>`;
      }
      
      // Empty line
      if (line.trim() === '') {
        return '<p class="markdown-p"><br></p>';
      }
      
      // Regular paragraph
      const content = processInline(line);
      return `<p class="markdown-p">${content}</p>`;
    });
    
    return htmlLines.join('');
  };

  const processInline = (text: string): string => {
    let html = text;
    
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Links [text](url) - do first to protect them
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="markdown-link" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Bold **text** - do before italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="markdown-bold" style="font-weight: 700;">$1</strong>');
    
    // Italic *text* - use inline style to force it
    html = html.replace(/\*(.+?)\*/g, '<em class="markdown-italic" style="font-style: italic;">$1</em>');
    
    return html;
  };

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const insertMarkdown = (before: string, after: string = '') => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localValue.substring(start, end);
    
    const beforeText = localValue.substring(0, start);
    const afterText = localValue.substring(end);
    
    const insertText = before + (selectedText || 'text') + (after || before);
    const newValue = beforeText + insertText + afterText;
    
    handleChange(newValue);
    
    // Restore focus and selection
    setTimeout(() => {
      if (!textareaRef.current) return;
      textarea.focus();
      const newCursorPos = start + insertText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertHeading = () => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    
    // Find start of current line
    const beforeCursor = localValue.substring(0, start);
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    
    // Check if line already has ##
    const lineEnd = localValue.indexOf('\n', lineStart);
    const currentLine = localValue.substring(lineStart, lineEnd === -1 ? undefined : lineEnd);
    
    let newValue;
    let cursorOffset = 0;
    
    if (currentLine.startsWith('## ')) {
      // Remove ##
      const beforeLine = localValue.substring(0, lineStart);
      const afterLine = localValue.substring(lineStart + 3);
      newValue = beforeLine + afterLine;
      cursorOffset = -3;
    } else {
      // Add ##
      const beforeLine = localValue.substring(0, lineStart);
      const afterLine = localValue.substring(lineStart);
      newValue = beforeLine + '## ' + afterLine;
      cursorOffset = 3;
    }
    
    handleChange(newValue);
    
    // Restore focus
    setTimeout(() => {
      if (!textareaRef.current) return;
      textarea.focus();
      const newPos = start + cursorOffset;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      insertMarkdown('  ', '');
      return;
    }
    
    // Ctrl/Cmd + B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      insertMarkdown('**', '**');
      return;
    }
    
    // Ctrl/Cmd + I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      insertMarkdown('*', '*');
      return;
    }
    
    // Ctrl/Cmd + K for link
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      insertMarkdown('[', '](url)');
      return;
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 p-2 rounded-t-xl border-b-0"
        style={{
          background: 'var(--secondary)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'rgba(var(--border-rgb), 0.12)',
          borderBottomWidth: '0'
        }}
      >
        <button
          type="button"
          onClick={() => insertMarkdown('**', '**')}
          className="p-2 rounded hover:bg-white/50 transition-all"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
        </button>
        <button
          type="button"
          onClick={() => insertMarkdown('*', '*')}
          className="p-2 rounded hover:bg-white/50 transition-all"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
        </button>
        <button
          type="button"
          onClick={() => insertMarkdown('[', '](url)')}
          className="p-2 rounded hover:bg-white/50 transition-all"
          title="Link (Ctrl+K)"
        >
          <LinkIcon className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
        </button>
        <button
          type="button"
          onClick={insertHeading}
          className="p-2 rounded hover:bg-white/50 transition-all"
          title="Toggle Heading"
        >
          <Hash className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
        </button>
        
        <div className="flex-1" />
        <span className="text-[10px] font-semibold px-2" style={{ color: 'var(--text-subtle)', letterSpacing: '0.05em' }}>
          MARKDOWN
        </span>
      </div>

      {/* Split View: Editor + Live Preview */}
      <div className="flex flex-col lg:flex-row" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(var(--border-rgb), 0.12)', borderTop: '0', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
        {/* Editor */}
        <div className="flex-1 lg:border-r" style={{ borderRight: '1px solid rgba(var(--border-rgb), 0.12)' }}>
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full p-4 outline-none resize-none"
            style={{
              background: '#fff',
              color: 'var(--foreground)',
              fontSize: '13px',
              lineHeight: '1.7',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              minHeight: '200px',
              height: '300px',
              border: 'none'
            }}
            placeholder={placeholder || 'Type markdown here...\n\n## Heading\n**bold** *italic* [link](url)'}
            spellCheck={false}
          />
        </div>

        {/* Live Preview */}
        <div className="flex-1 lg:block">
          <div className="p-2 text-xs font-semibold lg:hidden" style={{ background: 'var(--secondary)', color: 'var(--text-subtle)', borderTop: '1px solid rgba(var(--border-rgb), 0.12)' }}>
            PREVIEW
          </div>
          <div
            className="markdown-preview p-4"
            style={{
              background: 'var(--secondary)',
              fontSize: '14px',
              lineHeight: '1.7',
              minHeight: '150px',
              height: '300px',
              overflowY: 'auto'
            }}
          >
            {localValue ? (
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(localValue) }} />
            ) : (
              <p style={{ color: 'var(--text-subtle)', fontSize: '13px' }}>Preview appears here...</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .markdown-preview .markdown-h2 {
          font-size: 20px;
          font-weight: 700;
          color: #20180f;
          margin: 0 0 12px 0;
          line-height: 1.3;
        }

        .markdown-preview .markdown-h2:not(:first-child) {
          margin-top: 24px;
        }
        
        .markdown-preview .markdown-h3 {
          font-size: 17px;
          font-weight: 700;
          color: #20180f;
          margin: 0 0 10px 0;
          line-height: 1.3;
        }

        .markdown-preview .markdown-h3:not(:first-child) {
          margin-top: 20px;
        }
        
        .markdown-preview .markdown-p {
          color: #20180f;
          line-height: 1.7;
          margin: 0 0 12px 0;
        }

        .markdown-preview .markdown-p:last-child {
          margin-bottom: 0;
        }
        
        .markdown-preview .markdown-bold {
          font-weight: 700 !important;
        }
        
        .markdown-preview .markdown-italic {
          font-style: italic !important;
        }
        
        .markdown-preview em {
          font-style: italic !important;
        }
        
        .markdown-preview strong {
          font-weight: 700 !important;
        }
        
        .markdown-preview .markdown-link {
          color: #c4522a;
          text-decoration: underline;
          cursor: pointer;
        }
        
        .markdown-preview .markdown-link:hover {
          color: #a03d1e;
        }
      `}</style>
    </div>
  );
}