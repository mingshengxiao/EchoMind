import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6 lg:px-8">
      <Card>
        <h1 className="text-3xl font-bold text-zinc-950">登录 EchoMind</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">登录后可以保存上传过的简历和生成的问题。也可以直接以游客模式进入。</p>
        <div className="mt-8">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-zinc-600">
          还没有账户？
          <Link className="font-semibold text-brand underline decoration-blue-200 underline-offset-4" href="/register">
            立即注册
          </Link>
        </p>
      </Card>
    </div>
  );
}
