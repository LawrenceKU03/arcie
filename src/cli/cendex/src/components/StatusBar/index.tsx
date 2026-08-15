import { theme } from "../../../theme";
import { useModels } from "../../providers/ModelProvider";

const index = ({ model, mode }: { model: string; mode: string }) => {
	const { activeModel } = useModels();

	return (
		<box flexDirection="row" paddingBottom={0.5} paddingX={2}>
			<text fg={theme.inputBar.thinking}>{activeModel ? mode : "Waiting"}</text>
			<text marginX={1}>*</text>
			{activeModel ? (
				<text>{activeModel?.name}</text>
			) : (
				<box flexDirection="row" gap={1}>
					<spinner name="dots" color="#fff" />
					<text>Please select a model</text>
				</box>
			)}
		</box>
	);
};

export default index;
