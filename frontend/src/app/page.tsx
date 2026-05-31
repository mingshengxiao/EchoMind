import { ArrowRight, FileText, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" />
            简历问答 · 第一阶段已开放
          </div>
          <h1 className="max-w-4xl text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl">
            把你的简历变成一份可追问的面试训练清单。
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            EchoMind 读取你的简历内容，生成 50–100 个贴合项目、技能和经历的问题。你可以登录保存历史，也可以直接以游客模式体验。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/resume-qa">
              <Button>
                开始简历问答
                <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary">登录并保存历史</Button>
            </Link>
          </div>
        </div>
        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-200 blur-3xl" />
          <div className="relative space-y-4">
            {[
              "请介绍你在 FastAPI 项目中负责的核心模块。",
              "你如何优化简历中提到的 MongoDB 查询性能？",
              "当 AI 生成结果不稳定时，你会如何设计重试与降级？",
            ].map((question, index) => (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4" key={question}>
                <p className="text-xs font-semibold text-brand">Question {index + 1}</p>
                <p className="mt-2 text-zinc-900">{question}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 py-12 md:grid-cols-3" id="features">
        {[
          { icon: FileText, title: "多格式上传", text: "支持 PDF、DOCX、Markdown、TXT 等常见简历格式。" },
          { icon: Sparkles, title: "AI 生成问题", text: "基于简历事实生成技术、项目、行为和场景问题。" },
          { icon: ShieldCheck, title: "游客不落库", text: "不登录也能体验，游客上传与生成结果不会保存到数据库。" },
        ].map((feature) => (
          <Card key={feature.title}>
            <feature.icon aria-hidden="true" className="h-7 w-7 text-brand" />
            <h2 className="mt-5 text-xl font-bold text-zinc-950">{feature.title}</h2>
            <p className="mt-2 leading-6 text-zinc-600">{feature.text}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
