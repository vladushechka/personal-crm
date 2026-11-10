import { signOutAction } from "@/app/sign-out-action";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

// The signed-in user's email and «Выйти» in the header; nothing on the sign-in page
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <span className="min-w-0 truncate text-sm text-muted-foreground" title={user.email}>
        {user.email}
      </span>
      <form action={signOutAction} className="shrink-0">
        <Button type="submit" variant="outline" size="sm">
          Выйти
        </Button>
      </form>
    </div>
  );
}
