import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot } from "@opentui/react";

function App() {
	return (
		<box alignItems="center" justifyContent="center" flexGrow={1}>
			<box
				justifyContent="center"
				alignItems="center"
				flexDirection="row"
				gap={2}
			>
				<ascii-font font="slick" text="CENCORI" color="gray" />
				<ascii-font font="slick" text="CODE" />
			</box>
		</box>
	);
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
