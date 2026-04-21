"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { type RichTextRenderOptions, renderDescriptionHtml, isHtmlContent } from "@/lib/rich-text";

type UserLocale = "en" | "fr";

export type { RichTextRenderOptions };

export type RichTextEditorProps = {
  locale: UserLocale;
  value: string;
  disabled: boolean;
  onChange: (nextValue: string) => void;
  allowTextColor?: boolean;
  renderOptions?: RichTextRenderOptions;
  contentClassName?: string;
};

export function RichTextContent({ value, className }: { value: string; className: string }) {
  const html = renderDescriptionHtml(value);
  if (!html) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function TiptapToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors duration-150 ${
        isActive
          ? "bg-accent/10 text-accent"
          : "text-muted hover:bg-surface-soft hover:text-foreground"
      } disabled:cursor-not-allowed disabled:opacity-40`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function TiptapToolbar({
  editor,
  disabled,
  locale,
  allowTextColor,
}: {
  editor: Editor | null;
  disabled: boolean;
  locale: UserLocale;
  allowTextColor: boolean;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const isFrench = locale === "fr";

  function addLink() {
    const previousUrl = editor?.getAttributes("link").href ?? "";
    const url = window.prompt(isFrench ? "Entrez une URL" : "Enter a URL", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    editor?.chain().focus().extendMarkRange("link").setLink({ href: normalizedUrl }).run();
  }

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) editor?.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} disabled={disabled} title={isFrench ? "Gras" : "Bold"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M4 2h5a3 3 0 011.5 5.6A3.5 3.5 0 019.5 14H4V2zm2 5h3a1 1 0 100-2H6v2zm0 2v3h3.5a1.5 1.5 0 000-3H6z"/></svg>
      </TiptapToolbarButton>
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} disabled={disabled} title={isFrench ? "Italique" : "Italic"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M6 2h6v2h-2.2l-2.6 8H9v2H3v-2h2.2l2.6-8H6V2z"/></svg>
      </TiptapToolbarButton>
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} disabled={disabled} title={isFrench ? "Souligne" : "Underline"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M4 2v5a4 4 0 008 0V2h-2v5a2 2 0 01-4 0V2H4zM3 14h10v1.5H3V14z"/></svg>
      </TiptapToolbarButton>
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} disabled={disabled} title={isFrench ? "Barre" : "Strikethrough"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M2 7.5h12v1H2zM5.5 3C4.1 3 3 3.9 3 5.1c0 .7.3 1.2.8 1.6h2.3c-.5-.3-.8-.7-.8-1.1 0-.6.6-1 1.3-1h2.8c.7 0 1.3.4 1.3 1h2.1c0-1.3-1.3-2.4-3-2.5H5.5zM10.5 9.5H8.2c.5.3.8.7.8 1.1 0 .6-.6 1-1.3 1H5c-.7 0-1.3-.4-1.3-1H1.8c0 1.3 1.3 2.4 3 2.5h5.7c1.4 0 2.5-.9 2.5-2.1 0-.6-.3-1.1-.8-1.5H10.5z"/></svg>
      </TiptapToolbarButton>
      <div className="mx-1 h-4 w-px bg-line" />
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive("highlight")} disabled={disabled} title={isFrench ? "Surligner" : "Highlight"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M2 12h12v2H2zM9.4 2.3l4.3 4.3-6.4 6.4H3v-4.3l6.4-6.4zm0 2.1L4.5 9.3v1.2h1.2L10.6 5.6 9.4 4.4z"/></svg>
      </TiptapToolbarButton>
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} disabled={disabled} title={isFrench ? "Code en ligne" : "Inline code"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-10.5 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </TiptapToolbarButton>
      <div className="mx-1 h-4 w-px bg-line" />
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} disabled={disabled} title={isFrench ? "Liste a puces" : "Bullet list"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><circle cx="3" cy="4" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="3" cy="12" r="1.2"/><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg>
      </TiptapToolbarButton>
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} disabled={disabled} title={isFrench ? "Liste numerotee" : "Numbered list"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><text x="1" y="5.5" fontSize="4" fontWeight="bold">1</text><text x="1" y="9.5" fontSize="4" fontWeight="bold">2</text><text x="1" y="13.5" fontSize="4" fontWeight="bold">3</text><rect x="6" y="3" width="8" height="2" rx="0.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg>
      </TiptapToolbarButton>
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive("taskList")} disabled={disabled} title={isFrench ? "Liste de taches" : "Task list"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="2" width="4" height="4" rx="0.8"/><path d="M2.8 4l.8.8L5.2 3" strokeLinecap="round" strokeLinejoin="round"/><rect x="1.5" y="10" width="4" height="4" rx="0.8"/><line x1="8" y1="4" x2="14.5" y2="4" strokeLinecap="round"/><line x1="8" y1="12" x2="14.5" y2="12" strokeLinecap="round"/></svg>
      </TiptapToolbarButton>
      <div className="mx-1 h-4 w-px bg-line" />
      <TiptapToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} disabled={disabled} title={isFrench ? "Citation" : "Quote"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M3 3h4v4.5c0 2.5-1.5 4-3.5 4.5l-.5-1.5c1.2-.3 2-1.2 2-2.5H3V3zm6 0h4v4.5c0 2.5-1.5 4-3.5 4.5l-.5-1.5c1.2-.3 2-1.2 2-2.5H9V3z"/></svg>
      </TiptapToolbarButton>
      <TiptapToolbarButton onClick={addLink} isActive={editor.isActive("link")} disabled={disabled} title={isFrench ? "Lien" : "Link"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6.5 9.5a3 3 0 004.2.3l2-2a3 3 0 00-4.2-4.3l-1.2 1.1" strokeLinecap="round"/><path d="M9.5 6.5a3 3 0 00-4.2-.3l-2 2a3 3 0 004.2 4.3l1.1-1.1" strokeLinecap="round"/></svg>
      </TiptapToolbarButton>
      <div className="mx-1 h-4 w-px bg-line" />
      <TiptapToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={disabled} title={isFrench ? "Separateur" : "Horizontal rule"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="8" x2="14" y2="8" strokeLinecap="round"/></svg>
      </TiptapToolbarButton>
      {allowTextColor ? (
        <>
          <div className="mx-1 h-4 w-px bg-line" />
          <TiptapToolbarButton onClick={() => colorInputRef.current?.click()} disabled={disabled} title={isFrench ? "Couleur du texte" : "Text color"}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M8 1.5L3 13h2l1-2.5h4L11 13h2L8 1.5zm0 3l1.5 4h-3L8 4.5z"/>
              <rect x="3" y="14" width="10" height="1.5" fill={editor.getAttributes("textStyle").color ?? "currentColor"}/>
            </svg>
          </TiptapToolbarButton>
          <input ref={colorInputRef} type="color" className="sr-only" defaultValue="#000000" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
        </>
      ) : null}
      <TiptapToolbarButton onClick={() => imageInputRef.current?.click()} disabled={disabled} title={isFrench ? "Image" : "Image"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="2.5" width="13" height="11" rx="1.2"/><circle cx="5.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><path d="M1.5 11l3.5-3.5 3 3 2-2 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </TiptapToolbarButton>
      <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageFile(file); e.target.value = ""; }} />
      <TiptapToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={disabled} title={isFrench ? "Inserer un tableau" : "Insert table"}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="13" height="13" rx="1"/><line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="1.5" y1="9.5" x2="14.5" y2="9.5"/><line x1="5.5" y1="5.5" x2="5.5" y2="14.5"/><line x1="10.5" y1="5.5" x2="10.5" y2="14.5"/></svg>
      </TiptapToolbarButton>
      {editor.isActive("table") && (
        <>
          <div className="mx-1 h-4 w-px bg-line" />
          <TiptapToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} disabled={disabled} title={isFrench ? "Ajouter une ligne" : "Add row"}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="13" height="7" rx="1"/><line x1="1.5" y1="5" x2="14.5" y2="5"/><line x1="8" y1="11" x2="8" y2="15"/><line x1="6" y1="13" x2="10" y2="13"/></svg>
          </TiptapToolbarButton>
          <TiptapToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={disabled} title={isFrench ? "Ajouter une colonne" : "Add column"}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="7" height="13" rx="1"/><line x1="5" y1="1.5" x2="5" y2="14.5"/><line x1="11" y1="6" x2="15" y2="6"/><line x1="13" y1="4" x2="13" y2="8"/></svg>
          </TiptapToolbarButton>
          <TiptapToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} disabled={disabled} title={isFrench ? "Supprimer la ligne" : "Delete row"}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="13" height="7" rx="1"/><line x1="1.5" y1="5" x2="14.5" y2="5"/><line x1="6" y1="13" x2="10" y2="13"/></svg>
          </TiptapToolbarButton>
          <TiptapToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} disabled={disabled} title={isFrench ? "Supprimer la colonne" : "Delete column"}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="7" height="13" rx="1"/><line x1="5" y1="1.5" x2="5" y2="14.5"/><line x1="6" y1="13" x2="10" y2="13"/></svg>
          </TiptapToolbarButton>
          <TiptapToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} disabled={disabled} title={isFrench ? "Supprimer le tableau" : "Delete table"}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="1.5" width="13" height="13" rx="1"/><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
          </TiptapToolbarButton>
        </>
      )}
    </div>
  );
}

function convertMarkdownToHtml(markdown: string, options: RichTextRenderOptions = {}): string {
  if (!markdown.trim()) return "";
  if (isHtmlContent(markdown) && options.preserveTextColor === undefined && options.recoverPlainText === undefined) {
    return markdown;
  }
  return renderDescriptionHtml(markdown, options);
}

export function RichTextEditor({
  locale,
  value,
  disabled,
  onChange,
  allowTextColor = true,
  renderOptions,
  contentClassName,
}: RichTextEditorProps) {
  const isFrench = locale === "fr";
  const lastExternalValueRef = useRef(value);
  const editorRef = useRef<Editor | null>(null);

  function insertImageFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) editorRef.current?.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Placeholder.configure({ placeholder: isFrench ? "Commencez a ecrire..." : "Start writing..." }),
      Underline,
      Link.configure({ openOnClick: false }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: convertMarkdownToHtml(value, renderOptions),
    editable: !disabled,
    onUpdate: ({ editor: updatedEditor }) => {
      const html = updatedEditor.getHTML();
      const isEmpty = updatedEditor.isEmpty;
      const nextValue = isEmpty ? "" : html;
      lastExternalValueRef.current = nextValue;
      onChange(nextValue);
    },
    editorProps: {
      attributes: {
        class: "rich-text-render rich-text-editor min-h-[100px] px-3 py-2.5 text-sm leading-6 text-foreground outline-none focus:outline-none",
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (!imageFiles.length) return false;
        event.preventDefault();
        imageFiles.forEach(insertImageFromFile);
        return true;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItems = Array.from(items).filter((item) => item.type.startsWith("image/"));
        if (!imageItems.length) return false;
        imageItems.forEach((item) => {
          const file = item.getAsFile();
          if (file) insertImageFromFile(file);
        });
        return imageItems.length > 0;
      },
    },
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);
  useEffect(() => { if (!editor) return; editor.setEditable(!disabled); }, [editor, disabled]);
  useEffect(() => {
    if (!editor) return;
    if (value === lastExternalValueRef.current) return;
    lastExternalValueRef.current = value;
    const htmlContent = convertMarkdownToHtml(value, renderOptions);
    editor.commands.setContent(htmlContent, { emitUpdate: false });
  }, [editor, renderOptions, value]);

  return (
    <div className={`mt-1 overflow-x-hidden rounded-lg border border-line bg-surface transition-all duration-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 ${disabled ? "opacity-50" : ""}`}>
      <TiptapToolbar editor={editor} disabled={disabled} locale={locale} allowTextColor={allowTextColor} />
      <div className={contentClassName ?? ""}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
