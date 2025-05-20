import React from "react";
import "./Auth.css";
import { useForm, SubmitHandler } from "react-hook-form";
import { AuthFormInput } from "../../../types";
import { Link, useNavigate } from "react-router-dom";
import { checkLoginStatus, signUp } from "../../utils/auth";
import { useEffect } from "react";

export default function SignUp() {
	const { register, handleSubmit } = useForm<AuthFormInput>();
	const navigate = useNavigate();
	const onSubmit: SubmitHandler<AuthFormInput> = async (formData) => {
		try {
			// signUp now returns { user: User|null; session: Session|null }
			const { user, session } = await signUp(formData);

			// if you get a session back, the sign-up was successful
			if (session) {
				navigate("/");
			} else {
				console.error("Sign-up succeeded but no session was created", user);
				navigate("/signin");
			}
		} catch (error) {
			console.error("Error signing up:", error);
		}
	};

	useEffect(() => {
		const checkLogin = async () => {
			const isLoggedIn = await checkLoginStatus();
			if (isLoggedIn) {
				navigate("/");
			}
		};

		checkLogin();
	}, [navigate]);

	return (
		<div className="auth">
			<div className="auth-form-container">
				<h1>Sign Up</h1>
				<form className="auth-form" onKeyDown={(e) => e.key == "Enter" && e.preventDefault()}>
					<div className="input-wrapper">
						<label>Username</label>
						<input type="text" placeholder="Username" aria-placeholder="Username" {...register("username")} />
					</div>
					<div className="input-wrapper">
						<label>Email</label>
						<input type="email" placeholder="Email" aria-placeholder="Email" {...register("email")} />
					</div>
					<div className="input-wrapper">
						<label>Password</label>
						<input type="password" placeholder="Password" aria-placeholder="Password" {...register("password")} />
					</div>

					<div>
						<div className="checkbox-wrapper">
							<input id="tos" type="checkbox" />
							<label htmlFor="tos">I agree to whatever this is</label>
						</div>
					</div>
					<button className="btn" onClick={handleSubmit(onSubmit)}>
						Sign Up
					</button>
					<p className="auth-link-msg">
						Already have an account? <Link to="/signin">Sign In</Link>
					</p>
				</form>
			</div>
		</div>
	);
}
