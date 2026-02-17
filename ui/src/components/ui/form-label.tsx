import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}

export function FormLabel({ children, icon: Icon, className, ...props }: FormLabelProps) {
    return (
        <label
            className={cn(
                "flex items-center gap-1.5 text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2",
                className
            )}
            {...props}
        >
            {Icon && <Icon className="h-3 w-3 text-slate-500" />}
            {children}
        </label>
    );
}
