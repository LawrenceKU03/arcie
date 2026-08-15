import { theme } from "../../../theme";

const index = ({ model, mode }: { model: string; mode: string }) => {
	return (
		<box flexDirection="row" paddingBottom={0.5} paddingX={2}>
			<text fg={theme.inputBar.thinking}>{mode}</text>
			<text marginX={1}>*</text>
			<text>{model}</text>
		</box>
	);
};

export default index;
