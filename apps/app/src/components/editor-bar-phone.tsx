import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { useEditorState } from "@blocknote/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  ArrowDown02Icon,
  ArrowLeft01Icon,
  ArrowUp02Icon,
  CheckListIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  KeyboardIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  ParagraphIcon,
  QuoteDownIcon,
  Redo02Icon,
  SourceCodeIcon,
  TextBoldIcon,
  TextIndentLessIcon,
  TextIndentMoreIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";

import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useActiveEditor } from "@/lib/editor-ref";
import { Button } from "@rune/ui/components/button";
import { useIsMobile } from "@rune/ui/hooks/use-mobile";
import { cn } from "@rune/ui/lib/utils";

/**
 * The phone editor's one control surface: a capsule on the keyboard, the
 * same family as the search field. Two rows, Notion's mechanics: with a
 * caret it does block work, with text selected it does inline styles.
 * Aa drops the keyboard and puts a block picker in its rectangle.
 * Nothing ever appears at the pointer; iOS keeps its own selection callout.
 */

const BAR_H = 48;
const LANE = 12;
const PICKER_FALLBACK = 300;

type StyleKey = "bold" | "italic" | "underline" | "strike" | "code";

const STYLE_ROW: { key: StyleKey; icon: IconSvgElement; label: string }[] = [
  { key: "bold", icon: TextBoldIcon, label: "Bold" },
  { key: "italic", icon: TextItalicIcon, label: "Italic" },
  { key: "underline", icon: TextUnderlineIcon, label: "Underline" },
  { key: "strike", icon: TextStrikethroughIcon, label: "Strikethrough" },
  { key: "code", icon: SourceCodeIcon, label: "Code" },
];

type BlockChoice = {
  label: string;
  icon: IconSvgElement;
  type: string;
  props?: Record<string, number>;
};

const BLOCKS: BlockChoice[] = [
  { label: "Text", icon: ParagraphIcon, type: "paragraph" },
  { label: "Heading 1", icon: Heading01Icon, type: "heading", props: { level: 1 } },
  { label: "Heading 2", icon: Heading02Icon, type: "heading", props: { level: 2 } },
  { label: "Heading 3", icon: Heading03Icon, type: "heading", props: { level: 3 } },
  { label: "Bulleted list", icon: LeftToRightListBulletIcon, type: "bulletListItem" },
  { label: "Numbered list", icon: LeftToRightListNumberIcon, type: "numberedListItem" },
  { label: "Checklist", icon: CheckListIcon, type: "checkListItem" },
  { label: "Quote", icon: QuoteDownIcon, type: "quote" },
  { label: "Code", icon: SourceCodeIcon, type: "codeBlock" },
];

function isChosen(block: { type: string; props: unknown }, choice: BlockChoice): boolean {
  if (block.type !== choice.type) return false;
  if (!choice.props) return true;
  const props = block.props as Record<string, unknown>;
  return Object.entries(choice.props).every(([key, value]) => props[key] === value);
}

/** True while the caret lives inside the BlockNote editor. */
function useEditorFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const read = () => setFocused(document.activeElement?.closest(".bn-editor") !== null);
    read();
    document.addEventListener("focusin", read);
    document.addEventListener("focusout", read);
    return () => {
      document.removeEventListener("focusin", read);
      document.removeEventListener("focusout", read);
    };
  }, []);
  return focused;
}

function BarButton({
  label,
  icon,
  active = false,
  disabled = false,
  onClick,
  className,
}: {
  label: string;
  icon: IconSvgElement;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the caret in the editor: a focus change would drop the keyboard.
      onPointerDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn("shrink-0 rounded-full [&_svg]:size-5!", active && "bg-accent", className)}
    >
      <HugeiconsIcon icon={icon} strokeWidth={1.75} />
    </Button>
  );
}

function Capsule({ top, children }: { top: number | string; children: ReactNode }) {
  return (
    <div className="fixed inset-x-4 z-50" style={{ top }}>
      <div className="flex h-12 items-center gap-0.5 rounded-full border bg-card px-1.5 shadow-lg">
        {children}
      </div>
    </div>
  );
}

function BlockPicker({
  editor,
  height,
  onPick,
}: {
  editor: BlockNoteEditor;
  height: number;
  onPick: () => void;
}) {
  const current = useEditorState({
    editor,
    selector: ({ editor: ed }) => (ed ? ed.getTextCursorPosition().block : null),
    equalityFn: (a, b) => a?.id === b?.id && a?.type === b?.type,
  });
  const pick = (choice: BlockChoice) => {
    const block = editor.getTextCursorPosition().block;
    editor.updateBlock(block, { type: choice.type, props: choice.props } as Parameters<
      typeof editor.updateBlock
    >[1]);
    onPick();
    // Inside the tap, so iOS brings the keyboard back.
    editor.focus();
  };
  return (
    <div
      className="fixed inset-x-0 z-50 grid grid-cols-2 content-start gap-2 bg-muted p-3"
      style={{ top: `calc(var(--app-h) - ${height}px)`, height }}
    >
      {BLOCKS.map((choice) => {
        const chosen = current !== null && isChosen(current, choice);
        return (
          <Button
            key={choice.label}
            variant="outline"
            size="lg"
            aria-pressed={chosen}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => pick(choice)}
            className={cn(
              "h-11 justify-start gap-3 rounded-xl bg-card px-3 text-base font-normal",
              chosen && "border-foreground",
            )}
          >
            <HugeiconsIcon
              icon={choice.icon}
              strokeWidth={1.75}
              className="size-5! text-muted-foreground"
            />
            {choice.label}
          </Button>
        );
      })}
    </div>
  );
}

function Bar({
  editor,
  keyboard,
  dock,
}: {
  editor: BlockNoteEditor;
  keyboard: number;
  /** A dock occupies the bottom lane (phone widths); stack above it. */
  dock: boolean;
}) {
  const focused = useEditorFocused();
  const [picker, setPicker] = useState(false);
  const [pickerHeight, setPickerHeight] = useState(PICKER_FALLBACK);
  const [blockRow, setBlockRow] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            selected: ed.getSelection() !== undefined,
            styles: ed.getActiveStyles() as Partial<Record<StyleKey, boolean>>,
            canNest: ed.canNestBlock(),
            canUnnest: ed.canUnnestBlock(),
          }
        : null,
  });

  // « returns to block work while text stays selected; a collapsed caret resets it.
  useEffect(() => {
    if (!state?.selected) setBlockRow(false);
  }, [state?.selected]);

  // The keyboard rising means the user tapped back into the editor: close the
  // picker. Dismissal animates through smaller sizes, so "present" is not
  // enough; only a rise counts. The last rising size is the keyboard's true
  // height, which the picker borrows.
  const previousKeyboard = useRef(0);
  useEffect(() => {
    const rising = keyboard > previousKeyboard.current;
    previousKeyboard.current = keyboard;
    if (!rising) return;
    setPickerHeight(keyboard);
    setPicker(false);
  }, [keyboard]);

  // No software keyboard while focused = hardware keyboard (iPad + Magic
  // Keyboard): the bar still has to exist somewhere, so it docks at the
  // bottom lane. Web cannot use the iPadOS shortcuts row natives get.
  const hardware = focused && keyboard === 0 && !picker;
  const visible = (keyboard > 0 && focused) || picker || hardware;
  if (!visible || state === null) return null;

  const viewport = window.visualViewport;
  const lane = dock ? `var(--dock-inset) + var(--dock-h) + ${LANE}px` : "var(--dock-inset)";
  const top = picker
    ? `calc(var(--app-h) - ${pickerHeight}px - ${BAR_H + LANE}px)`
    : keyboard > 0 && viewport
      ? Math.round(viewport.offsetTop + viewport.height) - BAR_H - LANE
      : `calc(var(--app-h) - ${BAR_H}px - (${lane}))`;

  const openPicker = () => {
    editor.blur();
    setPicker(true);
  };
  const closePicker = () => {
    setPicker(false);
    editor.focus();
  };
  const dismiss = () => {
    if (picker) {
      closePicker();
      return;
    }
    editor.blur();
  };

  const styleRow = state.selected && !blockRow;

  return (
    <>
      <Capsule top={top}>
        {styleRow ? (
          <>
            <BarButton
              label="Block actions"
              icon={ArrowLeft01Icon}
              onClick={() => setBlockRow(true)}
            />
            {STYLE_ROW.map((style) => (
              <BarButton
                key={style.key}
                label={style.label}
                icon={style.icon}
                active={state.styles[style.key] === true}
                onClick={() => editor.toggleStyles({ [style.key]: true })}
              />
            ))}
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Block type"
              aria-pressed={picker}
              onPointerDown={(event) => event.preventDefault()}
              onClick={picker ? closePicker : openPicker}
              className={cn("shrink-0 rounded-full text-base font-medium", picker && "bg-accent")}
            >
              Aa
            </Button>
            <BarButton
              label="Outdent"
              icon={TextIndentLessIcon}
              disabled={!state.canUnnest}
              onClick={() => editor.unnestBlock()}
            />
            <BarButton
              label="Indent"
              icon={TextIndentMoreIcon}
              disabled={!state.canNest}
              onClick={() => editor.nestBlock()}
            />
            <BarButton label="Move up" icon={ArrowUp02Icon} onClick={() => editor.moveBlocksUp()} />
            <BarButton
              label="Move down"
              icon={ArrowDown02Icon}
              onClick={() => editor.moveBlocksDown()}
            />
            <BarButton label="Undo" icon={Undo02Icon} onClick={() => editor.undo()} />
            <BarButton label="Redo" icon={Redo02Icon} onClick={() => editor.redo()} />
          </>
        )}
        <BarButton
          label={picker ? "Show keyboard" : "Hide keyboard"}
          icon={KeyboardIcon}
          onClick={dismiss}
          className="ml-auto text-muted-foreground"
        />
      </Capsule>
      {picker && <BlockPicker editor={editor} height={pickerHeight} onPick={closePicker} />}
    </>
  );
}

export function EditorBarPhone() {
  const editor = useActiveEditor();
  const keyboard = useKeyboardInset();
  const dock = useIsMobile();
  if (!editor) return null;
  return <Bar editor={editor} keyboard={keyboard} dock={dock} />;
}
