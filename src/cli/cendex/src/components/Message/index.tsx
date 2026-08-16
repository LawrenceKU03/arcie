import { theme } from "../../../theme";
import { EmptyBorder } from "../InputBar/border";

export type MessageType = {
	msg: string;
	type?: "user" | "error" | "bot" | null;
	model?: string;
	id: number;
};

const index = ({ msg, type, model }: MessageType) => {
	return (
		<box
			borderColor={
				type === "user"
					? theme.message.user.border
					: type === "error"
						? theme.message.error.border
						: theme.backgroundColor
			}
			border={["left"]}
			width="100%"
			customBorderChars={{ ...EmptyBorder, vertical: "┃" }}
		>
			<box
				paddingY={1}
				paddingX={2}
				width="100%"
				backgroundColor={
					type === "user"
						? theme.message.user.background
						: type === "error"
							? theme.message.error.background
							: theme.backgroundColor
				}
			>
				<text marginBottom={type === "bot" && 1}>{msg}</text>
				{type === "bot" && (
					<box flexDirection="row" alignItems="center" gap={1}>
						<text fg="#56D6C2">◉</text>
						{model && <text>{model}</text>}
					</box>
				)}
			</box>
		</box>
	);
};

export default index;
