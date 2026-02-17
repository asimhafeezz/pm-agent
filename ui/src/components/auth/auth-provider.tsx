import { useSelector, useDispatch } from "react-redux";
import { setCredentials, logout as reduxLogout, selectCurrentUser, selectCurrentToken } from "../../store/auth-slice";

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    authProvider?: string | null;
    avatarUrl?: string | null;
    authProviderMetadataJson?: { picture?: string | null } | null;
}

// We don't need a real provider anymore, but we keep the hook interface
// for backward compatibility with existing components
// OR we can export a hook that wraps redux.

export function AuthProvider({ children }: { children: React.ReactNode }) {
    // This component now just renders children, as Provider is at root
    // But to minimize changes, we can keep it as a pass-through
    return <>{children}</>;
}

export function useAuth() {
    const dispatch = useDispatch();
    const user = useSelector(selectCurrentUser);
    const token = useSelector(selectCurrentToken);

    // Redux Persist handles loading state implicitly (via PersistGate), 
    // so for components inside PersistGate, we are technically "loaded"
    const isLoading = false;

    const login = (newToken: string, newUser: User) => {
        const normalizedUser = {
            ...newUser,
            avatarUrl:
                newUser.avatarUrl
                || newUser.authProviderMetadataJson?.picture
                || null,
        };
        dispatch(setCredentials({ user: normalizedUser, token: newToken }));
    };

    const logout = () => {
        dispatch(reduxLogout());
    };

    return { user, token, login, logout, isLoading };
}
