import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const LAST_GOOGLE_ACCOUNT_KEY = "auth:last-google-account";

type GoogleContinueButtonProps = {
  primaryText: string;
  secondaryText?: string;
  avatarUrl?: string | null;
  showAvatar?: boolean;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
  mode?: "action" | "display";
  className?: string;
};

export function GoogleContinueButton({
  primaryText,
  secondaryText,
  avatarUrl,
  showAvatar = true,
  iconPosition = "right",
  fullWidth = true,
  onClick,
  loading = false,
  disabled = false,
  showChevron = true,
  mode = "action",
  className,
}: GoogleContinueButtonProps) {
  const initials = (primaryText || "G").trim().charAt(0).toUpperCase();
  const sharedClass = cn(
    fullWidth ? "w-full" : "w-auto",
    "flex items-center gap-3 rounded-full border border-[#d7dbe2] bg-white px-3.5 py-2.5 text-left",
  );

  const iconNode = loading ? (
    <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />
  ) : (
    <span className="flex items-center gap-2 shrink-0">
      {showChevron && <ChevronDown className="h-4 w-4 text-slate-500" />}
      <img
        src="/google-logo.png"
        alt="Google"
        className="h-5 w-5 object-contain"
      />
    </span>
  );

  const content = (
    <>
      {iconPosition === "left" && !showAvatar ? iconNode : null}

      {showAvatar ? (
        <span className="h-9 w-9 shrink-0 rounded-full border border-[#d7dbe2] bg-[#f2f4f8] overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-700">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Google account"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            initials
          )}
        </span>
      ) : null}

      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[15px] font-semibold text-slate-700 truncate">
          {primaryText}
        </span>
      {secondaryText ? (
        <span className="block text-[14px] text-slate-500 truncate mt-0.5">
          {secondaryText}
        </span>
      ) : null}
      </span>

      {iconPosition === "right" || showAvatar ? iconNode : null}
    </>
  );

  if (mode === "display") {
    return <div className={cn(sharedClass, className)}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        sharedClass,
        "transition-all hover:bg-[#f7f8fa] hover:border-[#cfd5de] disabled:opacity-70 disabled:cursor-not-allowed",
        className,
      )}
    >
      {content}
    </button>
  );
}
