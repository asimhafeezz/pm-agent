import { Modal } from "@/components/ui/modal";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    loading: boolean;
}

export function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    loading
}: DeleteConfirmationModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2 text-rose-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Confirm Deletion</span>
                </div>
            }
            width="sm"
        >
            <div className="space-y-4">
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <h4 className="text-sm font-semibold text-rose-200 mb-1">{title}</h4>
                    <p className="text-xs text-rose-200/70 leading-relaxed">
                        {description}
                    </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/20"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete Forever
                    </button>
                </div>
            </div>
        </Modal>
    );
}
