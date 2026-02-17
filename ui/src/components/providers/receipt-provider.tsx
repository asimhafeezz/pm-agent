import { createContext, useContext, useState, type ReactNode, useCallback } from "react";
import { ReceiptModal } from "@/components/modals/receipt-modal";

interface ReceiptData {
    type: "buy" | "sell" | "deposit" | "withdraw";
    amount: number;
    symbol?: string;
    price?: number;
    timestamp?: Date;
}

interface ReceiptContextType {
    showReceipt: (data: ReceiptData) => void;
}

const ReceiptContext = createContext<ReceiptContextType | null>(null);

export function useReceipt() {
    const context = useContext(ReceiptContext);
    if (!context) {
        throw new Error("useReceipt must be used within a ReceiptProvider");
    }
    return context;
}

interface ReceiptProviderProps {
    children: ReactNode;
}

export function ReceiptProvider({ children }: ReceiptProviderProps) {
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

    const showReceipt = useCallback((data: ReceiptData) => {
        // Ensure timestamp is set if not provided
        if (!data.timestamp) {
            data.timestamp = new Date();
        }
        setReceiptData(data);
    }, []);

    const closeReceipt = useCallback(() => {
        setReceiptData(null);
    }, []);

    return (
        <ReceiptContext.Provider value={{ showReceipt }}>
            {children}
            {/* Global Receipt Modal */}
            <ReceiptModal
                isOpen={!!receiptData}
                onClose={closeReceipt}
                data={receiptData}
            />
        </ReceiptContext.Provider>
    );
}
