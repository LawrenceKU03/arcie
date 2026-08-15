import { useEffect } from "react";
import { theme } from "../../../theme";

import InputBar from "../../components/InputBar";
import {
	useToast,
	type ToastContextValue,
} from "../../providers/ToastProvider";
import { useLocation } from "react-router";

const Home = () => {
	const { show } = useToast() as ToastContextValue;
	const location = useLocation();

	useEffect(() => {
		show("New Session!");
	}, []);

	return (
		<box
			alignItems="flex-start"
			justifyContent="space-between"
			flexGrow={1}
			gap={1}
			backgroundColor={theme.backgroundColor}
		>
			<text>{location?.state?.query}</text>
			<box paddingY={2}>
				<InputBar />
			</box>
		</box>
	);
};

export default Home;
