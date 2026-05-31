import Link from "next/link";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6 lg:px-8">
      <Card>
        <h1 className="text-3xl font-bold text-zinc-950">创建账户</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">注册后，你的简历和面试题会保存在当前后端存储中。</p>
        <div className="mt-8">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-sm text-zinc-600">
          已有账户？
          <Link className="font-semibold text-brand underline decoration-blue-200 underline-offset-4" href="/login">
            去登录
          </Link>
        </p>
      </Card>
    </div>
  );
}
