import { useBindings } from "@opentui/keymap/react";
import Commands, { getFilteredCommands } from "./commands";
import { useEffect, useRef } from "react";
import { ScrollBoxRenderable, TextareaRenderable } from "@opentui/core";
import { useDialog } from "../../providers/DialogProvider";
import { useToast } from "../../providers/ToastProvider";
import { useModels } from "../../providers/ModelProvider";

const MAX_VALUE_WIDTH = Math.max(...Commands.map((cmd) => cmd.value.length));
const MAX_DESCRIPTION_WIDTH =
	Math.max(...Commands.map((cmd) => cmd.description.length)) + 4;

const Menu = ({
	targetCommand,
	scrollBoxIndex,
	setScrollBoxIndex,
	textareaInputRef,
}: {
	targetCommand: string;
	scrollBoxIndex: number;
	setScrollBoxIndex: (index: number) => void;
	textareaInputRef: React.RefObject<TextareaRenderable | null>;
}) => {
	const filteredCommands = getFilteredCommands(targetCommand);
	const scrollBoxRef = useRef<ScrollBoxRenderable>(null);
	const MAX_VISIBLE_ITEMS = Math.min(filteredCommands.length, 14);
	const toast = useToast();
	const dialog = useDialog();
	const { models } = useModels();

	useEffect(() => {
		setScrollBoxIndex((prev: number) =>
			Math.min(prev, Math.max(filteredCommands.length - 1, 0)),
		);
	}, [filteredCommands.length]);

	useBindings(
		() => ({
			priority: 1,
			enabled: dialog?.currentDialog === null,
			commands: [
				{
					name: "move_up",
					run: () => {
						const sb = scrollBoxRef.current;
						const newIndex = Math.max(scrollBoxIndex - 1, 0);
						setScrollBoxIndex(newIndex);
						if (sb && newIndex < sb.scrollTop) {
							sb.scrollTo(newIndex);
						}
					},
				},
				{
					name: "execute_command",
					run: () => {
						const selectedCommand = filteredCommands.filter(
							(cmd) => cmd.title === filteredCommands[scrollBoxIndex]?.title,
						);

						if (selectedCommand?.[0]) {
							selectedCommand[0]?.action({
								toast: toast,
								dialog: dialog,
								clearInputBar: () => {
									textareaInputRef.current?.setText("");
								},
								models: models,
							});
						}
					},
				},
				{
					name: "move_down",
					run: () => {
						const sb = scrollBoxRef.current;
						const newIndex = Math.min(
							scrollBoxIndex + 1,
							filteredCommands.length - 1,
						);
						setScrollBoxIndex(newIndex);
						if (sb) {
							const viewportHeight = sb.viewport.height;
							const visbleEnd = sb.scrollTop + viewportHeight - 1;

							if (newIndex > visbleEnd) {
								sb.scrollTo(newIndex - viewportHeight + 1);
							}
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
		[scrollBoxIndex, filteredCommands, dialog?.currentDialog],
	);

	return (
		<scrollbox
			width="100%"
			height={MAX_VISIBLE_ITEMS}
			ref={scrollBoxRef}
			gap={1}
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
						marginRight={1}
						width={MAX_VALUE_WIDTH}
						marginY="auto"
					>
						{cmd.value}
					</text>
					<text fg="#fff" width={MAX_DESCRIPTION_WIDTH}>
						{cmd.description}{" "}
					</text>
				</box>
			))}
		</scrollbox>
	);
};

export default Menu;
