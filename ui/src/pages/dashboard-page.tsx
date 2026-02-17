import { useAuth } from "@/components/auth/auth-provider";

export default function DashboardPage() {
    const { user } = useAuth();

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Welcome, {user?.firstName || 'User'}</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-6 bg-card rounded-lg border shadow-sm">
                    <h2 className="text-xl font-semibold mb-2">Project Overview</h2>
                    <p className="text-muted-foreground">No active projects.</p>
                </div>
            </div>
        </div>
    );
}
