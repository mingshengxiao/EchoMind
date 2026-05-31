"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/lib/auth-context";

export function LoginForm() {
  const router = useRouter();
  const { login, continueAsGuest } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(username, password);
      router.push("/resume-qa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Input autoComplete="username" label="用户名" name="username" onChange={(event) => setUsername(event.target.value)} required value={username} />
      <Input autoComplete="current-password" label="密码" name="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button className="w-full" type="submit">
        {isSubmitting ? <LoadingSpinner /> : "登录"}
      </Button>
      <Button
        className="w-full"
        onClick={() => {
          continueAsGuest();
          router.push("/resume-qa");
        }}
        type="button"
        variant="secondary"
      >
        不登录，以默认 user 游客进入
      </Button>
    </form>
  );
}
