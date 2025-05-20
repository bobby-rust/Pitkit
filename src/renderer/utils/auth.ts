import { createClient } from "@supabase/supabase-js";
import type { AuthFormInput } from "../../types";

// pull these in from your Vite env
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// initialize the client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Hook to redirect to /login if no session is found.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
export function useProtectedRoute() {
	const navigate = useNavigate();
	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (!session) navigate("/signin");
		});
		// optional: also listen for sign-out events
		const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
			if (!session) navigate("/signin");
		});
		return () => {
			listener.subscription.unsubscribe();
		};
	}, [navigate]);
}

/**
 * Returns true if there's a valid Supabase session.
 */
export async function checkLoginStatus(): Promise<boolean> {
	const {
		data: { session },
	} = await supabase.auth.getSession();
	console.log("SEessiosn: ", session);
	return session !== null;
}

/**
 * Sign in with email + password.
 */
export async function signIn({ email, password }: AuthFormInput) {
	const { data, error } = await supabase.auth.signInWithPassword({ email, password });
	if (error) throw error;
	return data; // { session, user }
}

/**
 * Sign out.
 */
export async function logout() {
	const { error } = await supabase.auth.signOut();

	if (error) throw error;
}

/**
 * Create an account.  If you also collect "username", you can stash it in user_metadata:
 */
export async function signUp({ email, password, username }: AuthFormInput) {
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: { username },
		},
	});
	if (error) throw error;
	return data; // { user, session }
}
