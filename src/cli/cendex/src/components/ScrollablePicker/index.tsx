import type { ScrollBoxRenderable, TextareaRenderable } from "@opentui/core";
import { useBindings } from "@opentui/keymap/react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Command } from "./types.ts";
import { useDialog } from "../../providers/DialogProvider";
import { useToast } from "../../providers/ToastProvider";

interface MenuProps {
	commandArray: Command[];
	searchPlaceHolder?: string;
}

const Menu = ({
	commandArray,
	searchPlaceHolder = "Search commands...",
}: MenuProps) => {
	const textareaInputRef = useRef<TextareaRenderable | null>(null);
	const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null);

	const [scrollBoxIndex, setScrollBoxIndex] = useState<number>(0);
	const [query, setQuery] = useState<string>("");

	const toast = useToast();
	const dialog = useDialog();

	const filteredCommands = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return commandArray;
		return commandArray.filter((cmd) => cmd.title.toLowerCase().startsWith(q));
	}, [commandArray, query]);

	const MAX_VISIBLE_ITEMS = Math.min(filteredCommands.length, 5);

	const maxValueWidth = useMemo(() => {
		if (filteredCommands.length === 0) return 0;
		return Math.max(...filteredCommands.map((cmd) => cmd.value.length));
	}, [filteredCommands]);

	useEffect(() => {
		setScrollBoxIndex((prev) =>
			Math.min(prev, Math.max(filteredCommands.length - 1, 0)),
		);
	}, [filteredCommands.length]);

	useEffect(() => {
		textareaInputRef.current?.focus();
	}, []);

	const clearInputBar = () => {
		textareaInputRef.current?.setText("");
		setQuery("");
	};

	useBindings(
		() => ({
			priority: 3,
			enabled: true,
			commands: [
				{
					name: "move_up",
					run: () => {
						if (filteredCommands.length === 0) return;
						const sb = scrollBoxRef.current;
						const newIndex = Math.max(scrollBoxIndex - 1, 0);

						setScrollBoxIndex(newIndex);
						if (sb && newIndex < sb.scrollTop) {
							sb.scrollTo(newIndex);
						}
					},
				},
				{
					name: "move_down",
					run: () => {
						if (filteredCommands.length === 0) return;
						const sb = scrollBoxRef.current;
						const newIndex = Math.min(
							scrollBoxIndex + 1,
							filteredCommands.length - 1,
						);

						setScrollBoxIndex(newIndex);
						if (sb) {
							const visibleEnd = sb.scrollTop + sb.viewport.height - 1;
							if (newIndex > visibleEnd) {
								sb.scrollTo(newIndex - sb.viewport.height + 1);
							}
						}
					},
				},
				{
					name: "execute_command",
					run: () => {
						const selected = filteredCommands[scrollBoxIndex];
						if (selected?.action) {
							selected.action({
								toast,
								dialog,
								clearInputBar,
							});
						}
					},
				},
			],
			bindings: [
				{ key: "up", cmd: "move_up" },
				{ key: "down", cmd: "move_down" },
				{ key: "return", cmd: "execute_command" },
			],
		}),
		[scrollBoxIndex, filteredCommands, dialog?.currentDialog, toast],
	);

	return (
		<box width="100%" paddingY={1}>
			<textarea
				ref={textareaInputRef}
				placeholder={searchPlaceHolder}
				padding={1}
				onChange={(val: string) => setQuery(val)}
			/>
			<scrollbox
				width="100%"
				height={MAX_VISIBLE_ITEMS}
				ref={scrollBoxRef}
				flexDirection="column"
				alignItems="center"
			>
				{filteredCommands.map((cmd, indx) => (
					<box
						key={cmd.value}
						flexDirection="row"
						alignItems="center"
						backgroundColor={indx === scrollBoxIndex ? "gray" : "transparent"}
					>
						<text
							fg="#fff"
							marginRight={2}
							width={maxValueWidth}
							marginY="auto"
						>
							{cmd.value}
						</text>
					</box>
				))}
				{filteredCommands.length === 0 && (
					<box justifyContent="center" alignItems="center">
						<box paddingY={1}>
							<spinner name="dots" color="#fff" />
						</box>
					</box>
				)}
			</scrollbox>
		</box>
	);
};

export default Menu;
