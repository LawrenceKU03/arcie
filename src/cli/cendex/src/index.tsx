import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { theme } from "../theme";
import Header from "./components/Header";
import InputBar from "./components/InputBar";

function App() {
	return (
		<box
			alignItems="center"
			justifyContent="center"
			flexGrow={1}
			gap={3}
			backgroundColor={theme.backgroundColor}
		>
			<Header />
			<InputBar />
		</box>
	);
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
