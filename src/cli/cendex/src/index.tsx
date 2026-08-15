import "opentui-spinner/react";

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/react";

import { theme } from "../theme";
import Header from "./components/Header";
import InputBar from "./components/InputBar";

import ToastProvider from "./providers/ToastProvider";
import DialogProvider from "./providers/DialogProvider";

function App() {
	return (
		<box
			alignItems="flex-start"
			justifyContent="space-between"
			flexGrow={1}
			gap={1}
			backgroundColor={theme.backgroundColor}
		>
			<Header />
			<box paddingY={2}>
				<InputBar />
			</box>
		</box>
	);
}

const renderer = await createCliRenderer({ exitOnCtrlC: false });
const keymap = createDefaultOpenTuiKeymap(renderer);

createRoot(renderer).render(
	<KeymapProvider keymap={keymap}>
		<ToastProvider>
			<DialogProvider>
				<App />
			</DialogProvider>
		</ToastProvider>
	</KeymapProvider>,
);
