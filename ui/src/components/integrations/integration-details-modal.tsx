import type { ReactNode } from "react";
import { Modal } from "@/components/ui/modal";

interface IntegrationDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    icon: ReactNode;
    children: ReactNode;
}

export function IntegrationDetailsModal({
    isOpen,
    onClose,
    title,
    icon,
    children,
}: IntegrationDetailsModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                    {icon}
                </div>
                <span>{title} Settings</span>
            </div>
        }>
            <div className="space-y-6">
                {children}
            </div>
        </Modal>
    );
}
