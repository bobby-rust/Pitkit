import React from "react";
import "./Auth.css";
import { useForm, SubmitHandler } from "react-hook-form";
import { AuthFormInput } from "../../../types";
import { checkLoginStatus, signIn } from "../../utils/auth";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function SignIn() {
	const { register, handleSubmit } = useForm<AuthFormInput>();
	const navigate = useNavigate();
	// const [invalidCredentials, setInvalidCredentials] =
	//     useState<boolean>(false);

	const onSubmit: SubmitHandler<AuthFormInput> = async (formData) => {
		try {
			// signUp now returns { user: User|null; session: Session|null }
			const { user, session } = await signIn(formData);

			console.log("Sesssion: ", session);

			// if you get a session back, the sign-up was successful
			if (session) {
				navigate("/");
			} else {
				console.error("Sign-in succeeded but no session was created", user);
				navigate("/");
			}
		} catch (error) {
			console.error("Error signing in:", error);
		}
	};

	useEffect(() => {
		const checkLogin = async () => {
			const isLoggedIn = await checkLoginStatus();
			if (isLoggedIn) {
				console.log("user is logged in");
				navigate("/");
			}
		};

		checkLogin();
	}, [navigate]);

	return (
		<div className="auth">
			<div className="auth-form-container">
				<h1>Sign In</h1>
				<form className="auth-form" onKeyDown={(e) => e.key == "Enter" && e.preventDefault()}>
					<div className="input-wrapper">
						<label>Email</label>
						<input type="email" placeholder="Email" aria-placeholder="Email" {...register("email")} />
					</div>
					<div className="input-wrapper">
						<label>Password</label>
						<input type="password" placeholder="Password" aria-placeholder="Password" {...register("password")} />
					</div>
					<button className="btn" onClick={handleSubmit(onSubmit)}>
						Sign In
					</button>
				</form>
				<p className="auth-link-msg">
					Don't have an account? <Link to="/signup">Sign up</Link>
				</p>
			</div>
		</div>
	);
}
