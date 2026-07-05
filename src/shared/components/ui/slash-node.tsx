"use client";

import type * as React from "react";

import type { PlateEditor, PlateElementProps } from "platejs/react";

import {
  CalendarIcon,
  ChevronRightIcon,
  Code2,
  Columns3Icon,
  FileText,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  LightbulbIcon,
  ListIcon,
  ListOrdered,
  MinusIcon,
  PilcrowIcon,
  Quote,
  RadicalIcon,
  Square,
  Table as TableIcon,
  TableOfContentsIcon,
} from "lucide-react";
import { KEYS, type TComboboxInputElement } from "platejs";
import { PlateElement } from "platejs/react";

import type { PageEditorMeta } from "@/shared/components/editor/page-editor-meta";
import { insertBlock, insertInlineElement } from "@/shared/components/editor/transforms";

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./inline-combobox";

type Group = {
  group: string;
  items: {
    icon: React.ReactNode;
    value: string;
    onSelect: (editor: PlateEditor, value: string) => void;
    className?: string;
    focusEditor?: boolean;
    keywords?: string[];
    label?: string;
  }[];
};

const groups: Group[] = [
  {
    group: "Basic blocks",
    items: [
      {
        icon: <PilcrowIcon />,
        keywords: ["paragraph"],
        label: "Text",
        value: KEYS.p,
      },
      {
        icon: <Heading1Icon />,
        keywords: ["title", "h1"],
        label: "Heading 1",
        value: KEYS.h1,
      },
      {
        icon: <Heading2Icon />,
        keywords: ["subtitle", "h2"],
        label: "Heading 2",
        value: KEYS.h2,
      },
      {
        icon: <Heading3Icon />,
        keywords: ["subtitle", "h3"],
        label: "Heading 3",
        value: KEYS.h3,
      },
      {
        icon: <ListIcon />,
        keywords: ["unordered", "ul", "-"],
        label: "Bulleted list",
        value: KEYS.ul,
      },
      {
        icon: <ListOrdered />,
        keywords: ["ordered", "ol", "1"],
        label: "Numbered list",
        value: KEYS.ol,
      },
      {
        icon: <Square />,
        keywords: ["checklist", "task", "checkbox", "[]"],
        label: "To-do list",
        value: KEYS.listTodo,
      },
      {
        icon: <Code2 />,
        keywords: ["```"],
        label: "Code Block",
        value: KEYS.codeBlock,
      },
      {
        icon: <Quote />,
        keywords: ["citation", "blockquote", "quote", ">"],
        label: "Blockquote",
        value: KEYS.blockquote,
      },
      {
        icon: <MinusIcon />,
        keywords: ["divider", "horizontal rule", "hr", "---"],
        label: "Divider",
        value: KEYS.hr,
      },
      {
        icon: <TableIcon />,
        keywords: ["grid"],
        label: "Table",
        value: KEYS.table,
      },
      {
        icon: <LightbulbIcon />,
        keywords: ["note", "info", "warning"],
        label: "Callout",
        value: KEYS.callout,
      },
      {
        icon: <ChevronRightIcon />,
        keywords: ["collapsible", "expandable", "accordion"],
        label: "Toggle",
        value: KEYS.toggle,
      },
      {
        icon: <ImageIcon />,
        keywords: ["picture", "media", "img"],
        label: "Image",
        value: KEYS.img,
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value, { upsert: true });
      },
    })),
  },
  {
    group: "Advanced blocks",
    items: [
      {
        icon: <TableOfContentsIcon />,
        keywords: ["toc"],
        label: "Table of contents",
        value: KEYS.toc,
      },
      {
        icon: <Columns3Icon />,
        keywords: ["columns"],
        label: "3 columns",
        value: "action_three_columns",
      },
      {
        icon: <RadicalIcon />,
        keywords: ["math", "latex"],
        label: "Equation",
        value: KEYS.equation,
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value, { upsert: true });
      },
    })),
  },
  {
    group: "Inline",
    items: [
      {
        focusEditor: true,
        icon: <CalendarIcon />,
        keywords: ["time"],
        label: "Date",
        value: KEYS.date,
      },
      {
        focusEditor: false,
        icon: <RadicalIcon />,
        keywords: ["math", "inline equation"],
        label: "Inline Equation",
        value: KEYS.inlineEquation,
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor, value) => {
        insertInlineElement(editor, value);
      },
    })),
  },
  {
    group: "Page",
    items: [
      {
        icon: <FileText />,
        keywords: ["subpage", "child", "page", "nested"],
        label: "Subpage",
        value: "action_subpage",
        onSelect: async (editor) => {
          const meta = editor.meta as PageEditorMeta;
          if (!meta.createSubpage) return;
          const child = await meta.createSubpage();
          if (!child) return;
          editor.tf.insertNodes(
            {
              type: KEYS.mention,
              key: child.slug,
              value: child.title,
              children: [{ text: "" }],
            },
            { select: true },
          );
          editor.tf.insertText(" ");
          meta.openPage?.(child.slug);
        },
      },
    ],
  },
];

export function SlashInputElement(props: PlateElementProps<TComboboxInputElement>) {
  const { editor, element } = props;

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox element={element} trigger="/">
        <InlineComboboxInput />

        <InlineComboboxContent>
          <InlineComboboxEmpty>No results</InlineComboboxEmpty>

          {groups.map(({ group, items }) => (
            <InlineComboboxGroup key={group}>
              <InlineComboboxGroupLabel>{group}</InlineComboboxGroupLabel>

              {items.map(({ focusEditor, icon, keywords, label, value, onSelect }) => (
                <InlineComboboxItem
                  key={value}
                  value={value}
                  onClick={() => onSelect(editor, value)}
                  label={label}
                  focusEditor={focusEditor}
                  group={group}
                  keywords={keywords}
                >
                  <div className="mr-2 text-muted-foreground">{icon}</div>
                  {label ?? value}
                </InlineComboboxItem>
              ))}
            </InlineComboboxGroup>
          ))}
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
