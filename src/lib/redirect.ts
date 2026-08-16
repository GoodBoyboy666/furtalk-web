// redirect 提供登录完成后的统一角色分流逻辑。
// 显式本地回跳优先，其次按角色进入默认区域：admin -> /admin，普通用户 -> /account/comments。
// 只接受同源本地路径，拒绝绝对 URL、跨源协议与协议相对地址。

/** isSafeLocalRedirect 判断字符串是否为安全的本站相对路径。 */
export function isSafeLocalRedirect(value: string): boolean {
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  // 拒绝反斜杠变体：浏览器 URL 解析会把 "\" 当作 "/"，
  // "/\evil.com" 会被解析为跨源 https://evil.com/。
  if (value.includes('\\')) return false
  // 拒绝 "javascript:"、"https:" 等带协议前缀的伪路径。
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return false
  return true
}

/**
 * resolvePostLoginTarget 返回登录完成后应导航的路径。
 * @param role 当前用户角色（取自刷新后的 /me）
 * @param redirect 登录页 query 中的业务回跳地址；必须通过安全校验才使用
 */
export function resolvePostLoginTarget(
  role: string,
  redirect?: string | null,
): string {
  if (redirect && isSafeLocalRedirect(redirect)) return redirect
  return role === 'admin' ? '/admin' : '/account/comments'
}
