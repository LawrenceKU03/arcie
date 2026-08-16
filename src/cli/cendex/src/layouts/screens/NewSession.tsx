import { theme } from "../../../theme";

import Message, { type MessageType } from "../../components/Message";
import InputBar from "../../components/InputBar";

import { useLocation } from "react-router";
import { useEffect } from "react";
import {
	useModels,
	type ModelContextValue,
} from "../../providers/ModelProvider";

const Home = () => {
	const location = useLocation();
	const { setSessionMessages, sessionMessages } =
		useModels() as ModelContextValue;

	const action = (data: { query?: string }) => {
		if (!data?.query) return;

		setSessionMessages((prev) => [
			...prev,
			{
				msg: data.query,
				type: "user",
				id: crypto.randomUUID(),
			},
		]);
	};

	useEffect(() => {
		const initialQuery = location.state?.query;
		if (!initialQuery) return;

		setSessionMessages((prev) => [
			...prev,
			{
				msg: initialQuery,
				type: "user",
				id: crypto.randomUUID(),
			},
		]);
	}, [location.state?.query, setSessionMessages]);

	return (
		<box
			alignItems="flex-start"
			height="100%"
			backgroundColor={theme.backgroundColor}
		>
			<scrollbox
				alignItems="flex-start"
				flexGrow={1}
				stickyScroll
				stickStart="bottom"
			>
				{sessionMessages?.map((msg: MessageType) => (
					<Message
						key={msg.id}
						msg={msg.msg}
						type={msg.type}
						model={msg.model}
					/>
				))}
			</scrollbox>
			<box flexShrink={0}>
				<box paddingY={2}>
					<InputBar action={action} />
				</box>
			</box>
		</box>
	);
};

export default Home;
