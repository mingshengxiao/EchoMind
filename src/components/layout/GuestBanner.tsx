import Link from "next/link";

export function GuestBanner() {
  return (
    <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
      当前为游客模式。你可以直接上传简历生成问题，但内容不会保存到数据库。
      <Link className="ml-2 font-semibold underline decoration-blue-300 underline-offset-4" href="/login">
        登录后保存历史记录
      </Link>
    </div>
  );
}
