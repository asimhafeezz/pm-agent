import { useAuth } from "@/components/auth/auth-provider";

export default function SettingsPage() {
    const { user, logout } = useAuth();

    return (
        <div className="container max-w-2xl mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold">Settings</h1>

            <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Profile</h3>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>

                <button
                    onClick={() => logout()}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
}
