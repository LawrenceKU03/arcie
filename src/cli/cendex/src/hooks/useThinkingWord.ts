import { useCallback, useState } from "react";
import { THINKING_WORDS } from "../constants/thinkingWords";

const pickWord = (words: readonly string[], exclude?: string): string => {
	if (words.length <= 1) return words[0] ?? "";
	let next: string;
	do {
		next = words[Math.floor(Math.random() * words.length)] as string;
	} while (next === exclude);
	return next;
};

export const useThinkingWord = (
	words: readonly string[] = THINKING_WORDS,
): [string, () => void] => {
	const [word, setWord] = useState(() => pickWord(words));

	const advance = useCallback(() => {
		setWord((prev) => pickWord(words, prev));
	}, [words]);

	return [word, advance];
};
