import { theme } from "../../../theme";
import Message, { type MessageType } from "../../components/Message";
import InputBar from "../../components/InputBar";
import { useLocation } from "react-router";
import { useEffect, useRef } from "react";
import {
	useModels,
	type ModelContextValue,
} from "../../providers/ModelProvider";
import type { ScrollBoxRenderable } from "@opentui/core";

const THINKING_WORDS = [
	"Thinking",
	"Pondering",
	"Brainstorming",
	"Synthesizing",
	"Analyzing",
	"Calculating",
	"Deliberating",
	"Contemplating",
	"Reasoning",
	"Processing",
	"Evaluating",
	"Mulling over",
	"Cogitating",
	"Reflecting",
	"Speculating",
	"Formulating",
	"Assembling",
	"Weighing",
	"Deconstructing",
	"Consulting the cosmos",
	"Parsing data",
	"Connecting dots",
	"Scheming",
	"Ruminating",
	"Translating",
	"Computing",
	"Brewing thoughts",
	"Gathering insights",
	"Structuring",
	"Optimizing",
] as const;

const getRandomThinkingWord = (): string => {
	const index = Math.floor(Math.random() * THINKING_WORDS.length);
	return THINKING_WORDS[index];
};

const Home = () => {
	const location = useLocation();
	const { setSessionMessages, sessionMessages, respLoading } =
		useModels() as ModelContextValue;
	const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null);

	useEffect(() => {
		if (scrollBoxRef.current) {
			scrollBoxRef.current.scrollTo((sessionMessages.length + 1) * 1000);
		}
	}, [sessionMessages]);

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

		if (scrollBoxRef.current) {
			scrollBoxRef.current.scrollTo((sessionMessages.length + 1) * 1000);
		}
	};

	return (
		<box
			flexDirection="column"
			height="100%"
			width="100%"
			backgroundColor={theme.backgroundColor}
		>
			<scrollbox
				ref={scrollBoxRef}
				flexGrow={1}
				stickyScroll
				width="100%"
				stickStart="bottom"
			>
				<box flexDirection="column" width="100%">
					{sessionMessages?.map((msg: MessageType) => (
						<Message
							key={msg.id}
							msg={msg.msg}
							type={msg.type}
							model={msg.model}
						/>
					))}
					{respLoading && (
						<box
							flexDirection="row"
							alignItems="center"
							paddingX={2}
							paddingY={1}
							gap={1}
						>
							<spinner name="dots" color="#fff" />
							<text>{getRandomThinkingWord()}</text>
						</box>
					)}
				</box>
			</scrollbox>
			<box flexShrink={0} width="100%">
				<box paddingY={2}>
					<InputBar action={action} />
				</box>
			</box>
		</box>
	);
};

export default Home;
