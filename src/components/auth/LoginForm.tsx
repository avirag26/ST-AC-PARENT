"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { ApiError, api } from "@/lib/api";
import { saveSession, type AuthUser } from "@/lib/auth-storage";

type FieldErrors = {
  email?: string;
  password?: string;
};

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = "Enter your email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Enter your password.";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }
  return errors;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validate(email, password);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const { data } = await api.post<LoginResponse>("/auth/login/email", {
        email: email.trim().toLowerCase(),
        password,
      });

      if (data.user.role !== "PARENT") {
        setFormError("This app is for parents only.");
        return;
      }

      saveSession(data.accessToken, data.user);
      router.push("/dashboard");
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Cannot reach the server. Make sure the backend is running on port 4000.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-1 flex-col gap-4"
      noValidate
    >
      {formError ? (
        <div
          role="alert"
          className="rounded-md border border-error/30 bg-error-bg px-3 py-3 text-sm text-error"
        >
          {formError}
        </div>
      ) : null}

      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="e.g. parent@example.com"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (errors.email) setErrors((c) => ({ ...c, email: undefined }));
        }}
        error={errors.email}
        hint="Use the email the CEO registered for your family."
      />

      <PasswordField
        name="password"
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          if (errors.password) setErrors((c) => ({ ...c, password: undefined }));
        }}
        error={errors.password}
      />

      <p className="text-sm text-text-secondary">
        Forgot password? Email reset comes in a later step.
      </p>

      <div className="mt-auto pt-2">
        <Button type="submit" fullWidth isLoading={isSubmitting}>
          Sign in
        </Button>
      </div>
    </form>
  );
}
