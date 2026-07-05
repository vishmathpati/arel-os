"use client";

import * as React from "react";

import type { TComboboxInputElement, TMentionElement } from "platejs";
import type { PlateEditor, PlateElementProps } from "platejs/react";

import { getMentionOnSelectItem } from "@platejs/mention";
import { PlateElement, useFocused, useReadOnly, useSelected } from "platejs/react";

import { useWikilink } from "@/shared/components/editor/wikilink-store";
import { cn } from "@/shared/lib/utils";

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./inline-combobox";

/**
 * A `[[page]]` wikilink (Chapter 7). The mention node's `key` IS the page slug;
 * the display title is resolved live from the wikilink context (so a renamed
 * page updates everywhere). Clicking navigates to the page.
 */
export function MentionElement(props: PlateElementProps<TMentionElement>) {
  const { element } = props;
  const selected = useSelected();
  const focused = useFocused();
  const readOnly = useReadOnly();
  const { resolveTitle, open } = useWikilink();

  const slug = String(element.key ?? element.value ?? "");
  const title = resolveTitle(slug) ?? String(element.value ?? slug);

  return (
    <PlateElement
      {...props}
      className={cn(
        "align-baseline font-medium text-primary underline decoration-primary/30 underline-offset-2",
        !readOnly && "cursor-pointer hover:decoration-primary",
        selected && focused && "rounded-sm ring-2 ring-ring",
      )}
      attributes={{
        ...props.attributes,
        contentEditable: false,
        "data-slate-value": element.value,
        onClick: () => {
          if (slug) open(slug);
        },
      }}
    >
      {title}
      {props.children}
    </PlateElement>
  );
}

const onSelectItem = getMentionOnSelectItem();

/**
 * Remove the stray leading `[` left in front of the mention input. The wikilink
 * trigger fires on the second `[`, so the first one was already inserted as
 * text (see `mention-kit`). Cleaned here, just before the mention is inserted.
 */
function removeStrayBracket(editor: PlateEditor, element: TComboboxInputElement) {
  const path = editor.api.findPath(element);
  if (!path) return;
  const before = editor.api.before(path);
  if (!before) return;
  const beforeChar = editor.api.before(before, { unit: "character" });
  if (!beforeChar) return;
  const range = { anchor: beforeChar, focus: before };
  if (editor.api.string(range) === "[") {
    editor.tf.delete({ at: range });
  }
}

export function MentionInputElement(props: PlateElementProps<TComboboxInputElement>) {
  const { editor, element } = props;
  const [search, setSearch] = React.useState("");
  const { pages } = useWikilink();

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        value={search}
        element={element}
        setValue={setSearch}
        showTrigger={false}
        trigger="["
      >
        <span className="rounded-sm bg-muted px-0.5 align-baseline text-primary ring-ring focus-within:ring-2">
          <InlineComboboxInput />
        </span>

        <InlineComboboxContent className="my-1.5">
          <InlineComboboxEmpty>No pages found</InlineComboboxEmpty>

          <InlineComboboxGroup>
            {pages.map((page) => (
              <InlineComboboxItem
                key={page.slug}
                value={page.title}
                keywords={[page.slug]}
                onClick={() => {
                  removeStrayBracket(editor, element);
                  onSelectItem(editor, { key: page.slug, text: page.title }, search);
                }}
              >
                {page.title}
              </InlineComboboxItem>
            ))}
          </InlineComboboxGroup>
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
