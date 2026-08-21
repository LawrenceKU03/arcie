import { promises as fs } from "fs";
import { readdir } from "fs/promises";
import { join, relative, extname } from "path";
// fileHandler.ts
const SECRET_FILE_PATTERNS = [
	/^\.env(\..*)?$/, // .env, .env.local, .env.production
	/\.pem$/,
	/\.key$/,
	/^id_rsa/,
	/\.p12$/,
	/\.pfx$/,
	/credentials\.json$/i,
];

export const isSecretFile = (name: string): boolean =>
	SECRET_FILE_PATTERNS.some((p) => p.test(name));
const EXCLUDED_DIRS = new Set([
	"node_modules",
	".git",
	"dist",
	".next",
	"build",
	"out",
	".turbo",
	".cache",
	"coverage",
	"target",
	"vendor",
]);

const EXCLUDED_FILES = new Set([
	"package-lock.json",
	"bun.lockb",
	"bun.lock",
	"yarn.lock",
	"pnpm-lock.yaml",
	".DS_Store",
]);

const EXCLUDED_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".svg",
	".webp",
	".ico",
	".bmp",
	".tiff",
	".mp4",
	".mov",
	".avi",
	".mp3",
	".wav",
	".ogg",
	".webm",
	".woff",
	".woff2",
	".ttf",
	".otf",
	".eot",
	".zip",
	".tar",
	".gz",
	".rar",
	".7z",
	".exe",
	".dll",
	".so",
	".dylib",
	".wasm",
	".node",
	".pdf",
	".docx",
	".xlsx",
	".sqlite",
	".db",
]);

const MAX_FILE_SIZE = 500 * 1024;

export const writeToFile = async (
	filePath: string,
	content: string,
): Promise<void> => {
	try {
		await fs.writeFile(filePath, content, "utf-8");
	} catch (error) {
		console.error(`Failed to write to ${filePath}:`, error);
		throw error;
	}
};

export const readFromFile = async (filePath: string): Promise<string> => {
	try {
		return await fs.readFile(filePath, "utf-8");
	} catch (error) {
		console.error(`Failed to read from ${filePath}:`, error);
		throw error;
	}
};

export async function scanRepository(
	dir: string,
	baseDir: string = dir,
): Promise<Array<{ path: string; content: string }>> {
	const entries = await readdir(dir, { withFileTypes: true });
	let results: Array<{ path: string; content: string }> = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			if (
				EXCLUDED_DIRS.has(entry.name) ||
				entry.name.startsWith(".") ||
				isSecretFile(entry.name)
			)
				continue;
			const subFiles = await scanRepository(fullPath, baseDir);
			results.push(...subFiles);
			continue;
		}

		if (!entry.isFile()) continue;
		if (EXCLUDED_FILES.has(entry.name)) continue;

		const ext = extname(entry.name).toLowerCase();
		if (EXCLUDED_EXTENSIONS.has(ext)) continue;

		try {
			const file = Bun.file(fullPath);
			if (file.size > MAX_FILE_SIZE) continue;

			const content = await file.text();

			// Cheap binary sniff: text files shouldn't contain null bytes
			if (content.includes("\u0000")) continue;

			results.push({
				path: relative(baseDir, fullPath),
				content,
			});
		} catch (e) {
			// 2. Read a specific file
		}
	}

	return results;
}

export type RepoEntry =
	| { path: string; type: "file" }
	| { path: string; type: "directory"; children: RepoEntry[] };

export async function scanRepositoryNames(
	dir: string,
	baseDir: string = dir,
): Promise<RepoEntry[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	let results: RepoEntry[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			if (
				EXCLUDED_DIRS.has(entry.name) ||
				entry.name.startsWith(".") ||
				isSecretFile(entry.name)
			)
				continue;
			const children = await scanRepositoryNames(fullPath, baseDir);
			results.push({
				path: relative(baseDir, fullPath),
				type: "directory",
				children,
			});
			continue;
		}

		if (!entry.isFile()) continue;
		if (EXCLUDED_FILES.has(entry.name)) continue;

		const ext = extname(entry.name).toLowerCase();
		if (EXCLUDED_EXTENSIONS.has(ext)) continue;

		results.push({
			path: relative(baseDir, fullPath),
			type: "file",
		});
	}

	return results;
}

export async function readFileContent(filePath: string): Promise<string> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) {
		throw new Error(`File not found: ${filePath}`);
	}
	return await file.text();
}

// 3. Create or completely overwrite a file (automatically creates parent directories if needed)
export async function writeFileContent(
	filePath: string,
	content: string,
): Promise<void> {
	await Bun.write(filePath, content);
}

// 4. Edit/Update a file by replacing specific strings or lines
export async function editFileContent(
	filePath: string,
	target: string,
	replacement: string,
): Promise<void> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) {
		throw new Error(`File not found: ${filePath}`);
	}

	const content = await file.text();
	if (!content.includes(target)) {
		throw new Error(`Target string not found in ${filePath}`);
	}

	const updatedContent = content.replace(target, replacement);
	await Bun.write(filePath, updatedContent);
}

export interface SearchResult {
	path: string;
	type: "file" | "directory";
}

export interface SearchOptions {
	caseSensitive?: boolean;
	matchType?: "exact" | "partial";
}

export const searchRepository = async (
	dir: string,
	query: string,
	options: SearchOptions & { baseDir?: string } = {},
): Promise<SearchResult[]> => {
	const {
		caseSensitive = false,
		matchType = "partial",
		baseDir = dir,
	} = options;
	const normalizedQuery = caseSensitive ? query : query.toLowerCase();

	const matches = (name: string): boolean => {
		const normalizedName = caseSensitive ? name : name.toLowerCase();
		return matchType === "exact"
			? normalizedName === normalizedQuery
			: normalizedName.includes(normalizedQuery);
	};

	const entries = await readdir(dir, { withFileTypes: true });
	let results: SearchResult[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		const relPath = relative(baseDir, fullPath);

		if (entry.isDirectory()) {
			if (
				EXCLUDED_DIRS.has(entry.name) ||
				entry.name.startsWith(".") ||
				isSecretFile(entry.name)
			)
				continue;

			if (matches(entry.name)) {
				results.push({ path: relPath, type: "directory" });
			}

			const subResults = await searchRepository(fullPath, query, {
				...options,
				baseDir,
			});
			results.push(...subResults);
			continue;
		}

		if (!entry.isFile()) continue;
		if (EXCLUDED_FILES.has(entry.name)) continue;

		const ext = extname(entry.name).toLowerCase();
		if (EXCLUDED_EXTENSIONS.has(ext)) continue;

		if (matches(entry.name)) {
			results.push({ path: relPath, type: "file" });
		}
	}

	return results;
};
