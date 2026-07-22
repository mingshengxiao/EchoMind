"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/lib/auth-context";

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await register({ username, email, password });
      router.push("/resume-qa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Input autoComplete="username" label="用户名" name="username" onChange={(event) => setUsername(event.target.value)} required value={username} />
      <Input autoComplete="email" label="邮箱（可选）" name="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
      <Input autoComplete="new-password" label="密码" name="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button className="w-full" type="submit">
        {isSubmitting ? <LoadingSpinner /> : "创建账户"}
      </Button>
    </form>
  );
}
