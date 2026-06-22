import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";

type Props = { userId: string };

const EMPTY_DOC = { type: "doc", content: [] };


export function StrategyEditor({ userId }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: EMPTY_DOC,
    editorProps: {
      attributes: {
        class:
          "prose-strategy min-h-[400px] focus:outline-none text-foreground leading-relaxed",
      },
    },
    onUpdate({ editor }) {
      if (!loaded) return;
      setStatus("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const content = editor.getJSON();
        const { error } = await supabase
          .from("strategy_documents")
          .upsert(
            { user_id: userId, content },
            { onConflict: "user_id" },
          );
        if (!error) setStatus("saved");
      }, 600);
    },
  });

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("strategy_documents")
        .select("content")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancel || !editor) return;
      if (data?.content) {
        editor.commands.setContent(data.content as object);
      }
      setLoaded(true);
    })();
    return () => {
      cancel = true;
    };
  }, [editor, userId]);

  if (!editor) return null;

  const Btn = ({
    active,
    onClick,
    children,
    label,
  }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    label: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground/70 hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-popover">
        <Btn
          label="Titre 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </Btn>
        <Btn
          label="Titre 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn
          label="Gras"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn
          label="Italique"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn
          label="Liste à puces"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Btn>
        <Btn
          label="Liste numérotée"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <Btn
          label="Citation"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Btn>

        <div className="ml-auto text-xs opacity-60">
          {status === "saving" && "Enregistrement…"}
          {status === "saved" && <em>Enregistré</em>}
        </div>
      </div>

      <div className="px-8 py-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
