import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TypewriterProps {
    content: string;
    speed?: number;
    delay?: number;
    step?: number;
    className?: string;
    isMarkdown?: boolean;
}

export function Typewriter({ content, speed = 10, delay = 0, step = 1, className, isMarkdown = false }: TypewriterProps) {
    const [displayed, setDisplayed] = useState("");
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setHasStarted(true);
        }, delay);
        return () => clearTimeout(timer);
    }, [delay]);

    useEffect(() => {
        if (!hasStarted) return;

        if (displayed.length > content.length) {
            setDisplayed(content);
        } else if (displayed.length < content.length) {
            const timeout = setTimeout(() => {
                setDisplayed(content.slice(0, displayed.length + step));
            }, speed);
            return () => clearTimeout(timeout);
        }
    }, [content, displayed, hasStarted, speed, step]);

    if (isMarkdown) {
        const containerClassName = className ?? "chat-prose max-w-none";
        return (
            <div className={containerClassName}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        strong: ({ node, ...props }) => <strong {...props} />,
                        em: ({ node, ...props }) => <em {...props} />,
                        p: ({ node, ...props }) => <p {...props} />,
                        h1: ({ node, ...props }) => <h1 {...props} />,
                        h2: ({ node, ...props }) => <h2 {...props} />,
                        h3: ({ node, ...props }) => <h3 {...props} />,
                        h4: ({ node, ...props }) => <h4 {...props} />,
                        ul: ({ node, ...props }) => <ul {...props} />,
                        ol: ({ node, ...props }) => <ol {...props} />,
                        li: ({ node, ...props }) => <li {...props} />,
                        blockquote: ({ node, ...props }) => <blockquote {...props} />,
                        a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
                        hr: ({ node, ...props }) => <hr {...props} />,
                        pre: ({ node, ...props }) => <pre className="chat-scroll" {...props} />,
                        table: ({ node, ...props }) => (
                            <div className="chat-prose-table-wrapper chat-scroll">
                                <table {...props} />
                            </div>
                        ),
                        thead: ({ node, ...props }) => <thead {...props} />,
                        tbody: ({ node, ...props }) => <tbody {...props} />,
                        tr: ({ node, ...props }) => <tr {...props} />,
                        th: ({ node, ...props }) => <th {...props} />,
                        td: ({ node, ...props }) => <td {...props} />
                    }}
                >
                    {displayed}
                </ReactMarkdown>
            </div>
        );
    }

    return <span className={className}>{displayed}</span>;
}
