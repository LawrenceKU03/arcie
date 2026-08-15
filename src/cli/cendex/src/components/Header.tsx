import path from "node:path";
import { useModels } from "../providers/ModelProvider";

const index = () => {
	const logoPath = path.join(__dirname, "../logo.jpeg");

	const { activeModel } = useModels();
	return (
		<box
			flexDirection="row"
			alignItems="center"
			gap={1}
			paddingX={2}
			marginTop={-2}
		>
			<image
				source={logoPath}
				fit="fit"
				protocol="auto"
				style={{ width: 12, height: 12 }}
			/>

			<box
				justifyContent="center"
				alignItems="flex-start"
				flexDirection="column"
				paddingX={1}
				paddingY={2}
				gap={0.5}
			>
				<text>
					<strong>Basecode v0.1.0</strong>
				</text>
				<text>Welcome to basecode by cencori!</text>
				<text>~/arcie/</text>
			</box>
		</box>
	);
};

export default index;
