const resolveApiBase = () => {
    const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (configuredBase && configuredBase.trim()) {
        return configuredBase.replace(/\/$/, "");
    }

    // In dev, default to same-origin so Vite can proxy /api and avoid unsafe ports.
    return "";
};

const apiBase = resolveApiBase();

export const apiUrl = (path: string) => {
    if (!apiBase) {
        return path;
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${apiBase}${normalizedPath}`;
};
