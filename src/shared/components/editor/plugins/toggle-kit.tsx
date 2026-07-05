"use client";

import { TogglePlugin } from "@platejs/toggle/react";

import { IndentKit } from "@/shared/components/editor/plugins/indent-kit";
import { ToggleElement } from "@/shared/components/ui/toggle-node";

export const ToggleKit = [...IndentKit, TogglePlugin.withComponent(ToggleElement)];
