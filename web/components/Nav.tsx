import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <div className="wrap">
      <nav className="nav">
        <Link href="/" className="logo">
          Clip<span>Forge</span>
        </Link>
        <div className="navlinks">
          <Link href="/pricing">Pricing</Link>
          {user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <form action="/auth/signout" method="post">
                <button className="btn small" type="submit">Log out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn small primary">Get started</Link>
          )}
        </div>
      </nav>
    </div>
  );
}
