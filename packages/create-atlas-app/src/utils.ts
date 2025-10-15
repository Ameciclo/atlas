export function validateAppName(name: string): {
	valid: boolean;
	error?: string;
} {
	if (!name || name.trim().length === 0) {
		return { valid: false, error: "App name cannot be empty" };
	}

	if (!/^[a-z0-9-]+$/.test(name)) {
		return {
			valid: false,
			error:
				"App name can only contain lowercase letters, numbers, and hyphens",
		};
	}

	if (name.startsWith("-") || name.endsWith("-")) {
		return {
			valid: false,
			error: "App name cannot start or end with a hyphen",
		};
	}

	return { valid: true };
}

export function toKebabCase(str: string): string {
	return str
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function toPascalCase(str: string): string {
	return str
		.split(/[-_\s]+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
}

export function toCamelCase(str: string): string {
	const pascal = toPascalCase(str);
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(str: string): string {
	return str
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

export function replaceTemplateVars(
	content: string,
	config: Record<string, unknown>,
): string {
	let result = content;

	for (const [key, value] of Object.entries(config)) {
		const regex = new RegExp(`{{${key}}}`, "g");
		result = result.replace(regex, String(value));
	}

	return result;
}
